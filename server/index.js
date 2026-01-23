/**
 * Backend server pour la synchro Garmin Connect
 * Utilise l'API non-officielle via garmin-connect
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import cookieParser from 'cookie-parser';
import pkg from 'garmin-connect';
const { GarminConnect } = pkg;

const app = express();
const PORT = process.env.PORT || 3001;

// Config Strava OAuth
const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID || '193301';
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const FRONTEND_URL = process.env.VITE_APP_URL || 'http://localhost:5173';
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000', 'https://enduzo.com'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

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
  other: { stepTypeId: 7, stepTypeKey: 'other' },
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
    description: step.notes || step.name,
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

// ============================================
// STRAVA OAUTH ENDPOINTS
// ============================================

/**
 * Démarre le flux OAuth Strava
 * Redirige l'utilisateur vers Strava pour autorisation
 */
app.get('/api/strava/auth', (req, res) => {
  if (!STRAVA_CLIENT_SECRET) {
    return res.status(500).json({ error: 'STRAVA_CLIENT_SECRET non configuré' });
  }

  const redirectUri = `${req.protocol}://${req.get('host')}/api/strava/callback`;
  const scope = 'activity:read_all,profile:read_all';

  const authUrl = `${STRAVA_AUTH_URL}?` + new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scope,
    approval_prompt: 'auto', // 'force' pour toujours demander
  });

  console.log('Redirection OAuth Strava:', authUrl);
  res.redirect(authUrl);
});

/**
 * Callback OAuth Strava
 * Échange le code contre un access_token
 */
app.get('/api/strava/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    console.error('Erreur OAuth Strava:', error);
    return res.redirect(`${FRONTEND_URL}/coach?strava_error=${error}`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/coach?strava_error=no_code`);
  }

  try {
    const redirectUri = `${req.protocol}://${req.get('host')}/api/strava/callback`;

    // Échanger le code contre un token
    const tokenResponse = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erreur token Strava:', errorText);
      return res.redirect(`${FRONTEND_URL}/coach?strava_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Token Strava reçu pour:', tokenData.athlete?.firstname);

    // Rediriger vers le frontend avec les tokens encodés
    // Note: En production, utiliser un state/session plutôt que passer les tokens en URL
    const params = new URLSearchParams({
      strava_connected: 'true',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete_id: tokenData.athlete?.id,
      athlete_name: `${tokenData.athlete?.firstname || ''} ${tokenData.athlete?.lastname || ''}`.trim(),
    });

    res.redirect(`${FRONTEND_URL}/coach?${params}`);
  } catch (err) {
    console.error('Erreur callback Strava:', err);
    res.redirect(`${FRONTEND_URL}/coach?strava_error=server_error`);
  }
});

/**
 * Rafraîchir le token Strava
 */
app.post('/api/strava/refresh', async (req, res) => {
  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token requis' });
  }

  try {
    const tokenResponse = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erreur refresh Strava:', errorText);
      return res.status(401).json({ error: 'Token refresh failed' });
    }

    const tokenData = await tokenResponse.json();
    res.json({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
    });
  } catch (err) {
    console.error('Erreur refresh Strava:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * Récupérer les activités Strava
 */
app.get('/api/strava/activities', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requis' });
  }

  const accessToken = authHeader.split(' ')[1];
  const { page = 1, per_page = 30, after, before } = req.query;

  try {
    const params = new URLSearchParams({
      page: page.toString(),
      per_page: per_page.toString(),
    });
    if (after) params.append('after', after);
    if (before) params.append('before', before);

    const response = await fetch(`${STRAVA_API_URL}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token expiré', needsRefresh: true });
      }
      throw new Error(`Strava API error: ${response.status}`);
    }

    const activities = await response.json();
    res.json(activities);
  } catch (err) {
    console.error('Erreur activités Strava:', err);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

/**
 * Récupérer le profil de l'athlète Strava
 */
app.get('/api/strava/athlete', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requis' });
  }

  const accessToken = authHeader.split(' ')[1];

  try {
    const response = await fetch(`${STRAVA_API_URL}/athlete`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token expiré', needsRefresh: true });
      }
      throw new Error(`Strava API error: ${response.status}`);
    }

    const athlete = await response.json();
    res.json(athlete);
  } catch (err) {
    console.error('Erreur profil Strava:', err);
    res.status(500).json({ error: 'Failed to fetch athlete profile' });
  }
});

