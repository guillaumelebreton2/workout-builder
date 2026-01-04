/**
 * Service de calcul des métriques d'entraînement
 * Analyse les activités Strava pour générer des stats utiles
 */

import { StravaActivity, stravaApi } from './stravaApi';

// Types pour les métriques
export interface WeeklyMetrics {
  startDate: Date;
  endDate: Date;
  totalDistance: number; // km
  totalDuration: number; // minutes
  totalElevation: number; // m
  activityCount: number;
  avgPace?: number; // min/km (running only)
  avgSpeed?: number; // km/h
  avgHeartRate?: number;
  bySport: Record<string, SportMetrics>;
}

export interface SportMetrics {
  distance: number; // km
  duration: number; // minutes
  elevation: number; // m
  count: number;
  avgPace?: number; // min/km
  avgSpeed?: number; // km/h
  avgHeartRate?: number;
  avgCadence?: number;
  avgPower?: number; // watts (cycling)
}

export interface TrainingMetrics {
  currentWeek: WeeklyMetrics;
  previousWeek: WeeklyMetrics;
  last4Weeks: WeeklyMetrics[];
  weeklyTrend: {
    distanceChange: number; // % change
    durationChange: number;
    trend: 'up' | 'down' | 'stable';
  };
  recentActivities: StravaActivity[];
  summary: string; // Résumé texte pour l'IA
}

// Helpers pour les dates
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Lundi = début de semaine
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

// Configuration complète des sports Strava
export interface SportConfig {
  key: string;          // Clé interne
  label: string;        // Label français
  icon: string;         // Emoji
  category: 'endurance' | 'strength' | 'outdoor' | 'water' | 'winter' | 'other';
  hasDistance: boolean; // Sport avec distance mesurable
  hasPace: boolean;     // Afficher allure (min/km ou min/100m)
  hasPower: boolean;    // Sport avec puissance (watts)
  paceUnit?: string;    // Unité d'allure si applicable
}

