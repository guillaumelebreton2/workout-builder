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

// Mapper les types Strava vers nos catégories
function mapSportType(type: string): string {
  const mapping: Record<string, string> = {
    'Run': 'running',
    'TrailRun': 'running',
    'VirtualRun': 'running',
    'Ride': 'cycling',
    'VirtualRide': 'cycling',
    'GravelRide': 'cycling',
    'MountainBikeRide': 'cycling',
    'Swim': 'swimming',
    'Walk': 'walking',
    'Hike': 'hiking',
  };
  return mapping[type] || 'other';
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

  // Par sport
  for (const [sport, data] of Object.entries(currentWeek.bySport)) {
    const sportLabels: Record<string, string> = {
      running: 'Course',
      cycling: 'Vélo',
      swimming: 'Natation',
      walking: 'Marche',
      hiking: 'Randonnée',
    };
    const label = sportLabels[sport] || sport;
    summary += `\n### ${label}\n`;
    summary += `- ${data.count} séance(s), ${data.distance.toFixed(1)} km, ${Math.round(data.duration)} min\n`;
    if (data.avgPace && sport === 'running') {
      const paceMin = Math.floor(data.avgPace);
      const paceSec = Math.round((data.avgPace - paceMin) * 60);
      summary += `- Allure moyenne: ${paceMin}'${paceSec.toString().padStart(2, '0')}/km\n`;
    }
    if (data.avgPower) {
      summary += `- Puissance moyenne: ${data.avgPower}W\n`;
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
  // Récupérer les activités des 5 dernières semaines
  const fiveWeeksAgo = new Date();
  fiveWeeksAgo.setDate(fiveWeeksAgo.getDate() - 35);

  const activities = await stravaApi.getActivities({
    after: fiveWeeksAgo,
    perPage: 100,
  });

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
    recentActivities: activities.slice(0, 10),
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