/**
 * Récupérer les zones de l'athlète (FC et puissance)
 */
app.get('/api/strava/athlete/zones', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requis' });
  }

  const accessToken = authHeader.split(' ')[1];

  try {
    const response = await fetch(`${STRAVA_API_URL}/athlete/zones`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Strava zones API error: ${response.status}`, errorText);

      if (response.status === 401) {
        return res.status(401).json({ error: 'Token expiré', needsRefresh: true });
      }
      if (response.status === 403) {
        return res.status(403).json({ error: 'Accès refusé. Re-connecte Strava pour autoriser l\'accès aux zones.' });
      }
      return res.status(response.status).json({ error: `Erreur Strava: ${response.status}` });
    }

    const zones = await response.json();
    console.log('Zones Strava récupérées:', JSON.stringify(zones));
    res.json(zones);
  } catch (err) {
    console.error('Erreur zones Strava:', err);
    res.status(500).json({ error: 'Failed to fetch athlete zones' });
  }
});

/**
 * Récupérer les détails d'une activité Strava
 */
app.get('/api/strava/activities/:id', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requis' });
  }

  const accessToken = authHeader.split(' ')[1];
  const { id } = req.params;

  try {
    const response = await fetch(`${STRAVA_API_URL}/activities/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token expiré', needsRefresh: true });
      }
      throw new Error(`Strava API error: ${response.status}`);
    }

    const activity = await response.json();
    res.json(activity);
  } catch (err) {
    console.error('Erreur détails activité Strava:', err);
    res.status(500).json({ error: 'Failed to fetch activity details' });
  }
});

/**
 * Récupérer les streams d'une activité (données seconde par seconde)
 */
