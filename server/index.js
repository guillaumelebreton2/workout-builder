/**
 * Backend server pour la synchro Garmin Connect
 * Utilise l'API non-officielle via garmin-connect
 */

import express from 'express';
import cors from 'cors';
import pkg from 'garmin-connect';
const { GarminConnect } = pkg;

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Cache des sessions Garmin (durée: 1 heure)
const SESSION_DURATION = 60 * 60 * 1000; // 1 heure en ms
const sessionCache = new Map();

function getCachedSession(email) {
  const cached = sessionCache.get(email);
  if (cached && Date.now() - cached.timestamp < SESSION_DURATION) {
    console.log('Session Garmin en cache trouvée pour', email);
    return cached.session;
  }
  if (cached) {
    console.log('Session expirée pour', email);
    sessionCache.delete(email);
  }
  return null;
}

function setCachedSession(email, session) {
  sessionCache.set(email, {
    session,
    timestamp: Date.now()
  });
  console.log('Session Garmin mise en cache pour', email);
}

// Mapping des types de sport
const SPORT_TYPE_MAP = {
  running: { sportTypeId: 1, sportTypeKey: 'running' },
  cycling: { sportTypeId: 2, sportTypeKey: 'cycling' },
  swimming: { sportTypeId: 5, sportTypeKey: 'lap_swimming' },
};

// Mapping des types d'intensité/step
const STEP_TYPE_MAP = {
  warmup: { stepTypeId: 1, stepTypeKey: 'warmup' },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown' },
  active: { stepTypeId: 3, stepTypeKey: 'interval' },
  recovery: { stepTypeId: 4, stepTypeKey: 'recovery' },
  rest: { stepTypeId: 5, stepTypeKey: 'rest' },
};

// Mapping des types de durée (condition de fin)
const END_CONDITION_MAP = {
  time: { conditionTypeId: 2, conditionTypeKey: 'time' },
  distance: { conditionTypeId: 3, conditionTypeKey: 'distance' },
  open: { conditionTypeId: 1, conditionTypeKey: 'lap.button' },
};

/**
 * Crée un step Garmin à partir de notre format
 */