export const STRAVA_SPORTS: Record<string, SportConfig> = {
  // Course à pied
  'Run': { key: 'running', label: 'Course à pied', icon: '🏃', category: 'endurance', hasDistance: true, hasPace: true, hasPower: false, paceUnit: 'min/km' },
  'TrailRun': { key: 'trail', label: 'Trail', icon: '🏔️', category: 'endurance', hasDistance: true, hasPace: true, hasPower: false, paceUnit: 'min/km' },
  'VirtualRun': { key: 'running', label: 'Course virtuelle', icon: '🏃‍♂️', category: 'endurance', hasDistance: true, hasPace: true, hasPower: false, paceUnit: 'min/km' },
  'Treadmill': { key: 'running', label: 'Tapis de course', icon: '🏃', category: 'endurance', hasDistance: true, hasPace: true, hasPower: false, paceUnit: 'min/km' },

  // Vélo
  'Ride': { key: 'cycling', label: 'Vélo', icon: '🚴', category: 'endurance', hasDistance: true, hasPace: false, hasPower: true },
  'VirtualRide': { key: 'cycling', label: 'Vélo virtuel', icon: '🚴‍♂️', category: 'endurance', hasDistance: true, hasPace: false, hasPower: true },
  'GravelRide': { key: 'gravel', label: 'Gravel', icon: '🚴', category: 'endurance', hasDistance: true, hasPace: false, hasPower: true },
  'MountainBikeRide': { key: 'mtb', label: 'VTT', icon: '🚵', category: 'endurance', hasDistance: true, hasPace: false, hasPower: true },
  'EBikeRide': { key: 'ebike', label: 'Vélo électrique', icon: '🔋🚴', category: 'endurance', hasDistance: true, hasPace: false, hasPower: true },
  'EMountainBikeRide': { key: 'emtb', label: 'VTT électrique', icon: '🔋🚵', category: 'endurance', hasDistance: true, hasPace: false, hasPower: true },
  'Handcycle': { key: 'handcycle', label: 'Handbike', icon: '♿🚴', category: 'endurance', hasDistance: true, hasPace: false, hasPower: true },
  'Velomobile': { key: 'velomobile', label: 'Vélomobile', icon: '🚴', category: 'endurance', hasDistance: true, hasPace: false, hasPower: true },

  // Natation
  'Swim': { key: 'swimming', label: 'Natation', icon: '🏊', category: 'water', hasDistance: true, hasPace: true, hasPower: false, paceUnit: 'min/100m' },

  // Marche / Randonnée
  'Walk': { key: 'walking', label: 'Marche', icon: '🚶', category: 'outdoor', hasDistance: true, hasPace: true, hasPower: false, paceUnit: 'min/km' },
  'Hike': { key: 'hiking', label: 'Randonnée', icon: '🥾', category: 'outdoor', hasDistance: true, hasPace: true, hasPower: false, paceUnit: 'min/km' },

  // Sports d'hiver
  'AlpineSki': { key: 'alpine_ski', label: 'Ski alpin', icon: '⛷️', category: 'winter', hasDistance: true, hasPace: false, hasPower: false },
  'BackcountrySki': { key: 'backcountry_ski', label: 'Ski de randonnée', icon: '🎿', category: 'winter', hasDistance: true, hasPace: false, hasPower: false },
  'NordicSki': { key: 'nordic_ski', label: 'Ski de fond', icon: '🎿', category: 'winter', hasDistance: true, hasPace: true, hasPower: false, paceUnit: 'min/km' },
  'Snowboard': { key: 'snowboard', label: 'Snowboard', icon: '🏂', category: 'winter', hasDistance: true, hasPace: false, hasPower: false },
  'Snowshoe': { key: 'snowshoe', label: 'Raquettes', icon: '🥾❄️', category: 'winter', hasDistance: true, hasPace: true, hasPower: false, paceUnit: 'min/km' },
  'IceSkate': { key: 'ice_skate', label: 'Patinage', icon: '⛸️', category: 'winter', hasDistance: true, hasPace: false, hasPower: false },

  // Sports nautiques
  'Rowing': { key: 'rowing', label: 'Aviron', icon: '🚣', category: 'water', hasDistance: true, hasPace: true, hasPower: true, paceUnit: 'min/500m' },
  'Kayaking': { key: 'kayaking', label: 'Kayak', icon: '🛶', category: 'water', hasDistance: true, hasPace: false, hasPower: false },
  'Canoeing': { key: 'canoeing', label: 'Canoë', icon: '🛶', category: 'water', hasDistance: true, hasPace: false, hasPower: false },
  'StandUpPaddling': { key: 'sup', label: 'Stand Up Paddle', icon: '🏄', category: 'water', hasDistance: true, hasPace: false, hasPower: false },
  'Surfing': { key: 'surfing', label: 'Surf', icon: '🏄', category: 'water', hasDistance: false, hasPace: false, hasPower: false },
  'Kitesurfing': { key: 'kitesurf', label: 'Kitesurf', icon: '🪁', category: 'water', hasDistance: true, hasPace: false, hasPower: false },
  'Windsurfing': { key: 'windsurf', label: 'Planche à voile', icon: '🏄‍♂️', category: 'water', hasDistance: true, hasPace: false, hasPower: false },
  'Sailing': { key: 'sailing', label: 'Voile', icon: '⛵', category: 'water', hasDistance: true, hasPace: false, hasPower: false },

  // Musculation / Fitness
  'WeightTraining': { key: 'weight_training', label: 'Musculation', icon: '🏋️', category: 'strength', hasDistance: false, hasPace: false, hasPower: false },
  'Workout': { key: 'workout', label: 'Entraînement', icon: '💪', category: 'strength', hasDistance: false, hasPace: false, hasPower: false },
  'CrossFit': { key: 'crossfit', label: 'CrossFit', icon: '🏋️‍♂️', category: 'strength', hasDistance: false, hasPace: false, hasPower: false },
  'Yoga': { key: 'yoga', label: 'Yoga', icon: '🧘', category: 'strength', hasDistance: false, hasPace: false, hasPower: false },
  'Pilates': { key: 'pilates', label: 'Pilates', icon: '🧘‍♀️', category: 'strength', hasDistance: false, hasPace: false, hasPower: false },
  'Elliptical': { key: 'elliptical', label: 'Elliptique', icon: '🏃', category: 'endurance', hasDistance: true, hasPace: false, hasPower: false },
  'StairStepper': { key: 'stair_stepper', label: 'Stepper', icon: '🪜', category: 'strength', hasDistance: false, hasPace: false, hasPower: false },
  'HIIT': { key: 'hiit', label: 'HIIT', icon: '🔥', category: 'strength', hasDistance: false, hasPace: false, hasPower: false },

  // Autres sports
  'InlineSkate': { key: 'inline_skate', label: 'Roller', icon: '🛼', category: 'outdoor', hasDistance: true, hasPace: false, hasPower: false },
  'Skateboard': { key: 'skateboard', label: 'Skateboard', icon: '🛹', category: 'outdoor', hasDistance: true, hasPace: false, hasPower: false },
  'RollerSki': { key: 'roller_ski', label: 'Ski roues', icon: '🎿', category: 'outdoor', hasDistance: true, hasPace: true, hasPower: false, paceUnit: 'min/km' },
  'RockClimbing': { key: 'climbing', label: 'Escalade', icon: '🧗', category: 'outdoor', hasDistance: false, hasPace: false, hasPower: false },
  'Golf': { key: 'golf', label: 'Golf', icon: '⛳', category: 'other', hasDistance: true, hasPace: false, hasPower: false },
  'Soccer': { key: 'soccer', label: 'Football', icon: '⚽', category: 'other', hasDistance: true, hasPace: false, hasPower: false },
  'Tennis': { key: 'tennis', label: 'Tennis', icon: '🎾', category: 'other', hasDistance: false, hasPace: false, hasPower: false },
  'Badminton': { key: 'badminton', label: 'Badminton', icon: '🏸', category: 'other', hasDistance: false, hasPace: false, hasPower: false },
  'Squash': { key: 'squash', label: 'Squash', icon: '🎾', category: 'other', hasDistance: false, hasPace: false, hasPower: false },
  'TableTennis': { key: 'table_tennis', label: 'Ping-pong', icon: '🏓', category: 'other', hasDistance: false, hasPace: false, hasPower: false },
  'Wheelchair': { key: 'wheelchair', label: 'Fauteuil roulant', icon: '♿', category: 'endurance', hasDistance: true, hasPace: true, hasPower: false, paceUnit: 'min/km' },
};