app.get('/api/strava/activities/:id/streams', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requis' });
  }

  const accessToken = authHeader.split(' ')[1];
  const { id } = req.params;

  try {
    // Récupérer tous les types de streams disponibles
    const streamTypes = [
      'time', 'distance', 'latlng', 'altitude', 'velocity_smooth',
      'heartrate', 'cadence', 'watts', 'temp', 'moving', 'grade_smooth'
    ].join(',');

    const response = await fetch(
      `${STRAVA_API_URL}/activities/${id}/streams?keys=${streamTypes}&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token expiré', needsRefresh: true });
      }
      // 404 = pas de streams (activité manuelle)
      if (response.status === 404) {
        return res.json({});
      }
      throw new Error(`Strava API error: ${response.status}`);
    }

    const streams = await response.json();
    res.json(streams);
  } catch (err) {
    console.error('Erreur streams Strava:', err);
    res.status(500).json({ error: 'Failed to fetch activity streams' });
  }
});

/**
 * Récupérer les laps/splits d'une activité
 */
app.get('/api/strava/activities/:id/laps', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requis' });
  }

  const accessToken = authHeader.split(' ')[1];
  const { id } = req.params;

  try {
    const response = await fetch(`${STRAVA_API_URL}/activities/${id}/laps`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token expiré', needsRefresh: true });
      }
      throw new Error(`Strava API error: ${response.status}`);
    }

    const laps = await response.json();
    res.json(laps);
  } catch (err) {
    console.error('Erreur laps Strava:', err);
    res.status(500).json({ error: 'Failed to fetch activity laps' });
  }
});

// ============================================
// GARMIN OAUTH2 PKCE ENDPOINTS (API officielle)
// ============================================

// Config Garmin OAuth
const GARMIN_CLIENT_ID = process.env.GARMIN_CLIENT_ID;
const GARMIN_CLIENT_SECRET = process.env.GARMIN_CLIENT_SECRET;
const GARMIN_AUTH_URL = 'https://connect.garmin.com/oauth2Confirm';
const GARMIN_TOKEN_URL = 'https://diauth.garmin.com/di-oauth2-service/oauth/token';
const GARMIN_WORKOUT_API = 'https://apis.garmin.com/workoutportal/workout/v2';
const GARMIN_SCHEDULE_API = 'https://apis.garmin.com/training-api/schedule/';

// Stockage en mémoire des tokens Garmin (pour le dev local)
const garminTokensCache = new Map();

// Génère un code verifier pour PKCE
function generateCodeVerifier() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let verifier = '';
  const randomBytes = crypto.randomBytes(64);
  for (let i = 0; i < 64; i++) {
    verifier += chars[randomBytes[i] % chars.length];
  }
  return verifier;
}

// Génère le code challenge (SHA-256 + base64url)
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

/**
 * Démarre le flux OAuth Garmin (PKCE)
 */
app.get('/api/garmin/auth', (req, res) => {
  if (!GARMIN_CLIENT_ID) {
    return res.status(500).json({ error: 'GARMIN_CLIENT_ID non configuré' });
  }

  const redirectUri = `http://localhost:${PORT}/api/garmin/callback`;
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = crypto.randomBytes(32).toString('base64url');

  // Stocker le code_verifier dans un cookie
  res.cookie('garmin_code_verifier', codeVerifier, {
    httpOnly: true,
    maxAge: 600000, // 10 minutes
    sameSite: 'lax'
  });
  res.cookie('garmin_oauth_state', state, {
    httpOnly: true,
    maxAge: 600000,
    sameSite: 'lax'
  });

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: GARMIN_CLIENT_ID,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    state: state
  });

  const authUrl = `${GARMIN_AUTH_URL}?${params.toString()}`;
  console.log('Redirection OAuth Garmin:', authUrl);
  res.redirect(authUrl);
});

/**
 * Callback OAuth Garmin
 */
app.get('/api/garmin/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('Erreur OAuth Garmin:', error, error_description);
    return res.redirect(`${FRONTEND_URL}?garmin_error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}?garmin_error=no_code`);
  }

  const codeVerifier = req.cookies.garmin_code_verifier;
  const storedState = req.cookies.garmin_oauth_state;

  if (!codeVerifier) {
    return res.redirect(`${FRONTEND_URL}?garmin_error=session_expired`);
  }

  if (state !== storedState) {
    return res.redirect(`${FRONTEND_URL}?garmin_error=invalid_state`);
  }

  const redirectUri = `http://localhost:${PORT}/api/garmin/callback`;

  try {
    // Échanger le code contre des tokens
    const tokenResponse = await fetch(GARMIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: GARMIN_CLIENT_ID,
        client_secret: GARMIN_CLIENT_SECRET,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Erreur token Garmin:', tokenResponse.status, errorText);
      return res.redirect(`${FRONTEND_URL}?garmin_error=token_exchange_failed`);
    }

    const tokens = await tokenResponse.json();
    console.log('Tokens Garmin reçus:', { hasAccessToken: !!tokens.access_token, expiresIn: tokens.expires_in });

    // Récupérer l'ID utilisateur Garmin
    let garminUserId = null;
    try {
      const userResponse = await fetch('https://apis.garmin.com/wellness-api/rest/user/id', {
        headers: { 'Authorization': `Bearer ${tokens.access_token}` }
      });
      if (userResponse.ok) {
        const userData = await userResponse.json();
        garminUserId = userData.userId;
        console.log('Garmin User ID:', garminUserId);
      }
    } catch (e) {
      console.warn('Impossible de récupérer le user ID Garmin:', e.message);
      garminUserId = 'local_user_' + Date.now();
    }

    // Stocker les tokens en mémoire
    garminTokensCache.set(garminUserId, {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: Date.now() + (tokens.expires_in - 600) * 1000,
      refresh_token_expires_at: Date.now() + (tokens.refresh_token_expires_in - 600) * 1000
    });

    // Effacer les cookies PKCE
    res.clearCookie('garmin_code_verifier');
    res.clearCookie('garmin_oauth_state');

    // Créer un cookie de session
    const sessionData = { garminUserId, connectedAt: Date.now() };
    res.cookie('garmin_session', Buffer.from(JSON.stringify(sessionData)).toString('base64'), {
      httpOnly: true,
      maxAge: tokens.refresh_token_expires_in * 1000,
      sameSite: 'lax'
    });

    res.redirect(`${FRONTEND_URL}?garmin_connected=true`);
  } catch (err) {
    console.error('Erreur callback Garmin:', err);
    res.redirect(`${FRONTEND_URL}?garmin_error=server_error`);
  }
});

