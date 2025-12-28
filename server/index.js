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
  swimming: { sportTypeId: 4, sportTypeKey: 'swimming' },
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

// Mapping des types de nage (natation)
const STROKE_TYPE_MAP = {
  free: { strokeTypeId: 6, strokeTypeKey: 'free' },
  backstroke: { strokeTypeId: 2, strokeTypeKey: 'backstroke' },
  breaststroke: { strokeTypeId: 3, strokeTypeKey: 'breaststroke' },
  fly: { strokeTypeId: 5, strokeTypeKey: 'fly' },
  im: { strokeTypeId: 4, strokeTypeKey: 'im' },
  rimo: { strokeTypeId: 7, strokeTypeKey: 'rimo' },
  choice: { strokeTypeId: 1, strokeTypeKey: 'any_stroke' },
  mixed: { strokeTypeId: 0, strokeTypeKey: 'mixed' },
};

// Mapping des équipements natation
const EQUIPMENT_TYPE_MAP = {
  fins: { equipmentTypeId: 1, equipmentTypeKey: 'fins' },
  kickboard: { equipmentTypeId: 2, equipmentTypeKey: 'kickboard' },
  paddles: { equipmentTypeId: 3, equipmentTypeKey: 'paddles' },
  pull_buoy: { equipmentTypeId: 4, equipmentTypeKey: 'pull_buoy' },
  snorkel: { equipmentTypeId: 5, equipmentTypeKey: 'snorkel' },
};

// Mapping des types d'exercices natation
const DRILL_TYPE_MAP = {
  kick: { drillTypeId: 1, drillTypeKey: 'kick', displayOrder: 1 },
  pull: { drillTypeId: 2, drillTypeKey: 'pull', displayOrder: 2 },
  drill: { drillTypeId: 3, drillTypeKey: 'drill', displayOrder: 3 },
};

// Mapping des niveaux d'intensité natation (workoutSwimInstructionTypes)
// Target type 18 = swim.instruction avec instructionTypeId
const SWIM_INTENSITY_TARGET_MAP = {
  recovery: { instructionTypeId: 1 },    // Récupération
  easy: { instructionTypeId: 3 },        // Facile (very_easy=2, easy=3)
  moderate: { instructionTypeId: 4 },    // Modéré
  hard: { instructionTypeId: 5 },        // Difficile
  very_hard: { instructionTypeId: 6 },   // Très difficile
  maximum: { instructionTypeId: 7 },     // Maximum
};