// Sport par défaut pour les types inconnus
const DEFAULT_SPORT: SportConfig = {
  key: 'other',
  label: 'Autre',
  icon: '🏃',
  category: 'other',
  hasDistance: true,
  hasPace: false,
  hasPower: false,
};

// Obtenir la config d'un sport
export function getSportConfig(type: string): SportConfig {
  return STRAVA_SPORTS[type] || DEFAULT_SPORT;
}

// Mapper les types Strava vers nos catégories (pour compatibilité)
function mapSportType(type: string): string {
  return getSportConfig(type).key;
}

// Calculer les métriques pour une semaine
function calculateWeekMetrics(activities: StravaActivity[], weekStart: Date, weekEnd: Date): WeeklyMetrics {
  const weekActivities = activities.filter(a => {
    const actDate = new Date(a.start_date);
    return actDate >= weekStart && actDate <= weekEnd;
  });

  const bySport: Record<string, SportMetrics> = {};
  let totalDistance = 0;
  let totalDuration = 0;
  let totalElevation = 0;
  let totalHeartRate = 0;
  let hrCount = 0;

  for (const activity of weekActivities) {
    const sport = mapSportType(activity.type);
    const distanceKm = activity.distance / 1000;
    const durationMin = activity.moving_time / 60;

    totalDistance += distanceKm;
    totalDuration += durationMin;
    totalElevation += activity.total_elevation_gain || 0;

    if (activity.average_heartrate) {
      totalHeartRate += activity.average_heartrate;
      hrCount++;
    }

    // Accumuler par sport
    if (!bySport[sport]) {
      bySport[sport] = {
        distance: 0,
        duration: 0,
        elevation: 0,
        count: 0,
      };
    }

    bySport[sport].distance += distanceKm;
    bySport[sport].duration += durationMin;
    bySport[sport].elevation += activity.total_elevation_gain || 0;
    bySport[sport].count++;

    if (activity.average_heartrate) {
      bySport[sport].avgHeartRate = (bySport[sport].avgHeartRate || 0) + activity.average_heartrate;
    }
    if (activity.average_cadence) {
      bySport[sport].avgCadence = (bySport[sport].avgCadence || 0) + activity.average_cadence;
    }
    if (activity.average_watts) {
      bySport[sport].avgPower = (bySport[sport].avgPower || 0) + activity.average_watts;
    }
  }

  // Calculer les moyennes par sport
  for (const sport of Object.keys(bySport)) {
    const s = bySport[sport];
    if (s.count > 0) {
      if (s.avgHeartRate) s.avgHeartRate = Math.round(s.avgHeartRate / s.count);
      if (s.avgCadence) s.avgCadence = Math.round(s.avgCadence / s.count);
      if (s.avgPower) s.avgPower = Math.round(s.avgPower / s.count);

      // Calculer allure/vitesse moyenne
      if (s.duration > 0 && s.distance > 0) {
        s.avgSpeed = Math.round((s.distance / (s.duration / 60)) * 10) / 10;
        if (sport === 'running') {
          s.avgPace = Math.round((s.duration / s.distance) * 10) / 10;
        }
      }
    }
  }

  return {
    startDate: weekStart,
    endDate: weekEnd,
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalDuration: Math.round(totalDuration),
    totalElevation: Math.round(totalElevation),
    activityCount: weekActivities.length,
    avgHeartRate: hrCount > 0 ? Math.round(totalHeartRate / hrCount) : undefined,
    avgSpeed: totalDuration > 0 ? Math.round((totalDistance / (totalDuration / 60)) * 10) / 10 : undefined,
    avgPace: bySport['running']?.avgPace,
    bySport,
  };
}