/**
 * Statut de connexion Garmin
 */
app.get('/api/garmin/status', (req, res) => {
  const sessionCookie = req.cookies.garmin_session;

  if (!sessionCookie) {
    return res.json({ connected: false, reason: 'no_session' });
  }

  try {
    const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString());
    const { garminUserId } = session;

    if (!garminUserId) {
      return res.json({ connected: false, reason: 'no_user_id' });
    }

    const tokenData = garminTokensCache.get(garminUserId);
    if (!tokenData) {
      return res.json({ connected: false, reason: 'tokens_not_found' });
    }

    const now = Date.now();
    const accessTokenValid = tokenData.expires_at && now < tokenData.expires_at;
    const refreshTokenValid = tokenData.refresh_token_expires_at && now < tokenData.refresh_token_expires_at;

    if (!refreshTokenValid) {
      return res.json({ connected: false, reason: 'refresh_token_expired' });
    }

    res.json({
      connected: true,
      garminUserId,
      connectedAt: session.connectedAt,
      accessTokenValid,
      needsRefresh: !accessTokenValid
    });
  } catch (e) {
    res.json({ connected: false, reason: 'invalid_session' });
  }
});

/**
 * Déconnexion Garmin
 */
app.post('/api/garmin/disconnect', (req, res) => {
  const sessionCookie = req.cookies.garmin_session;

  if (sessionCookie) {
    try {
      const session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString());
      if (session.garminUserId) {
        garminTokensCache.delete(session.garminUserId);
      }
    } catch (e) {}
  }

  res.clearCookie('garmin_session');
  res.json({ success: true, message: 'Disconnected from Garmin' });
});

/**
 * Récupère un access token valide (refresh si nécessaire)
 */
async function getValidGarminToken(garminUserId) {
  const tokenData = garminTokensCache.get(garminUserId);
  if (!tokenData) {
    throw new Error('No tokens found. Please reconnect to Garmin.');
  }

  // Token encore valide ?
  if (tokenData.expires_at && Date.now() < tokenData.expires_at) {
    return tokenData.access_token;
  }

  // Besoin de refresh
  console.log('Refreshing Garmin token...');
  const tokenResponse = await fetch(GARMIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: GARMIN_CLIENT_ID,
      client_secret: GARMIN_CLIENT_SECRET,
      refresh_token: tokenData.refresh_token
    }).toString()
  });

  if (!tokenResponse.ok) {
    garminTokensCache.delete(garminUserId);
    throw new Error('Token refresh failed. Please reconnect to Garmin.');
  }

  const newTokens = await tokenResponse.json();

  garminTokensCache.set(garminUserId, {
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token,
    expires_at: Date.now() + (newTokens.expires_in - 600) * 1000,
    refresh_token_expires_at: Date.now() + (newTokens.refresh_token_expires_in - 600) * 1000
  });

  return newTokens.access_token;
}

