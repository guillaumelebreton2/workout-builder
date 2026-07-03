/**
 * Types pour les activités unifiées (multi-source : Strava, Garmin, ...)
 */

export type ActivitySource = 'strava' | 'garmin';

export interface UnifiedActivity {
  /** Identifiant interne composite : "{source}:{externalId}" */
  id: string;
  /** Source de l'activité */
  source: ActivitySource;
  /** Identifiant chez le provider */
  externalId: string;
  /** Nom de l'activité */
  name: string;
  /** Type de sport normalisé (clé interne, ex: running, cycling, swimming) */
  type: string;
  /** Type original chez le provider (ex: Run, Ride, trail_running) */
  rawType: string;
  /** Date de début (ISO UTC) */
  startDate: string;
  /** Date de début locale (ISO ou string formatée par le provider) */
  startDateLocal: string;
  /** Distance en mètres */
  distance: number;
  /** Temps de mouvement en secondes */
  movingTime: number;
  /** Temps écoulé en secondes */
  elapsedTime: number;
  /** Dénivelé positif en mètres */
  totalElevationGain: number;
  /** Vitesse moyenne en m/s */
  averageSpeed: number;
  /** Vitesse max en m/s */
  maxSpeed?: number;
  /** FC moyenne */
  averageHeartrate?: number;
  /** FC max */
  maxHeartrate?: number;
  /** Cadence moyenne */
  averageCadence?: number;
  /** Puissance moyenne (W) */
  averageWatts?: number;
  /** Énergie (kJ) */
  kilojoules?: number;
  /** Score d'effort Strava */
  sufferScore?: number;
  /** Identifiant de l'activité chez le provider (typé selon la source) */
  providerActivityId?: string | number;
  /** Url publique de l'activité (Strava) */
  url?: string;
  /** Localisation / ville */
  location?: string;
  /** Description (Strava) */
  description?: string;
  /** Device (Strava) */
  deviceName?: string;
  /** Indique si l'activité est privée */
  private?: boolean;
  /** Données brutes du provider (pour debug ou fonctionnalités avancées) */
  raw?: unknown;
}

export interface DeduplicationOptions {
  /** Fenêtre temporelle en minutes (défaut: 10) */
  timeThresholdMinutes?: number;
  /** Tolérance sur la durée (ratio, défaut: 0.10) */
  durationThreshold?: number;
  /** Tolérance sur la distance (ratio, défaut: 0.10) */
  distanceThreshold?: number;
  /** Distance minimale pour appliquer la comparaison de distance (m, défaut: 100) */
  minDistanceForComparison?: number;
  /** Source prioritaire en cas de doublon */
  preferredSource?: ActivitySource;
}

export interface UnifiedActivitiesResponse {
  activities: UnifiedActivity[];
  meta: {
    total: number;
    sources: ActivitySource[];
    lastSyncedAt?: string;
    errors?: string[];
    message?: string;
  };
}

export interface SyncActivitiesResponse {
  success: boolean;
  activities?: UnifiedActivity[];
  message?: string;
  errors?: string[];
}
