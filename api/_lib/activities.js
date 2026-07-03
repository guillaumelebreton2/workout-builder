/**
 * Service d'activités unifiées
 * Normalise les activités Strava et Garmin vers un format commun
 * et gère la déduplication cross-source.
 */

/**
 * Mapping des types de sports vers des clés internes.
 * Strava utilise des types PascalCase, Garmin utilise des types différents.
 */
export const SPORT_TYPE_MAP = {
  // Strava types
  Run: 'running',
  TrailRun: 'running',
  VirtualRun: 'running',
  Treadmill: 'running',
  Ride: 'cycling',
  VirtualRide: 'cycling',
  GravelRide: 'cycling',
  MountainBikeRide: 'cycling',
  EBikeRide: 'cycling',
  EMountainBikeRide: 'cycling',
  Handcycle: 'cycling',
  Velomobile: 'cycling',
  Swim: 'swimming',
  Walk: 'walking',
  Hike: 'walking',
  AlpineSki: 'alpine_ski',
  BackcountrySki: 'alpine_ski',
  NordicSki: 'nordic_ski',
  Snowboard: 'snowboard',
  Snowshoe: 'snowshoe',
  IceSkate: 'ice_skate',
  Rowing: 'rowing',
  Kayaking: 'kayaking',
  Canoeing: 'canoeing',
  StandUpPaddling: 'sup',
  Surfing: 'surfing',
  Kitesurfing: 'kitesurf',
  Windsurfing: 'windsurf',
  Sailing: 'sailing',
  WeightTraining: 'weight_training',
  Workout: 'workout',
  CrossFit: 'crossfit',
  Yoga: 'yoga',
  Pilates: 'pilates',
  Elliptical: 'elliptical',
  StairStepper: 'stair_stepper',
  HIIT: 'hiit',
  InlineSkate: 'inline_skate',
  Skateboard: 'skateboard',
  RollerSki: 'roller_ski',
  RockClimbing: 'climbing',
  Golf: 'golf',
  Soccer: 'soccer',
  Tennis: 'tennis',
  Badminton: 'badminton',
  Squash: 'squash',
  TableTennis: 'table_tennis',
  Wheelchair: 'wheelchair',
  // Garmin types (ajustés selon les retours de l'API)
  RUNNING: 'running',
  CYCLING: 'cycling',
  ROAD_CYCLING: 'cycling',
  MOUNTAIN_BIKING: 'cycling',
  GRAVEL_CYCLING: 'cycling',
  LAP_SWIMMING: 'swimming',
  OPEN_WATER_SWIMMING: 'swimming',
  SWIMMING: 'swimming',
  WALKING: 'walking',
  HIKING: 'walking',
  TRAIL_RUNNING: 'running',
  TREADMILL_RUNNING: 'running',
  INDOOR_CYCLING: 'cycling',
  STATIONARY_BIKING: 'cycling',
  ELLIPTICAL: 'elliptical',
  STRENGTH_TRAINING: 'weight_training',
  YOGA: 'yoga',
  PILATES: 'pilates',
  ROWING: 'rowing',
  KAYAKING: 'kayaking',
  STAND_UP_PADDLEBOARDING: 'sup',
  SKIING: 'alpine_ski',
  SNOWBOARDING: 'snowboard',
  OTHER: 'other',
};

/**
 * Normalise un type de sport externe vers une clé interne.
 */
export function normalizeSportType(type) {
  if (!type) return 'other';
  const key = String(type).trim();
  return SPORT_TYPE_MAP[key] || SPORT_TYPE_MAP[key.toUpperCase()] || 'other';
}

/**
 * Normalise une activité Strava vers UnifiedActivity.
 */