/**
 * Convertit un workout au format Garmin Training API V2
 */
function convertToGarminApiV2Format(workout) {
  const sportMap = { running: 'RUNNING', cycling: 'CYCLING', swimming: 'LAP_SWIMMING' };
  const sport = sportMap[workout.sport] || 'RUNNING';

  let stepOrder = 0;
  const steps = [];

  for (const step of workout.steps) {
    stepOrder++;
    const garminStep = buildGarminApiV2Step(step, stepOrder, sport);
    if (garminStep) {
      if (garminStep.type === 'WorkoutRepeatStep' && garminStep.steps) {
        garminStep.steps.forEach((s, i) => { s.stepOrder = stepOrder + i + 1; });
        stepOrder += garminStep.steps.length;
      }
      steps.push(garminStep);
    }
  }

  const garminWorkout = {
    workoutName: workout.name || 'Enduzo Workout',
    description: workout.description || 'Created with Enduzo',
    sport: sport,
    workoutProvider: 'Enduzo',
    workoutSourceId: 'Enduzo',
    isSessionTransitionEnabled: false,
    segments: [{
      segmentOrder: 1,
      sport: sport,
      poolLength: sport === 'LAP_SWIMMING' ? (workout.poolLength || 25) : null,
      poolLengthUnit: sport === 'LAP_SWIMMING' ? 'METER' : null,
      steps: steps
    }]
  };

  if (sport === 'LAP_SWIMMING') {
    garminWorkout.poolLength = workout.poolLength || 25;
    garminWorkout.poolLengthUnit = 'METER';
  }

  return garminWorkout;
}

function buildGarminApiV2Step(step, stepOrder, sport) {
  const intensityMap = {
    warmup: 'WARMUP', cooldown: 'COOLDOWN', active: 'ACTIVE',
    recovery: 'RECOVERY', rest: 'REST', interval: 'INTERVAL'
  };
  const intensity = intensityMap[step.type] || 'ACTIVE';

  // Handle repeat steps
  if (step.type === 'repeat' && step.steps) {
    const nestedSteps = step.steps.map((s, i) => buildGarminApiV2Step(s, i + 1, sport));
    return {
      type: 'WorkoutRepeatStep',
      stepOrder,
      repeatType: 'REPEAT_UNTIL_STEPS_CMPLT',
      repeatValue: step.iterations || 1,
      steps: nestedSteps.filter(Boolean)
    };
  }

  let durationType = 'OPEN', durationValue = null, durationValueType = null;
  if (step.duration) {
    if (step.duration.type === 'time') {
      durationType = 'TIME';
      durationValue = step.duration.value;
    } else if (step.duration.type === 'distance') {
      durationType = 'DISTANCE';
      durationValue = step.duration.value;
      durationValueType = 'METER';
    }
  }

  let targetType = 'OPEN', targetValueLow = null, targetValueHigh = null;
  const details = step.details || {};

  if (sport === 'RUNNING' && details.paceMinKm) {
    targetType = 'PACE';
    if (details.paceMinKm.low) targetValueHigh = 1000 / (details.paceMinKm.low * 60);
    if (details.paceMinKm.high) targetValueLow = 1000 / (details.paceMinKm.high * 60);
  } else if (sport === 'CYCLING') {
    if (details.watts) {
      targetType = 'POWER';
      targetValueLow = details.watts.low;
      targetValueHigh = details.watts.high;
    }
  }

  return {
    type: 'WorkoutStep',
    stepOrder,
    intensity,
    description: step.notes || null,
    durationType,
    durationValue,
    durationValueType,
    targetType: targetType === 'OPEN' ? 'OPEN' : targetType,
    targetValue: null,
    targetValueLow,
    targetValueHigh,
    targetValueType: null,
    secondaryTargetType: null,
    secondaryTargetValue: null,
    secondaryTargetValueLow: null,
    secondaryTargetValueHigh: null,
    secondaryTargetValueType: null,
    strokeType: null,
    drillType: null,
    equipmentType: null,
    exerciseCategory: null,
    exerciseName: null,
    weightValue: null,
    weightDisplayUnit: null
  };
}