// Générer un résumé texte pour l'IA
function generateSummary(metrics: TrainingMetrics): string {
  const { currentWeek, previousWeek, weeklyTrend } = metrics;

  let summary = `# Résumé d'entraînement\n\n`;

  // Cette semaine
  summary += `## Cette semaine\n`;
  summary += `- ${currentWeek.activityCount} séances\n`;
  summary += `- ${currentWeek.totalDistance} km parcourus\n`;
  summary += `- ${Math.round(currentWeek.totalDuration / 60 * 10) / 10}h d'entraînement\n`;
  if (currentWeek.totalElevation > 0) {
    summary += `- ${currentWeek.totalElevation}m de dénivelé\n`;
  }
  if (currentWeek.avgHeartRate) {
    summary += `- FC moyenne: ${currentWeek.avgHeartRate} bpm\n`;
  }

  // Par sport - trouver le label depuis la config
  for (const [sportKey, data] of Object.entries(currentWeek.bySport)) {
    // Trouver la config du sport (chercher par key)
    const sportConfig = Object.values(STRAVA_SPORTS).find(s => s.key === sportKey) || DEFAULT_SPORT;
    const label = sportConfig.label;
    const icon = sportConfig.icon;

    summary += `\n### ${icon} ${label}\n`;
    if (sportConfig.hasDistance) {
      summary += `- ${data.count} séance(s), ${data.distance.toFixed(1)} km, ${Math.round(data.duration)} min\n`;
    } else {
      summary += `- ${data.count} séance(s), ${Math.round(data.duration)} min\n`;
    }
    if (data.avgPace && sportConfig.hasPace) {
      const paceMin = Math.floor(data.avgPace);
      const paceSec = Math.round((data.avgPace - paceMin) * 60);
      summary += `- Allure moyenne: ${paceMin}'${paceSec.toString().padStart(2, '0')}/${sportConfig.paceUnit || 'km'}\n`;
    }
    if (data.avgPower && sportConfig.hasPower) {
      summary += `- Puissance moyenne: ${data.avgPower}W\n`;
    }
    if (data.avgCadence) {
      summary += `- Cadence moyenne: ${data.avgCadence} ${sportKey === 'cycling' ? 'rpm' : 'spm'}\n`;
    }
    if (data.avgHeartRate) {
      summary += `- FC moyenne: ${data.avgHeartRate} bpm\n`;
    }
  }

  // Comparaison semaine précédente
  summary += `\n## Évolution vs semaine précédente\n`;
  if (previousWeek.activityCount > 0) {
    const distDiff = currentWeek.totalDistance - previousWeek.totalDistance;
    const durDiff = currentWeek.totalDuration - previousWeek.totalDuration;
    summary += `- Distance: ${distDiff >= 0 ? '+' : ''}${distDiff.toFixed(1)} km (${weeklyTrend.distanceChange >= 0 ? '+' : ''}${weeklyTrend.distanceChange}%)\n`;
    summary += `- Durée: ${durDiff >= 0 ? '+' : ''}${Math.round(durDiff)} min (${weeklyTrend.durationChange >= 0 ? '+' : ''}${weeklyTrend.durationChange}%)\n`;
    summary += `- Tendance: ${weeklyTrend.trend === 'up' ? '📈 En hausse' : weeklyTrend.trend === 'down' ? '📉 En baisse' : '➡️ Stable'}\n`;
  } else {
    summary += `- Pas de données la semaine précédente\n`;
  }

  // Dernières activités
  if (metrics.recentActivities.length > 0) {
    summary += `\n## Dernières activités\n`;
    for (const activity of metrics.recentActivities.slice(0, 5)) {
      const date = new Date(activity.start_date_local).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
      const dist = (activity.distance / 1000).toFixed(1);
      const dur = Math.round(activity.moving_time / 60);
      summary += `- ${date}: ${activity.name} (${dist} km, ${dur} min)\n`;
    }
  }

  return summary;
}