export function normalizeStravaActivity(activity) {
  if (!activity || typeof activity !== 'object') return null;

  const externalId = String(activity.id);
  const type = normalizeSportType(activity.sport_type || activity.type);

  return {
    id: `strava:${externalId}`,
    source: 'strava',
    externalId,
    name: activity.name || 'Activité Strava',
    type,
    rawType: activity.sport_type || activity.type || 'other',
    startDate: activity.start_date,
    startDateLocal: activity.start_date_local || activity.start_date,
    distance: Number(activity.distance) || 0,
    movingTime: Number(activity.moving_time) || 0,
    elapsedTime: Number(activity.elapsed_time) || 0,
    totalElevationGain: Number(activity.total_elevation_gain) || 0,
    averageSpeed: Number(activity.average_speed) || 0,
    maxSpeed: activity.max_speed ? Number(activity.max_speed) : undefined,
    averageHeartrate: activity.average_heartrate ? Number(activity.average_heartrate) : undefined,
    maxHeartrate: activity.max_heartrate ? Number(activity.max_heartrate) : undefined,
    averageCadence: activity.average_cadence ? Number(activity.average_cadence) : undefined,
    averageWatts: activity.average_watts ? Number(activity.average_watts) : undefined,
    kilojoules: activity.kilojoules ? Number(activity.kilojoules) : undefined,
    sufferScore: activity.suffer_score ? Number(activity.suffer_score) : undefined,
    providerActivityId: activity.id,
    url: activity.id ? `https://www.strava.com/activities/${activity.id}` : undefined,
    location: activity.location_city || activity.location_state || undefined,
    description: activity.description,
    deviceName: activity.device_name,
    private: activity.private === true || activity.visibility === 'only_me',
    raw: activity,
  };
}

/**
 * Normalise une activité Garmin vers UnifiedActivity.
 * Le format Garmin dépend de l'endpoint utilisé ; cette fonction supporte
 * à la fois les summaries Health API et les formats plus riches.
 */
export function normalizeGarminActivity(activity) {
  if (!activity || typeof activity !== 'object') return null;

  // Format Health API : activityId, startTimeInSeconds, startTimeOffsetInSeconds,
  // durationInSeconds, distanceInMeters, averageSpeedInMetersPerSecond, etc.
  const externalId = String(activity.activityId || activity.activityUUID || activity.id || Date.now());

  // Date de début
  let startDate = activity.startTimeLocal || activity.startTimeInSeconds;
  if (typeof activity.startTimeInSeconds === 'number') {
    const offsetSeconds = activity.startTimeOffsetInSeconds || 0;
    const d = new Date((activity.startTimeInSeconds + offsetSeconds) * 1000);
    startDate = d.toISOString();
  }

  const type = normalizeSportType(activity.activityType || activity.sportType);

  // Distance et durée
  const distance = Number(activity.distanceInMeters) || Number(activity.distance) || 0;
  const movingTime = Number(activity.durationInSeconds) || Number(activity.movingDurationInSeconds) || Number(activity.duration) || 0;
  const elapsedTime = Number(activity.elapsedDurationInSeconds) || movingTime;

  // Vitesse
  let averageSpeed = 0;
  if (activity.averageSpeedInMetersPerSecond) {
    averageSpeed = Number(activity.averageSpeedInMetersPerSecond);
  } else if (distance > 0 && movingTime > 0) {
    averageSpeed = distance / movingTime;
  }

  return {
    id: `garmin:${externalId}`,
    source: 'garmin',
    externalId,
    name: activity.activityName || 'Activité Garmin',
    type,
    rawType: activity.activityType || activity.sportType || 'OTHER',
    startDate,
    startDateLocal: activity.startTimeLocal || startDate,
    distance,
    movingTime,
    elapsedTime,
    totalElevationGain: Number(activity.elevationGainInMeters) || Number(activity.elevationGain) || 0,
    averageSpeed,
    maxSpeed: activity.maxSpeedInMetersPerSecond ? Number(activity.maxSpeedInMetersPerSecond) : undefined,
    averageHeartrate: activity.averageHR ? Number(activity.averageHR) : undefined,
    maxHeartrate: activity.maxHR ? Number(activity.maxHR) : undefined,
    averageCadence: activity.averageCadenceInRPM ? Number(activity.averageCadenceInRPM) : undefined,
    averageWatts: activity.averagePowerInWatts ? Number(activity.averagePowerInWatts) : undefined,
    kilojoules: activity.energyConsumedInCalories ? Number(activity.energyConsumedInCalories) * 4.184 : undefined,
    sufferScore: undefined,
    providerActivityId: activity.activityId || activity.activityUUID || activity.id,
    url: activity.activityURL,
    location: activity.locationName,
    description: activity.description,
    deviceName: activity.deviceName,
    private: false,
    raw: activity,
  };
}