/**
 * Sync workout vers Garmin (API officielle V2)
 */
app.post('/api/garmin/sync-workout', async (req, res) => {
  const { workout, scheduleDate } = req.body;

  if (!workout) {
    return res.status(400).json({ error: 'Workout data is required' });
  }

  const sessionCookie = req.cookies.garmin_session;
  if (!sessionCookie) {
    return res.status(401).json({ error: 'Not connected to Garmin. Please connect first.' });
  }

  let session;
  try {
    session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString());
  } catch (e) {
    return res.status(401).json({ error: 'Invalid session. Please reconnect to Garmin.' });
  }

  const { garminUserId } = session;
  if (!garminUserId) {
    return res.status(401).json({ error: 'No Garmin user ID. Please reconnect.' });
  }

  try {
    const accessToken = await getValidGarminToken(garminUserId);
    const garminWorkout = convertToGarminApiV2Format(workout);

    console.log('Creating Garmin workout (API V2):', JSON.stringify(garminWorkout, null, 2));

    const createResponse = await fetch(GARMIN_WORKOUT_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(garminWorkout)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Garmin create workout failed:', createResponse.status, errorText);
      if (createResponse.status === 401) {
        return res.status(401).json({ error: 'Session expired. Please reconnect to Garmin.' });
      }
      return res.status(500).json({ error: 'Failed to create workout', details: errorText });
    }

    const createdWorkout = await createResponse.json();
    console.log('Workout created:', createdWorkout.workoutId);

    let scheduleResult = null;
    if (scheduleDate && createdWorkout.workoutId) {
      try {
        const scheduleResponse = await fetch(GARMIN_SCHEDULE_API, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ workoutId: createdWorkout.workoutId, date: scheduleDate })
        });
        if (scheduleResponse.ok) {
          scheduleResult = await scheduleResponse.json();
          console.log('Workout scheduled:', scheduleResult);
        }
      } catch (e) {
        console.warn('Failed to schedule workout:', e.message);
      }
    }

    res.json({
      success: true,
      message: scheduleResult ? 'Workout created and scheduled' : 'Workout created',
      workoutId: createdWorkout.workoutId,
      scheduled: !!scheduleResult
    });
  } catch (error) {
    console.error('Garmin sync error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// ============================================
// AI (GROQ) PROXY ENDPOINT
// ============================================

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_API_KEYS = [
  process.env.VITE_GROQ_API_KEY,
  process.env.VITE_GROQ_API_KEY_2,
].filter(Boolean);

let currentGroqKeyIndex = 0;

function getNextGroqApiKey() {
  if (GROQ_API_KEYS.length === 0) {
    throw new Error('Aucune clé API Groq configurée');
  }
  const key = GROQ_API_KEYS[currentGroqKeyIndex];
  currentGroqKeyIndex = (currentGroqKeyIndex + 1) % GROQ_API_KEYS.length;
  return key;
}

/**
 * Proxy pour l'API Groq (évite les problèmes CORS)
 */
app.post('/api/ai/chat', async (req, res) => {
  const { messages, model = 'llama-3.3-70b-versatile' } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Messages requis' });
  }

  try {
    const apiKey = getNextGroqApiKey();

    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Erreur Groq API:', error);
      return res.status(response.status).json({ error: `Groq API error: ${response.status}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Erreur proxy AI:', err);
    res.status(500).json({ error: 'Erreur serveur AI' });
  }
});

app.listen(PORT, () => {
  console.log(`Serveur backend démarré sur http://localhost:${PORT}`);
});