// Fonction principale : calculer toutes les métriques
export async function calculateTrainingMetrics(): Promise<TrainingMetrics> {
  // Récupérer les activités des 5 dernières semaines pour les stats
  const fiveWeeksAgo = new Date();
  fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);

  // Deux appels en parallèle :
  // 1. Activités filtrées pour les stats hebdo
  // 2. Activités récentes sans filtre pour l'affichage
  const [statsActivities, recentActivities] = await Promise.all([
    stravaApi.getActivities({
      after: fiveWeeksAgo,
      perPage: 100,
    }),
    stravaApi.getActivities({
      perPage: 15, // Les 15 plus récentes, sans filtre de date
    }),
  ]);

  const activities = statsActivities;

  const now = new Date();

  // Semaine courante
  const currentWeekStart = getWeekStart(now);
  const currentWeekEnd = getWeekEnd(now);
  const currentWeek = calculateWeekMetrics(activities, currentWeekStart, currentWeekEnd);

  // Semaine précédente
  const prevWeekStart = new Date(currentWeekStart);
  prevWeekStart.setDate(prevWeekStart.getDate() - 7);
  const prevWeekEnd = new Date(currentWeekStart);
  prevWeekEnd.setDate(prevWeekEnd.getDate() - 1);
  prevWeekEnd.setHours(23, 59, 59, 999);
  const previousWeek = calculateWeekMetrics(activities, prevWeekStart, prevWeekEnd);

  // 4 dernières semaines
  const last4Weeks: WeeklyMetrics[] = [];
  for (let i = 0; i < 4; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - (i * 7));
    const weekEnd = getWeekEnd(weekStart);
    last4Weeks.push(calculateWeekMetrics(activities, weekStart, weekEnd));
  }

  // Calculer la tendance
  let distanceChange = 0;
  let durationChange = 0;
  let trend: 'up' | 'down' | 'stable' = 'stable';

  if (previousWeek.totalDistance > 0) {
    distanceChange = Math.round(((currentWeek.totalDistance - previousWeek.totalDistance) / previousWeek.totalDistance) * 100);
  }
  if (previousWeek.totalDuration > 0) {
    durationChange = Math.round(((currentWeek.totalDuration - previousWeek.totalDuration) / previousWeek.totalDuration) * 100);
  }

  if (distanceChange > 10 || durationChange > 10) {
    trend = 'up';
  } else if (distanceChange < -10 || durationChange < -10) {
    trend = 'down';
  }

  const metrics: TrainingMetrics = {
    currentWeek,
    previousWeek,
    last4Weeks,
    weeklyTrend: {
      distanceChange,
      durationChange,
      trend,
    },
    recentActivities, // Activités les plus récentes (sans filtre de date)
    summary: '',
  };

  // Générer le résumé
  metrics.summary = generateSummary(metrics);

  return metrics;
}

// Export groupé
export const metricsService = {
  calculateTrainingMetrics,
};
