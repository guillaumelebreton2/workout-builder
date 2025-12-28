// Types pour l'application Workout Builder

export type Sport = 'running' | 'cycling' | 'swimming';

export type StepType = 'warmup' | 'active' | 'recovery' | 'cooldown' | 'rest';

export type IntensityType = 'pace' | 'heartRate' | 'power' | 'open';

export type DurationType = 'time' | 'distance' | 'open';

// Types spécifiques natation
export type SwimStrokeType =
  | 'free'        // Nage libre / Crawl
  | 'backstroke'  // Dos crawlé
  | 'breaststroke'// Brasse
  | 'fly'         // Papillon
  | 'im'          // 4 nages (Individual Medley)
  | 'rimo'        // 4 nages inversé (Reverse IM)
  | 'choice'      // Choix
  | 'mixed';      // Mixte

export type SwimEquipmentType =
  | 'fins'        // Palmes
  | 'kickboard'   // Planche
  | 'paddles'     // Plaquettes
  | 'pull_buoy'   // Pull-buoy
  | 'snorkel';    // Tuba

export type SwimDrillType =
  | 'kick'        // Battements de jambes
  | 'pull'        // Bras seulement
  | 'drill';      // Exercice éducatif

export type SwimIntensityLevel =
  | 'recovery'    // Récupération
  | 'easy'        // Facile
  | 'moderate'    // Modéré
  | 'hard'        // Difficile
  | 'very_hard'   // Très difficile
  | 'maximum'     // Maximum
  | 'ascending'   // Progressif croissant
  | 'descending'; // Progressif décroissant

export interface Duration {
  type: DurationType;
  value?: number; // en secondes pour time, en mètres pour distance
}

export interface Intensity {
  type: IntensityType;
  zone?: number; // 1-5 pour les zones
  value?: number; // pace en sec/km, HR en bpm, power en watts
  valueHigh?: number; // pour les plages (ex: zone 3-4)
}

export interface StepDetails {
  capPercent?: { low: number; high: number }; // % de CAP/VMA/FTP (ex: 55-75%)
  speedKmh?: { low: number; high: number };   // Vitesse en km/h (course)
  paceMinKm?: { low: number; high: number };  // Allure en min/km (course)
  watts?: { low: number; high: number };      // Puissance en watts (vélo)
  swimPaceMin100m?: { low: number; high: number }; // Allure en min/100m (natation)
  distanceMeters?: { low: number; high: number }; // Distance estimée
  // Champs spécifiques natation
  swimStroke?: SwimStrokeType;                // Type de nage
  swimEquipment?: SwimEquipmentType[];        // Équipements (plusieurs possibles)
  swimDrill?: SwimDrillType;                  // Type d'exercice
  swimIntensity?: SwimIntensityLevel;         // Niveau d'effort
  swimCssOffset?: number;                     // Offset par rapport à CSS (secondes +/-)
  swimNotes?: string;                         // Notes additionnelles (ex: hypoxie)
}

export interface WorkoutStep {
  id: string;
  type: StepType;
  name: string;
  duration: Duration;
  intensity?: Intensity;
  details?: StepDetails; // Détails supplémentaires (allure, distance, %CAP)
  repetitions?: number; // pour les intervalles
  steps?: WorkoutStep[]; // pour les blocs répétés
}

export interface Workout {
  id: string;
  name: string;
  sport: Sport;
  date: Date;
  description?: string;
  steps: WorkoutStep[];
}

// Labels en français
export const SPORT_LABELS: Record<Sport, string> = {
  running: 'Course à pied',
  cycling: 'Vélo',
  swimming: 'Natation',
};

export const STEP_TYPE_LABELS: Record<StepType, string> = {
  warmup: 'Échauffement',
  active: 'Actif',
  recovery: 'Récupération',
  cooldown: 'Retour au calme',
  rest: 'Repos',
};

export const DURATION_TYPE_LABELS: Record<DurationType, string> = {
  time: 'Durée',
  distance: 'Distance',
  open: 'Libre',
};

// Labels natation
export const SWIM_STROKE_LABELS: Record<SwimStrokeType, string> = {
  free: 'Crawl',
  backstroke: 'Dos',
  breaststroke: 'Brasse',
  fly: 'Papillon',
  im: '4 nages',
  rimo: '4 nages inversé',
  choice: 'Choix',
  mixed: 'Mixte',
};

export const SWIM_EQUIPMENT_LABELS: Record<SwimEquipmentType, string> = {
  fins: 'Palmes',
  kickboard: 'Planche',
  paddles: 'Plaquettes',
  pull_buoy: 'Pull-buoy',
  snorkel: 'Tuba',
};

export const SWIM_DRILL_LABELS: Record<SwimDrillType, string> = {
  kick: 'Battements',
  pull: 'Bras',
  drill: 'Éducatif',
};

export const SWIM_INTENSITY_LABELS: Record<SwimIntensityLevel, string> = {
  recovery: 'Récupération',
  easy: 'Facile',
  moderate: 'Modéré',
  hard: 'Difficile',
  very_hard: 'Très difficile',
  maximum: 'Maximum',
  ascending: 'Progressif +',
  descending: 'Progressif -',
};

// Helpers
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h${minutes.toString().padStart(2, '0')}`;
  }
  if (minutes > 0) {
    return secs > 0 ? `${minutes}min${secs.toString().padStart(2, '0')}` : `${minutes}min`;
  }
  return `${secs}s`;
}

export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return km % 1 === 0 ? `${km}km` : `${km.toFixed(1)}km`;
  }
  return `${meters}m`;
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}