/**
 * Détermine si deux activités de sources différentes sont des doublons.
 */
export function isDuplicate(a, b, opts = {}) {
  if (a.source === b.source) return false;

  const {
    timeThresholdMinutes = 10,
    durationThreshold = 0.10,
    distanceThreshold = 0.10,
    minDistanceForComparison = 100,
  } = opts;

  // Même sport
  if (a.type !== b.type) return false;

  // Fenêtre temporelle
  const startA = new Date(a.startDate).getTime();
  const startB = new Date(b.startDate).getTime();
  if (Math.abs(startA - startB) > timeThresholdMinutes * 60 * 1000) return false;

  // Durée similaire
  const maxDuration = Math.max(a.movingTime, b.movingTime, 1);
  if (Math.abs(a.movingTime - b.movingTime) / maxDuration > durationThreshold) {
    // Exception si les deux durées sont très courtes (< 2 min d'écart)
    if (Math.abs(a.movingTime - b.movingTime) > 120) return false;
  }

  // Distance similaire (si les deux ont une distance significative)
  if (a.distance > minDistanceForComparison && b.distance > minDistanceForComparison) {
    const maxDistance = Math.max(a.distance, b.distance, 1);
    if (Math.abs(a.distance - b.distance) / maxDistance > distanceThreshold) {
      // Exception si la différence est très faible (< 200m)
      if (Math.abs(a.distance - b.distance) > 200) return false;
    }
  }

  return true;
}

/**
 * Fusionne deux activités doublons en gardant la source prioritaire comme base
 * et en enrichissant avec les champs manquants de l'autre source.
 */
export function mergeActivities(a, b, preferredSource = 'strava') {
  const [primary, secondary] = a.source === preferredSource ? [a, b] : [b, a];

  return {
    ...primary,
    // On garde l'id et la source du primaire, mais on enrichit certains champs
    // si le primaire ne les a pas.
    averageHeartrate: primary.averageHeartrate ?? secondary.averageHeartrate,
    maxHeartrate: primary.maxHeartrate ?? secondary.maxHeartrate,
    averageCadence: primary.averageCadence ?? secondary.averageCadence,
    averageWatts: primary.averageWatts ?? secondary.averageWatts,
    kilojoules: primary.kilojoules ?? secondary.kilojoules,
    totalElevationGain: primary.totalElevationGain || secondary.totalElevationGain,
    // On garde la distance/ durée la plus cohérente (celle du primaire par défaut)
    // mais si la distance est nulle chez le primaire, on prend celle du secondaire.
    distance: primary.distance || secondary.distance,
    movingTime: primary.movingTime || secondary.movingTime,
    elapsedTime: primary.elapsedTime || secondary.elapsedTime,
  };
}

/**
 * Déduplique une liste d'activités unifiées.
 * Retourne une nouvelle liste triée par date décroissante.
 */
export function deduplicateActivities(activities, opts = {}) {
  const preferredSource = opts.preferredSource || 'strava';

  // Trier par date croissante pour un traitement stable
  const sorted = [...activities].filter(Boolean).sort((a, b) => {
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });

  const result = [];

  for (const activity of sorted) {
    // Chercher un doublon déjà conservé
    const duplicateIndex = result.findIndex(existing => isDuplicate(existing, activity, opts));

    if (duplicateIndex >= 0) {
      // Fusionner avec l'existant
      result[duplicateIndex] = mergeActivities(result[duplicateIndex], activity, preferredSource);
    } else {
      result.push(activity);
    }
  }

  // Retourner par date décroissante
  return result.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
}

/**
 * Normalise une liste d'activités brutes selon leur source.
 */
export function normalizeActivities(activities, source) {
  if (!Array.isArray(activities)) return [];

  const normalizer = source === 'strava' ? normalizeStravaActivity : normalizeGarminActivity;
  return activities.map(normalizer).filter(Boolean);
}
