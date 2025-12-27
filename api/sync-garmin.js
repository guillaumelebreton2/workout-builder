/**
 * Vercel Serverless Function pour la synchro Garmin Connect
 */

import pkg from 'garmin-connect';
const { GarminConnect } = pkg;
import { Redis } from '@upstash/redis';

// Durée du cache de session : 1 heure
const SESSION_TTL = 60 * 60;

// Vérifier la configuration Redis
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redisConfigured = !!(redisUrl && redisToken);
if (!redisConfigured) {
  console.warn('⚠️ Redis non configuré: UPSTASH_REDIS_REST_URL ou UPSTASH_REDIS_REST_TOKEN manquant');
}

// Initialiser Redis seulement si configuré
const redis = redisConfigured
  ? new Redis({ url: redisUrl, token: redisToken })
  : null;

// Créer une clé unique pour le cache basée sur l'email
function getSessionKey(email) {
  return `garmin_session_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

// Récupérer la session depuis le cache
async function getCachedSession(email) {
  if (!redis) {
    console.log('Redis non disponible, pas de cache');
    return null;
  }
  try {
    const key = getSessionKey(email);
    console.log('Recherche session en cache:', key);
    const session = await redis.get(key);
    if (session) {
      console.log('Session Garmin trouvée en cache pour', email);
      // Si c'est une string, parser le JSON
      return typeof session === 'string' ? JSON.parse(session) : session;
    }
    console.log('Pas de session en cache pour', email);
  } catch (error) {
    console.warn('Erreur lecture cache Redis:', error.message);
  }
  return null;
}

// Sauvegarder la session dans le cache
async function setCachedSession(email, tokens) {
  if (!redis) {
    console.log('Redis non disponible, session non mise en cache');
    return;
  }
  try {
    const key = getSessionKey(email);
    await redis.set(key, JSON.stringify(tokens), { ex: SESSION_TTL });
    console.log('Session Garmin mise en cache pour', email, '(TTL:', SESSION_TTL, 's)');
  } catch (error) {
    console.warn('Erreur écriture cache Redis:', error.message);
  }
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
    garminStep.endConditionValue = step.duration.value;
    garminStep.preferredEndConditionUnit = { unitId: 2, unitKey: 'second' };
    garminStep.estimatedDurationInSecs = step.duration.value;
  } else if (step.duration?.type === 'distance' && step.duration.value) {
    garminStep.endConditionValue = Math.round(step.duration.value);
    garminStep.preferredEndConditionUnit = {
      unitKey: 'kilometer'
    };
    garminStep.estimatedDistanceInMeters = step.duration.value;
  }

  // Ajouter la cible d'allure si disponible (course à pied)
  if (sport === 'running' && step.details?.paceMinKm) {
    const { low, high } = step.details.paceMinKm;
    const speedLow = 1000 / (low * 60);
    const speedHigh = 1000 / (high * 60);

    garminStep.targetType = { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' };
    garminStep.targetValueOne = speedHigh;
    garminStep.targetValueTwo = speedLow;
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

  for (const step of warmupSteps) {
    workoutSteps.push(createGarminStep(step, stepOrder++, workout.sport));
  }

  const repeatBlock = detectRepeatBlocks(mainSteps);

  if (repeatBlock && repeatBlock.repetitions >= 2) {
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

    for (const step of repeatBlock.remainingSteps) {
      workoutSteps.push(createGarminStep(step, stepOrder++, workout.sport));
    }
  } else {
    for (const step of mainSteps) {
      workoutSteps.push(createGarminStep(step, stepOrder++, workout.sport));
    }
  }

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

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
    const cachedTokens = await getCachedSession(email);

    let sessionValid = false;

    if (cachedTokens && cachedTokens.oauth1 && cachedTokens.oauth2) {
      try {
        // Restaurer la session depuis le cache
        client.loadToken(cachedTokens.oauth1, cachedTokens.oauth2);
        console.log('Tokens chargés depuis le cache, vérification...');

        // Tester si la session est encore valide avec un appel simple
        await client.getUserProfile();
        console.log('Session cache valide');
        sessionValid = true;
      } catch (e) {
        console.log('Session cache invalide:', e.message);
        sessionValid = false;
      }
    }

    if (!sessionValid) {
      console.log('Connexion à Garmin Connect...');
      await client.login();
      console.log('Connecté à Garmin Connect');

      // Sauvegarder les tokens dans le cache
      const tokens = client.exportToken();
      await setCachedSession(email, tokens);
    }

    const garminWorkout = convertToGarminFormat(workout);
    console.log('Workout converti');

    const result = await client.addWorkout(garminWorkout);
    console.log('Workout créé:', result?.workoutId);

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
    res.status(500).json({
      error: error.message || 'Erreur lors de la synchronisation',
    });
  }
}