// Mapping exerciseName pour les nages (type d'exercice en plus du stroke)
const SWIM_EXERCISE_NAME_MAP = {
  free: 'SWIMMING_FREESTYLE',
  backstroke: 'SWIMMING_BACKSTROKE',
  breaststroke: 'SWIMMING_BREASTSTROKE',
  fly: 'SWIMMING_BUTTERFLY',
  im: 'SWIMMING_IM',
  mixed: 'SWIMMING_MIXED',
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
    drillType: null,
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

  // Ajouter les paramètres vélo
  if (sport === 'cycling') {
    // Puissance en watts absolus
    if (step.details?.watts) {
      const { low, high } = step.details.watts;
      garminStep.targetType = { workoutTargetTypeId: 2, workoutTargetTypeKey: 'power.zone' };
      garminStep.targetValueOne = low;
      garminStep.targetValueTwo = high;
    }

    // Puissance en % FTP (convertir en watts si FTP connu - on utilise 200W par défaut)
    if (step.details?.powerPercent) {
      const ftp = 200; // TODO: récupérer depuis les settings utilisateur
      const { low, high } = step.details.powerPercent;
      const wattsLow = Math.round(ftp * low / 100);
      const wattsHigh = Math.round(ftp * high / 100);
      garminStep.targetType = { workoutTargetTypeId: 2, workoutTargetTypeKey: 'power.zone' };
      garminStep.targetValueOne = wattsLow;
      garminStep.targetValueTwo = wattsHigh;
    }

    // Cadence (RPM)
    if (step.details?.cadence) {
      const cadenceValue = step.details.cadence;
      // Si on a déjà une cible de puissance, la cadence va en secondaryTarget
      if (step.details?.powerPercent || step.details?.watts) {
        garminStep.secondaryTargetType = { workoutTargetTypeId: 3, workoutTargetTypeKey: 'cadence' };
        garminStep.secondaryTargetValueOne = cadenceValue;
        garminStep.secondaryTargetValueTwo = cadenceValue;
      } else {
        // Sinon la cadence est la cible principale
        garminStep.targetType = { workoutTargetTypeId: 3, workoutTargetTypeKey: 'cadence' };
        garminStep.targetValueOne = cadenceValue;
        garminStep.targetValueTwo = cadenceValue;
      }
    }
  }

  // Ajouter les paramètres natation
  if (sport === 'swimming') {
    // Type de nage (strokeType)
    if (step.details?.swimStroke) {
      const strokeType = STROKE_TYPE_MAP[step.details.swimStroke];
      if (strokeType) {
        garminStep.strokeType = strokeType;
      }
      // Ajouter aussi exerciseName pour les nages non-crawl
      const exerciseName = SWIM_EXERCISE_NAME_MAP[step.details.swimStroke];
      if (exerciseName && step.details.swimStroke !== 'free') {
        garminStep.exerciseName = exerciseName;
      }
    }

    // Équipement (prendre le premier si plusieurs)
    if (step.details?.swimEquipment && step.details.swimEquipment.length > 0) {
      const equipment = EQUIPMENT_TYPE_MAP[step.details.swimEquipment[0]];
      if (equipment) {
        garminStep.equipmentType = equipment;
      }
    }

    // Type d'exercice (drill) - utilise drillType
    if (step.details?.swimDrill) {
      const drill = DRILL_TYPE_MAP[step.details.swimDrill];
      if (drill) {
        garminStep.drillType = drill;
      }
    }

    // Intensité natation (objectif d'intensité basé sur swim.instruction)
    if (step.details?.swimIntensity) {
      const intensityTarget = SWIM_INTENSITY_TARGET_MAP[step.details.swimIntensity];
      if (intensityTarget) {
        // Utiliser swim.instruction avec secondaryTargetType + secondaryTargetValueOne
        garminStep.targetType = { workoutTargetTypeId: 18, workoutTargetTypeKey: 'swim.instruction' };
        garminStep.secondaryTargetType = { workoutTargetTypeId: 18, workoutTargetTypeKey: 'swim.instruction' };
        garminStep.secondaryTargetValueOne = intensityTarget.instructionTypeId;
        garminStep.secondaryTargetValueTwo = 0;
      }
      // Aussi ajouter le label dans la description pour plus de clarté
      const intensityLabels = {
        recovery: 'Récupération',
        easy: 'Facile',
        moderate: 'Modéré',
        hard: 'Difficile',
        very_hard: 'Très difficile',
        maximum: 'Maximum',
        ascending: 'Progressif',
        descending: 'Décroissant',
      };
      const intensityLabel = intensityLabels[step.details.swimIntensity];
      if (intensityLabel && !garminStep.description?.includes(intensityLabel)) {
        garminStep.description = garminStep.description
          ? `${garminStep.description} - ${intensityLabel}`
          : intensityLabel;
      }
    }

    // Allure natation (swimPaceMin100m)
    if (step.details?.swimPaceMin100m) {
      const { low, high } = step.details.swimPaceMin100m;
      // Convertir min/100m en m/s : vitesse = 100m / (pace en secondes)
      const speedLow = 100 / (low * 60);  // allure lente = vitesse basse
      const speedHigh = 100 / (high * 60); // allure rapide = vitesse haute

      // Garmin utilise targetType + secondaryTargetType pour l'allure
      garminStep.targetType = { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' };
      garminStep.targetValueOne = speedLow;
      garminStep.targetValueTwo = speedHigh;
      garminStep.secondaryTargetType = { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' };
      garminStep.secondaryTargetValueOne = speedLow;
      garminStep.secondaryTargetValueTwo = null;
    }

    // Notes additionnelles
    if (step.details?.swimNotes) {
      garminStep.description = garminStep.description
        ? `${garminStep.description} | ${step.details.swimNotes}`
        : step.details.swimNotes;
    }
  }

  return garminStep;
}

/**
 * Compare deux steps pour voir s'ils sont similaires
 */
function stepsAreSimilar(a, b) {
  if (a.type !== b.type) return false;
  if (a.duration?.type !== b.duration?.type) return false;
  if (a.duration?.value !== b.duration?.value) return false;

  // Vérifications vélo - si différent, PAS similaire
  if (a.details?.cadence !== b.details?.cadence) return false;
  if (a.details?.powerPercent?.low !== b.details?.powerPercent?.low) return false;
  if (a.details?.powerPercent?.high !== b.details?.powerPercent?.high) return false;
  if (a.details?.watts?.low !== b.details?.watts?.low) return false;
  if (a.details?.watts?.high !== b.details?.watts?.high) return false;

  // Vérifications natation - si différent, PAS similaire
  if (a.details?.swimStroke !== b.details?.swimStroke) return false;
  if (a.details?.swimDrill !== b.details?.swimDrill) return false;
  if (a.details?.swimIntensity !== b.details?.swimIntensity) return false;

  // Vérifier les équipements (tableaux)
  const aEquip = (a.details?.swimEquipment || []).sort().join(',');
  const bEquip = (b.details?.swimEquipment || []).sort().join(',');
  if (aEquip !== bEquip) return false;

  return true;
}

/**
 * Trouve UN bloc de répétition dans les steps à partir d'une position
 */
function findRepeatBlock(steps, fromPos = 0) {
  if (steps.length - fromPos < 2) return null;

  let bestResult = null;

  for (let startPos = fromPos; startPos < steps.length - 1; startPos++) {
    for (let patternLen = 1; patternLen <= 3; patternLen++) {
      if (startPos + patternLen * 2 > steps.length) continue;

      const pattern = steps.slice(startPos, startPos + patternLen);
      let repetitions = 1;
      let endPos = startPos + patternLen;

      while (endPos + patternLen <= steps.length) {
        const nextBlock = steps.slice(endPos, endPos + patternLen);
        const isMatch = pattern.every((step, idx) => stepsAreSimilar(step, nextBlock[idx]));

        if (isMatch) {
          repetitions++;
          endPos += patternLen;
        } else {
          break;
        }
      }

      // Au moins 2 répétitions pour être valide
      if (repetitions >= 2) {
        // Priorité aux patterns qui commencent plus tôt, puis au score
        if (!bestResult || startPos < bestResult.startPos ||
            (startPos === bestResult.startPos && repetitions * patternLen > bestResult.score)) {
          bestResult = {
            startPos,
            pattern,
            repetitions,
            endPos,
            score: repetitions * patternLen
          };
        }
      }
    }
  }

  return bestResult;
}

/**
 * Détecte TOUS les blocs de répétition dans les steps
 * Retourne un tableau d'éléments (steps simples ou blocs répétés)
 */
function detectAllRepeatBlocks(steps) {
  console.log('detectAllRepeatBlocks - nombre de steps:', steps.length);
  if (steps.length < 2) {
    console.log('Pas assez de steps pour détecter des répétitions');
    return null;
  }

  const result = [];
  let currentPos = 0;

  while (currentPos < steps.length) {
    const block = findRepeatBlock(steps, currentPos);

    if (block && block.startPos === currentPos) {
      // On a trouvé un bloc de répétition qui commence à la position actuelle
      console.log(`Pattern trouvé à position ${block.startPos}: ${block.repetitions}x${block.pattern.length} steps`);
      console.log('Pattern:', block.pattern.map(s => `${s.duration?.value}m ${s.type}`));

      result.push({
        type: 'repeat',
        pattern: block.pattern,
        repetitions: block.repetitions
      });
      currentPos = block.endPos;
    } else if (block) {
      // Il y a des steps simples avant le prochain bloc
      const simpleSteps = steps.slice(currentPos, block.startPos);
      for (const step of simpleSteps) {
        result.push({ type: 'single', step });
      }
      currentPos = block.startPos;
    } else {
      // Pas de bloc trouvé, ajouter les steps restants comme simples
      for (let i = currentPos; i < steps.length; i++) {
        result.push({ type: 'single', step: steps[i] });
      }
      break;
    }
  }

  console.log('Résultat détection:', result.map(r => r.type === 'repeat' ? `${r.repetitions}x` : 'single').join(', '));
  return result.length > 0 ? result : null;
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

  // Détecter TOUS les blocs de répétition dans le corps de séance
  const blocks = detectAllRepeatBlocks(mainSteps);

  if (blocks) {
    for (const block of blocks) {
      if (block.type === 'repeat') {
        // Créer un bloc de répétition Garmin
        const repeatSteps = block.pattern.map((step, idx) =>
          createGarminStep(step, idx + 1, workout.sport)
        );

        workoutSteps.push({
          type: 'RepeatGroupDTO',
          stepId: null,
          stepOrder: stepOrder++,
          stepType: { stepTypeId: 6, stepTypeKey: 'repeat' },
          childStepId: 1,
          numberOfIterations: block.repetitions,
          smartRepeat: false,
          endCondition: null,
          endConditionValue: null,
          preferredEndConditionUnit: null,
          endConditionCompare: null,
          endConditionZone: null,
          workoutSteps: repeatSteps,
        });
      } else {
        // Step simple
        workoutSteps.push(createGarminStep(block.step, stepOrder++, workout.sport));
      }
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
    let scheduled = false;
    let scheduleError = null;

    if (workout.date && result?.workoutId) {
      const workoutDate = new Date(workout.date);
      const dateString = workoutDate.toISOString().split('T')[0]; // YYYY-MM-DD
      console.log('Tentative de planification pour:', dateString);

      try {
        console.log('Planification du workout', result.workoutId, 'pour', dateString);
        // POST vers l'API de scheduling
        const scheduleUrl = `https://connect.garmin.com/gc-api/workout-service/schedule/${result.workoutId}`;
        const scheduleResult = await client.post(scheduleUrl, { date: dateString });
        console.log('Workout planifié avec succès:', JSON.stringify(scheduleResult));
        scheduled = true;
      } catch (err) {
        console.error('Erreur planification:', err);
        scheduleError = err.message;
      }
    }

    res.json({
      success: true,
      message: scheduled
        ? 'Workout synchronisé et planifié avec Garmin Connect'
        : 'Workout synchronisé avec Garmin Connect (planification: ' + (scheduleError || 'pas de date') + ')',
      workoutId: result?.workoutId,
      scheduled,
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