function createGarminStep(step, stepOrder, sport) {
  const stepType = STEP_TYPE_MAP[step.type] || STEP_TYPE_MAP.active;
  const endCondition = END_CONDITION_MAP[step.duration?.type] || END_CONDITION_MAP.open;

  const garminStep = {
    type: 'ExecutableStepDTO',
    stepId: null,
    stepOrder: stepOrder,
    stepType: stepType,
    childStepId: null,
    endCondition: endCondition,
    preferredEndConditionUnit: null,
    endConditionValue: null,
    endConditionCompare: null,
    endConditionZone: null,
    targetType: { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' },
    targetValueOne: null,
    targetValueTwo: null,
    zoneNumber: null,
    secondaryTargetType: null,
    secondaryTargetValueOne: null,
    secondaryTargetValueTwo: null,
    secondaryZoneNumber: null,
    endConditionCalories: null,
    strokeType: null,
    equipmentType: null,
    exerciseName: null,
    workoutProvider: null,
    providerExerciseSourceId: null,
    description: step.name,
    estimatedDistanceUnit: null,
    estimatedDurationInSecs: null,
    estimatedDistanceInMeters: null,
    weight: null,
    weightUnit: null,
    reps: null,
    sets: null,
  };

  // Ajouter la valeur de durée selon le type
  if (step.duration?.type === 'time' && step.duration.value) {
    garminStep.endConditionValue = step.duration.value; // secondes
    garminStep.preferredEndConditionUnit = { unitId: 2, unitKey: 'second' };
    garminStep.estimatedDurationInSecs = step.duration.value;
  } else if (step.duration?.type === 'distance' && step.duration.value) {
    // Format officiel garmin-connect : valeur en mètres, unitKey seul
    garminStep.endConditionValue = Math.round(step.duration.value);
    garminStep.preferredEndConditionUnit = {
      unitKey: 'kilometer'
    };
    garminStep.estimatedDistanceInMeters = step.duration.value;
  }

  // Ajouter la cible d'allure si disponible (course à pied)
  if (sport === 'running' && step.details?.paceMinKm) {
    const { low, high } = step.details.paceMinKm;
    // Garmin utilise m/s pour la vitesse
    // low = allure lente (min/km élevé) = vitesse basse
    // high = allure rapide (min/km bas) = vitesse haute
    const speedLow = 1000 / (low * 60); // m/s (allure lente)
    const speedHigh = 1000 / (high * 60); // m/s (allure rapide)

    garminStep.targetType = { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' };
    garminStep.targetValueOne = speedHigh; // vitesse min (allure max/lente)
    garminStep.targetValueTwo = speedLow;  // vitesse max (allure min/rapide)
  }

  // Ajouter la cible de puissance si disponible (vélo)
  if (sport === 'cycling' && step.details?.watts) {
    const { low, high } = step.details.watts;
    garminStep.targetType = { workoutTargetTypeId: 4, workoutTargetTypeKey: 'power.zone' };
    garminStep.targetValueOne = low;
    garminStep.targetValueTwo = high;
  }

  return garminStep;
}

/**
 * Détecte les blocs de répétition dans les steps
 */
function detectRepeatBlocks(steps) {
  if (steps.length < 4) return null;

  // Chercher un pattern qui se répète (intervalle + récup)
  for (let patternLen = 2; patternLen <= 3; patternLen++) {
    const pattern = steps.slice(0, patternLen);
    let repetitions = 1;
    let i = patternLen;

    while (i + patternLen <= steps.length) {
      const nextBlock = steps.slice(i, i + patternLen);
      const isMatch = pattern.every((step, idx) => {
        const other = nextBlock[idx];
        return step.type === other.type &&
               step.duration?.type === other.duration?.type &&
               step.duration?.value === other.duration?.value;
      });

      if (isMatch) {
        repetitions++;
        i += patternLen;
      } else {
        break;
      }
    }

    if (repetitions >= 2) {
      return {
        pattern,
        repetitions,
        remainingSteps: steps.slice(i)
      };
    }
  }

  return null;
}

/**
 * Convertit un workout de notre format vers le format JSON Garmin
 */
function convertToGarminFormat(workout) {
  const sportType = SPORT_TYPE_MAP[workout.sport] || SPORT_TYPE_MAP.running;
  const workoutSteps = [];
  let stepOrder = 1;

  // Séparer échauffement, corps et retour au calme
  const warmupSteps = [];
  const mainSteps = [];
  const cooldownSteps = [];

  let phase = 'warmup';
  for (const step of workout.steps) {
    if (step.type === 'warmup') {
      warmupSteps.push(step);
      phase = 'warmup';
    } else if (step.type === 'cooldown') {
      cooldownSteps.push(step);
      phase = 'cooldown';
    } else {
      if (phase === 'cooldown') {
        cooldownSteps.push(step);
      } else {
        mainSteps.push(step);
        phase = 'main';
      }
    }
  }

  // Ajouter les steps d'échauffement
  for (const step of warmupSteps) {
    workoutSteps.push(createGarminStep(step, stepOrder++, workout.sport));
  }

  // Détecter les répétitions dans le corps de séance
  const repeatBlock = detectRepeatBlocks(mainSteps);

  if (repeatBlock && repeatBlock.repetitions >= 2) {
    // Créer un bloc de répétition
    const repeatSteps = repeatBlock.pattern.map((step, idx) =>
      createGarminStep(step, idx + 1, workout.sport)
    );

    workoutSteps.push({
      type: 'RepeatGroupDTO',
      stepId: null,
      stepOrder: stepOrder++,
      stepType: { stepTypeId: 6, stepTypeKey: 'repeat' },
      childStepId: 1,
      numberOfIterations: repeatBlock.repetitions,
      smartRepeat: false,
      endCondition: null,
      endConditionValue: null,
      preferredEndConditionUnit: null,
      endConditionCompare: null,
      endConditionZone: null,
      workoutSteps: repeatSteps,
    });

    // Ajouter les steps restants après les répétitions
    for (const step of repeatBlock.remainingSteps) {
      workoutSteps.push(createGarminStep(step, stepOrder++, workout.sport));
    }
  } else {
    // Pas de répétition détectée, ajouter tous les steps
    for (const step of mainSteps) {
      workoutSteps.push(createGarminStep(step, stepOrder++, workout.sport));
    }
  }

  // Ajouter les steps de retour au calme
  for (const step of cooldownSteps) {
    workoutSteps.push(createGarminStep(step, stepOrder++, workout.sport));
  }

  return {
    workoutId: null,
    ownerId: null,
    workoutName: workout.name,
    description: workout.description || '',
    sportType: sportType,
    subSportType: null,
    workoutSegments: [
      {
        segmentOrder: 1,
        sportType: sportType,
        workoutSteps: workoutSteps,
      },
    ],
    poolLength: null,
    poolLengthUnit: null,
    estimatedDurationInSecs: null,
    estimatedDistanceInMeters: null,
    estimatedDistanceUnit: null,
    workoutProvider: null,
    workoutSourceId: null,
    consumer: null,
    atpPlanId: null,
    trainingPlanId: null,
    author: null,
    sharedWithUsers: null,
    createdDate: null,
    updatedDate: null,
    avgTrainingSpeed: null,
    estimateType: null,
    estimatedDistanceStdDev: null,
    estimatedDurationStdDev: null,
    locale: null,
    uploadTimestamp: null,
  };
}

/**
 * Endpoint pour synchroniser un workout vers Garmin Connect
 */
app.post('/api/sync-garmin', async (req, res) => {
  const { email, password, workout } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email et mot de passe requis' });
  }

  if (!workout) {
    return res.status(400).json({ error: 'Workout requis' });
  }

  try {
    const client = new GarminConnect({
      username: email,
      password: password,
    });

    // Essayer de récupérer la session depuis le cache
    const cachedSession = getCachedSession(email);
    let connected = false;

    if (cachedSession) {
      try {
        console.log('Session trouvée en cache, tentative de restauration...');
        client.sessionJson = cachedSession;
        // Vérifier que la session est valide
        await client.getUserProfile();
        console.log('Session restaurée avec succès');
        connected = true;
      } catch (e) {
        console.log('Session invalide, nouveau login nécessaire:', e.message);
      }
    }

    if (!connected) {
      console.log('Connexion à Garmin Connect...');
      await client.login();
      console.log('Connecté à Garmin Connect');
    }

    // Mettre à jour la session en cache
    const newSession = client.sessionJson;
    if (newSession) {
      setCachedSession(email, newSession);
    }

    // Convertir au format Garmin
    const garminWorkout = convertToGarminFormat(workout);
    console.log('Workout converti:', JSON.stringify(garminWorkout, null, 2));

    // Créer le workout sur Garmin Connect
    const result = await client.addWorkout(garminWorkout);
    console.log('Workout créé:', result);

    // Planifier le workout à la date spécifiée
    if (workout.date && result?.workoutId) {
      const workoutDate = new Date(workout.date);

      try {
        // Utiliser la méthode scheduleWorkout de garmin-connect
        const scheduleResult = await client.scheduleWorkout({ workoutId: result.workoutId }, workoutDate);
        console.log('Workout planifié pour', workoutDate.toISOString().split('T')[0], ':', scheduleResult);
      } catch (scheduleError) {
        console.warn('Impossible de planifier:', scheduleError.message);
      }
    }

    res.json({
      success: true,
      message: 'Workout synchronisé avec Garmin Connect',
      workoutId: result?.workoutId,
    });
  } catch (error) {
    console.error('Erreur Garmin:', error);
    // Invalider le cache en cas d'erreur de connexion
    sessionCache.delete(email);
    res.status(500).json({
      error: error.message || 'Erreur lors de la synchronisation',
    });
  }
});

/**
 * Endpoint de test
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});
