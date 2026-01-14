/**
 * Service d'analyse détaillée des activités
 * Récupère les données Strava et génère une analyse pour l'IA
 */

import {
  StravaActivity,
  StravaActivityDetails,
  StravaStreams,
  StravaLap,
  stravaApi,
} from './stravaApi';
import { athleteProfileStore } from './athleteProfileStore';

// Types pour l'analyse
export interface RunningAnalysis {
  // Données de base
  activity: StravaActivityDetails;

  // Splits par km
  splits: SplitAnalysis[];

  // Métriques calculées
  metrics: {
    // Allure
    avgPace: number;           // min/km
    bestPace: number;          // min/km
    worstPace: number;         // min/km
    paceVariability: number;   // % écart-type

    // GAP (Grade Adjusted Pace)
    avgGAP?: number;           // min/km ajusté au dénivelé
    gapDifference?: number;    // différence avec allure réelle en secondes/km

    // Stratégie de course
    negativeSplit: boolean;    // 2ème moitié plus rapide
    firstHalfPace: number;     // min/km
    secondHalfPace: number;    // min/km

    // Fréquence cardiaque
    avgHr?: number;
    maxHr?: number;
    hrZones?: HrZoneTime[];

    // Dérive cardiaque
    cardiacDrift?: number;     // % d'augmentation FC pour même effort
    cardiacDriftStatus?: 'good' | 'moderate' | 'high';

    // Cadence
    avgCadence?: number;
    cadenceVariability?: number;  // % écart-type
    cadenceStatus?: 'low' | 'optimal' | 'high';

    // Longueur de foulée
    avgStrideLength?: number;  // mètres
    strideLengthStatus?: 'short' | 'optimal' | 'long';

    // Efficacité
    efficiencyFactor?: number; // vitesse / FC (plus haut = meilleur)
    efficiencyTrend?: 'improving' | 'stable' | 'declining';

    // Dénivelé
    elevationGain: number;
    elevationLoss: number;

    // Effort
    estimatedEffort: 'easy' | 'moderate' | 'hard' | 'very_hard';

    // Type de séance détecté
    sessionType?: SessionType;
    sessionTypeConfidence?: number;  // 0-100%

    // Meilleurs efforts de la séance
    bestEfforts?: BestEffort[];

    // Récupération
    estimatedRecoveryHours?: number;
    nextWorkoutSuggestion?: string;

    // Comparaison avec le profil athlète
    profileComparison?: {
      hrZonesSource: 'profile' | 'calculated';  // D'où viennent les zones FC
      paceVsVma?: {                             // Comparaison allure vs VMA
        vma: number;                            // VMA du profil (km/h)
        avgPacePercent: number;                 // % VMA de l'allure moyenne
        expectedZone: string;                   // Zone d'entraînement correspondante
      };
      paceVsReference?: {                       // Comparaison vs allures de référence
        closestZone: string;                    // Zone la plus proche
        difference: number;                     // Écart en sec/km (+ = plus lent)
        status: 'slower' | 'on_target' | 'faster';
      };
    };
  };

  // Points forts et axes d'amélioration
  strengths: string[];
  improvements: string[];

  // Structure de la séance (intervalles détectés)
  workoutStructure?: WorkoutStructure;

  // Résumé texte pour l'IA
  summary: string;
}

export interface BestEffort {
  name: string;           // "1 km", "1 mile", "5 km"
  distance: number;       // mètres
  time: number;           // secondes
  pace: number;           // min/km
  startIndex?: number;    // index de début dans les données
}

// Types de séance détectables
export type SessionType =
  | 'recovery'      // Récupération active
  | 'easy'          // Endurance fondamentale (EF)
  | 'long_run'      // Sortie longue
  | 'tempo'         // Tempo / Allure marathon
  | 'threshold'     // Seuil lactique
  | 'intervals'     // Fractionné
  | 'fartlek'       // Fartlek (variations non structurées)
  | 'race'          // Compétition
  | 'mixed';        // Séance mixte

export interface SessionTypeResult {
  type: SessionType;
  confidence: number;     // 0-100
  characteristics: string[];
}

// ======== STRUCTURE D'INTERVALLES ========

export interface IntervalSegment {
  type: 'warmup' | 'cooldown' | 'fast' | 'recovery' | 'steady';
  startTime: number;      // secondes depuis le début
  endTime: number;        // secondes depuis le début
  duration: number;       // secondes
  distance: number;       // mètres
  avgPace: number;        // min/km
  avgHr?: number;         // bpm
}

export interface IntervalPattern {
  count: number;          // nombre de répétitions
  avgDistance: number;    // distance moyenne des intervalles rapides
  avgDuration: number;    // durée moyenne
  avgPace: number;        // allure moyenne
  avgRecoveryDistance: number;  // distance moyenne des récup
  avgRecoveryDuration: number;  // durée moyenne des récup
  avgRecoveryPace: number;      // allure moyenne des récup
}

export interface WorkoutStructure {
  warmup?: IntervalSegment;
  cooldown?: IntervalSegment;
  mainSegments: IntervalSegment[];
  intervalPattern?: IntervalPattern;  // Si un pattern répétitif est détecté
  isStructuredInterval: boolean;      // True si séance de fractionné détectée
}

// ======== ANALYSE VÉLO ========

export interface CyclingAnalysis {
  activity: StravaActivityDetails;

  // Métriques de puissance
  metrics: {
    // Vitesse
    avgSpeed: number;         // km/h
    maxSpeed: number;         // km/h
    speedVariability: number; // %

    // Puissance (si capteur de puissance)
    avgPower?: number;        // watts
    maxPower?: number;        // watts
    normalizedPower?: number; // NP (watts)
    intensityFactor?: number; // IF (0-1+)
    trainingStressScore?: number; // TSS
    variabilityIndex?: number; // VI (NP/avgPower)
    powerZones?: PowerZoneTime[];

    // Cadence
    avgCadence?: number;      // rpm
    cadenceVariability?: number;

    // Fréquence cardiaque
    avgHr?: number;
    maxHr?: number;
    hrZones?: HrZoneTime[];

    // Dénivelé
    elevationGain: number;
    elevationLoss: number;
    avgGrade?: number;        // % moyen sur les montées

    // Efficacité
    powerToWeight?: number;   // W/kg (si poids connu)
    climbingVAM?: number;     // m/h de dénivelé en montée

    // Type de séance
    sessionType?: CyclingSessionType;
    sessionTypeConfidence?: number;

    // Effort
    estimatedEffort: 'easy' | 'moderate' | 'hard' | 'very_hard';
    estimatedRecoveryHours?: number;
    nextWorkoutSuggestion?: string;
  };

  // Points forts et axes d'amélioration
  strengths: string[];
  improvements: string[];

  // Résumé texte pour l'IA
  summary: string;
}

export interface PowerZoneTime {
  zone: number;        // 1-7
  name: string;
  minPower: number;
  maxPower: number;
  duration: number;    // secondes
  percent: number;     // % du temps
}

export type CyclingSessionType =
  | 'recovery'       // Récupération
  | 'endurance'      // Endurance / Z2
  | 'tempo'          // Tempo / Sweet spot
  | 'threshold'      // Seuil (FTP)
  | 'vo2max'         // VO2max intervals
  | 'anaerobic'      // Anaérobie
  | 'sprint'         // Sprints
  | 'climb'          // Sortie grimpeur
  | 'race'           // Course/Compétition
  | 'mixed';         // Mixte

export const CYCLING_SESSION_LABELS: Record<CyclingSessionType, string> = {
  'recovery': 'Récupération',
  'endurance': 'Endurance',
  'tempo': 'Tempo / Sweet Spot',
  'threshold': 'Seuil (FTP)',
  'vo2max': 'VO2max',
  'anaerobic': 'Anaérobie',
  'sprint': 'Sprints',
  'climb': 'Grimpeur',
  'race': 'Course',
  'mixed': 'Mixte',
};

// ======== ANALYSE NATATION ========

export interface SwimmingAnalysis {
  activity: StravaActivityDetails;

  metrics: {
    // Distance et temps
    distance: number;        // mètres
    duration: number;        // secondes
    laps: number;            // nombre de longueurs

    // Allure
    avgPace100m: number;     // secondes par 100m
    bestPace100m: number;    // meilleur 100m
    paceVariability: number; // %

    // SWOLF (efficacité)
    avgSwolf?: number;       // strokes + seconds per length
    bestSwolf?: number;

    // Coups de bras
    avgStrokeRate?: number;  // strokes/min
    avgStrokesPerLength?: number;
    strokeEfficiency?: number;  // mètres par coup

    // Fréquence cardiaque
    avgHr?: number;
    maxHr?: number;
    hrZones?: HrZoneTime[];

    // Type de séance
    sessionType?: SwimmingSessionType;
    sessionTypeConfidence?: number;

    // Effort
    estimatedEffort: 'easy' | 'moderate' | 'hard' | 'very_hard';
    estimatedRecoveryHours?: number;
    nextWorkoutSuggestion?: string;
  };

  // Analyse par longueur si disponible
  lapDetails?: SwimLapDetail[];

  // Points forts et axes d'amélioration
  strengths: string[];
  improvements: string[];

  // Résumé texte pour l'IA
  summary: string;
}

export interface SwimLapDetail {
  lap: number;
  distance: number;
  duration: number;
  pace100m: number;
  strokeCount?: number;
  swolf?: number;
}

export type SwimmingSessionType =
  | 'recovery'      // Récupération
  | 'technique'     // Travail technique
  | 'endurance'     // Endurance / aérobie
  | 'threshold'     // Seuil
  | 'intervals'     // Fractionné
  | 'sprint'        // Sprints
  | 'race'          // Course/Test
  | 'mixed';        // Mixte

export const SWIMMING_SESSION_LABELS: Record<SwimmingSessionType, string> = {
  'recovery': 'Récupération',
  'technique': 'Technique',
  'endurance': 'Endurance',
  'threshold': 'Seuil',
  'intervals': 'Fractionné',
  'sprint': 'Sprints',
  'race': 'Course/Test',
  'mixed': 'Mixte',
};

export interface SplitAnalysis {
  km: number;
  distance: number;      // mètres
  duration: number;      // secondes
  pace: number;          // min/km
  avgHr?: number;
  avgCadence?: number;
  elevation?: number;    // gain en m
  comparison: 'faster' | 'slower' | 'average';  // vs moyenne
}

export interface HrZoneTime {
  zone: number;          // 1-5
  name: string;
  minHr: number;
  maxHr: number;
  duration: number;      // secondes
  percent: number;       // % du temps total
}

// Convertir vitesse (m/s) en allure (min/km)
function speedToPace(speedMs: number): number {
  if (speedMs <= 0) return 0;
  return (1000 / speedMs) / 60;  // min/km
}

// Formater l'allure en string (ex: "5'30")
export function formatPace(paceMinKm: number): string {
  if (!paceMinKm || paceMinKm <= 0 || !isFinite(paceMinKm)) return '--';
  const minutes = Math.floor(paceMinKm);
  const seconds = Math.round((paceMinKm - minutes) * 60);
  return `${minutes}'${seconds.toString().padStart(2, '0')}`;
}

// Calculer le GAP (Grade Adjusted Pace)
// Formule basée sur Strava/TrainingPeaks: ajuste l'allure selon la pente
function calculateGAP(
  paceMinKm: number,
  gradePercent: number
): number {
  if (paceMinKm <= 0 || !isFinite(paceMinKm)) return paceMinKm;

  // Facteur d'ajustement basé sur la pente
  // Montée: chaque 1% de pente = environ 3-4% d'effort en plus
  // Descente: chaque 1% de pente = environ 1.5% d'effort en moins (jusqu'à -10%)
  let adjustmentFactor = 1;

  if (gradePercent > 0) {
    // Montée: l'effort augmente
    adjustmentFactor = 1 - (gradePercent * 0.033);
  } else if (gradePercent < 0) {
    // Descente: l'effort diminue (mais limité)
    const cappedGrade = Math.max(gradePercent, -10);
    adjustmentFactor = 1 - (cappedGrade * 0.015);
  }

  // GAP = allure réelle * facteur (plus bas = plus rapide)
  return paceMinKm * adjustmentFactor;
}

// Calculer la longueur de foulée
function calculateStrideLength(
  speedMs: number,
  cadenceSpm: number
): number {
  if (speedMs <= 0 || cadenceSpm <= 0) return 0;
  // Longueur = vitesse / (cadence / 60) = distance par pas
  // cadenceSpm = pas par minute, donc pas par seconde = cadenceSpm / 60
  return speedMs / (cadenceSpm / 60);
}

// Évaluer le statut de la cadence
function evaluateCadence(avgCadence: number): 'low' | 'optimal' | 'high' {
  if (avgCadence < 165) return 'low';
  if (avgCadence > 190) return 'high';
  return 'optimal';
}

// Évaluer le statut de la longueur de foulée
function evaluateStrideLength(strideLength: number): 'short' | 'optimal' | 'long' {
  if (strideLength < 0.9) return 'short';
  if (strideLength > 1.4) return 'long';
  return 'optimal';
}

// Calculer la dérive cardiaque
// Compare la FC moyenne de la 1ère et 2ème moitié à allure similaire
function calculateCardiacDrift(
  hrData: number[],
  _timeData: number[],
  velocityData: number[]
): { drift: number; status: 'good' | 'moderate' | 'high' } | null {
  if (!hrData || !velocityData || hrData.length < 10) return null;

  const midpoint = Math.floor(hrData.length / 2);

  // Calculer FC et vitesse moyennes pour chaque moitié
  const firstHalfHr = hrData.slice(0, midpoint);
  const secondHalfHr = hrData.slice(midpoint);
  const firstHalfVel = velocityData.slice(0, midpoint);
  const secondHalfVel = velocityData.slice(midpoint);

  const avgHr1 = firstHalfHr.reduce((a, b) => a + b, 0) / firstHalfHr.length;
  const avgHr2 = secondHalfHr.reduce((a, b) => a + b, 0) / secondHalfHr.length;
  const avgVel1 = firstHalfVel.reduce((a, b) => a + b, 0) / firstHalfVel.length;
  const avgVel2 = secondHalfVel.reduce((a, b) => a + b, 0) / secondHalfVel.length;

  // Normaliser la FC par la vitesse pour comparer à effort égal
  // Si la vitesse a baissé, c'est normal que la FC baisse aussi
  const velocityRatio = avgVel2 / avgVel1;
  const expectedHr2 = avgHr1 * velocityRatio;

  // La dérive est la différence entre FC réelle et attendue
  const drift = ((avgHr2 - expectedHr2) / avgHr1) * 100;

  let status: 'good' | 'moderate' | 'high' = 'good';
  if (drift > 5) status = 'moderate';
  if (drift > 10) status = 'high';

  return { drift: Math.round(drift * 10) / 10, status };
}

// Calculer le facteur d'efficacité (EF)
function calculateEfficiencyFactor(
  speedMs: number,
  avgHr: number
): number {
  if (speedMs <= 0 || avgHr <= 0) return 0;
  // EF = vitesse (m/min) / FC
  return (speedMs * 60) / avgHr;
}

// Calculer les meilleurs efforts sur différentes distances
function calculateBestEfforts(
  distanceData: number[],
  timeData: number[],
  movingData?: (number | boolean)[]
): BestEffort[] {
  const targetDistances = [
    { name: '400m', distance: 400 },
    { name: '1 km', distance: 1000 },
    { name: '1 mile', distance: 1609 },
    { name: '5 km', distance: 5000 },
    { name: '10 km', distance: 10000 },
  ];

  const bestEfforts: BestEffort[] = [];
  const totalDistance = distanceData[distanceData.length - 1] || 0;

  for (const target of targetDistances) {
    // Ne pas calculer si la distance totale est insuffisante
    if (totalDistance < target.distance) continue;

    let bestTime = Infinity;
    let bestStartIndex = 0;

    // Sliding window pour trouver le meilleur segment
    for (let start = 0; start < distanceData.length; start++) {
      const startDist = distanceData[start];
      const targetEnd = startDist + target.distance;

      // Trouver le point de fin
      let end = start;
      while (end < distanceData.length && distanceData[end] < targetEnd) {
        end++;
      }

      if (end >= distanceData.length) break;

      // Calculer le temps pour ce segment (en utilisant moving time si dispo)
      let segmentTime = 0;
      if (movingData) {
        for (let i = start + 1; i <= end; i++) {
          const wasMoving = Boolean(movingData[i]);
          if (wasMoving) {
            segmentTime += timeData[i] - timeData[i - 1];
          }
        }
      } else {
        segmentTime = timeData[end] - timeData[start];
      }

      if (segmentTime < bestTime) {
        bestTime = segmentTime;
        bestStartIndex = start;
      }
    }

    if (bestTime < Infinity) {
      bestEfforts.push({
        name: target.name,
        distance: target.distance,
        time: Math.round(bestTime),
        pace: (bestTime / 60) / (target.distance / 1000),
        startIndex: bestStartIndex,
      });
    }
  }

  return bestEfforts;
}

// Estimer la récupération en tenant compte du type de séance
function estimateRecoveryWithSessionType(
  effort: 'easy' | 'moderate' | 'hard' | 'very_hard',
  durationMinutes: number,
  avgHr?: number,
  maxHr?: number,
  sessionType?: SessionType
): { hours: number; suggestion: string } {
  // Base de récupération selon l'effort perçu
  const baseRecovery: Record<string, number> = {
    'easy': 12,
    'moderate': 24,
    'hard': 36,
    'very_hard': 48,
  };

  let hours = baseRecovery[effort];

  // Ajustements selon le type de séance
  if (sessionType) {
    switch (sessionType) {
      case 'recovery':
        // Récupération active = peu de fatigue supplémentaire
        hours = Math.min(hours, 12);
        break;
      case 'easy':
        // EF standard
        hours = Math.max(12, hours - 6);
        break;
      case 'long_run':
        // Sortie longue = fatigue musculaire importante
        hours += 12;
        if (durationMinutes > 120) hours += 12;
        break;
      case 'tempo':
        // Tempo = fatigue modérée mais durable
        hours = Math.max(24, hours);
        break;
      case 'threshold':
        // Seuil = haute fatigue système lactique
        hours += 6;
        break;
      case 'intervals':
        // Fractionné = fatigue neuromusculaire
        // Mais paradoxalement moins de fatigue que tempo continu de même durée
        if (durationMinutes < 45) {
          hours = Math.max(18, hours - 6);
        }
        break;
      case 'fartlek':
        // Fartlek = entre EF et fractionné
        hours = Math.max(18, hours);
        break;
      case 'race':
        // Compétition = récupération maximale
        hours = Math.max(48, hours + 24);
        break;
      case 'mixed':
        // Séance mixte = garder estimation de base
        break;
    }
  }

  // Ajuster selon la durée (si pas déjà fait par le type)
  if (!sessionType || sessionType === 'easy' || sessionType === 'mixed') {
    if (durationMinutes > 90) hours += 12;
    else if (durationMinutes > 60) hours += 6;
  }

  // Ajuster selon l'intensité cardiaque
  if (avgHr && maxHr) {
    const intensity = avgHr / maxHr;
    if (intensity > 0.88) hours += 12;
    else if (intensity > 0.82) hours += 6;
  }

  // Plafonner la récupération à 96h max
  hours = Math.min(96, hours);

  // Suggestion de prochaine séance adaptée au type
  let suggestion = '';
  if (sessionType === 'race') {
    suggestion = 'Repos complet ou récupération très légère pendant 2-3 jours';
  } else if (sessionType === 'long_run') {
    suggestion = 'Récupération active le lendemain, puis EF légère';
  } else if (sessionType === 'intervals' || sessionType === 'threshold') {
    suggestion = 'EF légère demain, éviter le fractionné pendant 48h';
  } else if (sessionType === 'tempo') {
    suggestion = 'EF possible demain, attendre 48h avant une autre séance tempo';
  } else if (hours >= 36) {
    suggestion = 'Récupération active ou repos complet recommandé';
  } else if (hours >= 24) {
    suggestion = 'Footing léger ou cross-training possible demain';
  } else {
    suggestion = 'Séance normale possible demain';
  }

  return { hours, suggestion };
}

// Calculer la comparaison avec le profil athlète
function calculateProfileComparison(
  avgPace: number,
  hrZonesSource: 'profile' | 'calculated'
): RunningAnalysis['metrics']['profileComparison'] {
  const profile = athleteProfileStore.getProfile();
  const running = profile.running;

  const comparison: RunningAnalysis['metrics']['profileComparison'] = {
    hrZonesSource,
  };

  // Comparaison avec la VMA si disponible
  if (running.vma) {
    const vmaMinKm = 60 / running.vma; // min/km à VMA (100%)
    const avgPacePercent = Math.round((vmaMinKm / avgPace) * 100);

    // Déterminer la zone d'entraînement correspondante
    let expectedZone = 'Récupération';
    if (avgPacePercent >= 110) expectedZone = 'Sprint';
    else if (avgPacePercent >= 100) expectedZone = 'Fractionné court';
    else if (avgPacePercent >= 95) expectedZone = 'Fractionné long';
    else if (avgPacePercent >= 85) expectedZone = 'Seuil';
    else if (avgPacePercent >= 80) expectedZone = 'Marathon / Tempo';
    else if (avgPacePercent >= 65) expectedZone = 'Endurance';
    else expectedZone = 'Récupération';

    comparison.paceVsVma = {
      vma: running.vma,
      avgPacePercent,
      expectedZone,
    };
  }

  // Comparaison avec les allures de référence
  if (running.referencePaces && Object.keys(running.referencePaces).length > 0) {
    const paces = running.referencePaces;
    const zones: { name: string; pace: number }[] = [];

    if (paces.recovery) zones.push({ name: 'Récupération', pace: paces.recovery });
    if (paces.easy) zones.push({ name: 'Endurance', pace: paces.easy });
    if (paces.marathon) zones.push({ name: 'Marathon', pace: paces.marathon });
    if (paces.threshold) zones.push({ name: 'Seuil', pace: paces.threshold });
    if (paces.intervalLong) zones.push({ name: 'Fractionné long', pace: paces.intervalLong });
    if (paces.intervalShort) zones.push({ name: 'Fractionné court', pace: paces.intervalShort });
    if (paces.sprint) zones.push({ name: 'Sprint', pace: paces.sprint });

    // Trouver la zone la plus proche
    let closestZone = zones[0];
    let minDiff = Math.abs(avgPace - zones[0].pace);

    for (const zone of zones) {
      const diff = Math.abs(avgPace - zone.pace);
      if (diff < minDiff) {
        minDiff = diff;
        closestZone = zone;
      }
    }

    const difference = (avgPace - closestZone.pace) * 60; // en secondes/km
    let status: 'slower' | 'on_target' | 'faster' = 'on_target';
    if (difference > 5) status = 'slower';
    else if (difference < -5) status = 'faster';

    comparison.paceVsReference = {
      closestZone: closestZone.name,
      difference: Math.round(difference),
      status,
    };
  }

  return comparison;
}

// Calculer les zones FC (basé sur FC max estimée) - fallback si pas de profil
function calculateHrZonesFallback(maxHr: number): { min: number; max: number; name: string }[] {
  return [
    { min: 0, max: Math.round(maxHr * 0.6), name: 'Récupération' },
    { min: Math.round(maxHr * 0.6), max: Math.round(maxHr * 0.7), name: 'Endurance' },
    { min: Math.round(maxHr * 0.7), max: Math.round(maxHr * 0.8), name: 'Tempo' },
    { min: Math.round(maxHr * 0.8), max: Math.round(maxHr * 0.9), name: 'Seuil' },
    { min: Math.round(maxHr * 0.9), max: maxHr, name: 'VO2max' },
  ];
}

// Obtenir les zones FC depuis le profil ou calculer en fallback
function getHrZones(maxHr: number): { zones: { min: number; max: number; name: string }[]; source: 'profile' | 'calculated' } {
  const profile = athleteProfileStore.getProfile();

  // Utiliser les zones du profil si disponibles
  if (profile.running.hrZones && profile.running.hrZones.length >= 5) {
    return {
      zones: profile.running.hrZones.map(z => ({
        min: z.min,
        max: z.max === 999 ? maxHr : z.max,
        name: z.name,
      })),
      source: 'profile',
    };
  }

  // Sinon calculer depuis la FCMax du profil ou celle de l'activité
  const fcMax = profile.running.maxHr || maxHr;
  const restingHr = profile.running.restingHr;

  if (restingHr) {
    // Méthode Karvonen avec réserve cardiaque
    const hrReserve = fcMax - restingHr;
    return {
      zones: [
        { min: restingHr, max: Math.round(restingHr + hrReserve * 0.6), name: 'Récupération' },
        { min: Math.round(restingHr + hrReserve * 0.6), max: Math.round(restingHr + hrReserve * 0.7), name: 'Endurance' },
        { min: Math.round(restingHr + hrReserve * 0.7), max: Math.round(restingHr + hrReserve * 0.8), name: 'Tempo' },
        { min: Math.round(restingHr + hrReserve * 0.8), max: Math.round(restingHr + hrReserve * 0.9), name: 'Seuil' },
        { min: Math.round(restingHr + hrReserve * 0.9), max: fcMax, name: 'VO2max' },
      ],
      source: 'calculated',
    };
  }

  return {
    zones: calculateHrZonesFallback(fcMax),
    source: 'calculated',
  };
}

// Analyser les données de streams pour calculer le temps par zone FC
function analyzeHrZones(
  hrData: number[],
  timeData: number[],
  maxHr: number
): { hrZones: HrZoneTime[]; source: 'profile' | 'calculated' } {
  const { zones, source } = getHrZones(maxHr);
  const zoneTime: number[] = [0, 0, 0, 0, 0];
  let totalTime = 0;

  for (let i = 1; i < hrData.length; i++) {
    const hr = hrData[i];
    const duration = timeData[i] - timeData[i - 1];
    totalTime += duration;

    for (let z = zones.length - 1; z >= 0; z--) {
      if (hr >= zones[z].min) {
        zoneTime[z] += duration;
        break;
      }
    }
  }

  const hrZones = zones.map((zone, i) => ({
    zone: i + 1,
    name: zone.name,
    minHr: zone.min,
    maxHr: zone.max,
    duration: Math.round(zoneTime[i]),
    percent: totalTime > 0 ? Math.round((zoneTime[i] / totalTime) * 100) : 0,
  }));

  return { hrZones, source };
}

// Calculer les splits par km à partir des streams
// movingData est un tableau de 0/1 ou true/false indiquant si l'athlète bougeait
function calculateSplitsFromStreams(
  distanceData: number[],
  timeData: number[],
  hrData?: number[],
  cadenceData?: number[],
  altitudeData?: number[],
  movingData?: (number | boolean)[]
): SplitAnalysis[] {
  const splits: SplitAnalysis[] = [];
  let currentKm = 1;
  let kmStartIndex = 0;
  let kmStartDistance = 0;
  let kmStartMovingTime = 0;
  let accumulatedMovingTime = 0;

  // Calculer le temps de mouvement cumulé à chaque point
  const movingTimeAtPoint: number[] = [0];
  for (let i = 1; i < timeData.length; i++) {
    const timeDelta = timeData[i] - timeData[i - 1];
    // Si on a les données de mouvement, on les utilise (truthy = en mouvement)
    const wasMoving = movingData ? Boolean(movingData[i]) : true;
    accumulatedMovingTime += wasMoving ? timeDelta : 0;
    movingTimeAtPoint.push(accumulatedMovingTime);
  }

  for (let i = 0; i < distanceData.length; i++) {
    const distance = distanceData[i];

    // Nouveau km atteint
    while (distance >= currentKm * 1000) {
      const kmEndIndex = i;
      const kmDistance = currentKm * 1000 - kmStartDistance;
      // Utiliser le temps de mouvement, pas le temps écoulé
      const kmDuration = movingTimeAtPoint[i] - kmStartMovingTime;

      // Calculer les moyennes pour ce km
      let avgHr: number | undefined;
      let avgCadence: number | undefined;
      let elevation: number | undefined;

      if (hrData && kmStartIndex < kmEndIndex) {
        const hrSlice = hrData.slice(kmStartIndex, kmEndIndex + 1);
        avgHr = Math.round(hrSlice.reduce((a, b) => a + b, 0) / hrSlice.length);
      }

      if (cadenceData && kmStartIndex < kmEndIndex) {
        const cadSlice = cadenceData.slice(kmStartIndex, kmEndIndex + 1);
        avgCadence = Math.round(cadSlice.reduce((a, b) => a + b, 0) / cadSlice.length);
      }

      if (altitudeData && kmStartIndex < kmEndIndex) {
        const startAlt = altitudeData[kmStartIndex];
        const endAlt = altitudeData[kmEndIndex];
        elevation = Math.round(endAlt - startAlt);
      }

      const pace = kmDuration > 0 ? (kmDuration / 60) / (kmDistance / 1000) : 0;

      splits.push({
        km: currentKm,
        distance: Math.round(kmDistance),
        duration: Math.round(kmDuration),
        pace,
        avgHr,
        avgCadence,
        elevation,
        comparison: 'average', // Sera mis à jour après
      });

      kmStartIndex = i;
      kmStartDistance = currentKm * 1000;
      kmStartMovingTime = movingTimeAtPoint[i];
      currentKm++;
    }
  }

  // Dernier km partiel si > 500m
  const lastDistance = distanceData[distanceData.length - 1];
  const remainingDistance = lastDistance - (currentKm - 1) * 1000;
  if (remainingDistance > 500) {
    const lastIndex = distanceData.length - 1;
    const kmDuration = movingTimeAtPoint[lastIndex] - kmStartMovingTime;
    const pace = kmDuration > 0 ? (kmDuration / 60) / (remainingDistance / 1000) : 0;

    splits.push({
      km: currentKm,
      distance: Math.round(remainingDistance),
      duration: Math.round(kmDuration),
      pace,
      comparison: 'average',
    });
  }

  // Calculer la comparaison avec la moyenne
  if (splits.length > 0) {
    const avgPace = splits.reduce((sum, s) => sum + s.pace, 0) / splits.length;
    const threshold = avgPace * 0.03; // 3% de variation

    for (const split of splits) {
      if (split.pace < avgPace - threshold) {
        split.comparison = 'faster';
      } else if (split.pace > avgPace + threshold) {
        split.comparison = 'slower';
      }
    }
  }

  return splits;
}

/**
 * Détecte la structure d'une séance en analysant les changements de rythme
 * Approche : détecter tous les segments, puis grouper par similarité
 */
function detectWorkoutStructure(
  distanceData: number[],
  timeData: number[],
  velocityData: number[],
  hrData?: number[]
): WorkoutStructure | undefined {
  console.log('[IntervalDetection] Données reçues:', {
    distancePoints: distanceData?.length || 0,
    timePoints: timeData?.length || 0,
    velocityPoints: velocityData?.length || 0,
    hrPoints: hrData?.length || 0,
  });

  if (!velocityData || velocityData.length < 60) {
    console.log('[IntervalDetection] Pas assez de données velocity (<60 points)');
    return undefined;
  }

  // 1. Lisser les données de vitesse (moyenne glissante 15 sec)
  const windowSize = 15;
  const smoothedVelocity: number[] = [];
  for (let i = 0; i < velocityData.length; i++) {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(velocityData.length, i + windowSize + 1);
    const slice = velocityData.slice(start, end).filter(v => v > 0.3);
    if (slice.length > 0) {
      smoothedVelocity.push(slice.reduce((a, b) => a + b, 0) / slice.length);
    } else {
      smoothedVelocity.push(0);
    }
  }

  // 2. Détecter les points de changement de rythme (variation > 20%)
  const changePoints: number[] = [0]; // Commence au début
  const minSegmentDuration = 45; // Au moins 45 secondes entre changements
  const windowSize2 = 20; // Fenêtre de comparaison plus large

  let lastChangeIdx = 0;
  for (let i = minSegmentDuration; i < smoothedVelocity.length - minSegmentDuration; i++) {
    if (i - lastChangeIdx < minSegmentDuration) continue;

    const before = smoothedVelocity.slice(Math.max(0, i - windowSize2), i);
    const after = smoothedVelocity.slice(i, Math.min(smoothedVelocity.length, i + windowSize2));

    const avgBefore = before.filter(v => v > 0).reduce((a, b) => a + b, 0) / before.length || 0;
    const avgAfter = after.filter(v => v > 0).reduce((a, b) => a + b, 0) / after.length || 0;

    if (avgBefore > 0 && avgAfter > 0) {
      const changePercent = Math.abs(avgAfter - avgBefore) / avgBefore;
      if (changePercent > 0.20) { // 20% de variation = changement significatif
        changePoints.push(i);
        lastChangeIdx = i;
      }
    }
  }
  changePoints.push(smoothedVelocity.length - 1); // Termine à la fin

  console.log('[IntervalDetection] Points de changement détectés:', changePoints.length, changePoints);

  // 3. Créer les segments à partir des points de changement
  const allSegments: IntervalSegment[] = [];

  for (let i = 0; i < changePoints.length - 1; i++) {
    const startIdx = changePoints[i];
    const endIdx = changePoints[i + 1];

    if (endIdx - startIdx < 30) continue; // Segment trop court (< 30 sec)

    const startDist = distanceData[startIdx] || 0;
    const endDist = distanceData[endIdx] || 0;
    const startTime = timeData[startIdx] || 0;
    const endTime = timeData[endIdx] || 0;

    const segmentVelocities = smoothedVelocity.slice(startIdx, endIdx + 1).filter(v => v > 0);
    const avgVelocity = segmentVelocities.length > 0
      ? segmentVelocities.reduce((a, b) => a + b, 0) / segmentVelocities.length
      : 0;
    const avgPace = avgVelocity > 0 ? (1000 / 60) / avgVelocity : 0;

    let avgHr: number | undefined;
    if (hrData) {
      const hrSlice = hrData.slice(startIdx, endIdx + 1).filter(h => h > 0);
      if (hrSlice.length > 0) {
        avgHr = Math.round(hrSlice.reduce((a, b) => a + b, 0) / hrSlice.length);
      }
    }

    allSegments.push({
      type: 'steady', // On classifiera après
      startTime,
      endTime,
      duration: Math.round(endTime - startTime),
      distance: Math.round(endDist - startDist),
      avgPace,
      avgHr,
    });
  }

  if (allSegments.length < 2) {
    return { mainSegments: allSegments, isStructuredInterval: false };
  }

  // 4. Fusionner les segments adjacents de pace similaire (< 10% de différence)
  const mergedSegments: IntervalSegment[] = [];
  for (const seg of allSegments) {
    const lastMerged = mergedSegments[mergedSegments.length - 1];
    if (lastMerged) {
      const paceDiff = Math.abs(seg.avgPace - lastMerged.avgPace) / lastMerged.avgPace;
      if (paceDiff < 0.10) {
        // Fusionner avec le segment précédent
        const totalDist = lastMerged.distance + seg.distance;
        const totalDur = lastMerged.duration + seg.duration;
        lastMerged.endTime = seg.endTime;
        lastMerged.distance = totalDist;
        lastMerged.duration = totalDur;
        lastMerged.avgPace = (totalDur / 60) / (totalDist / 1000);
        if (seg.avgHr && lastMerged.avgHr) {
          lastMerged.avgHr = Math.round((lastMerged.avgHr + seg.avgHr) / 2);
        }
        continue;
      }
    }
    mergedSegments.push({ ...seg });
  }

  console.log('[IntervalDetection] Segments après fusion:', mergedSegments.length);

  // 5. Calculer l'allure moyenne globale pour classifier les segments
  const totalDist = mergedSegments.reduce((sum, s) => sum + s.distance, 0);
  const totalTime = mergedSegments.reduce((sum, s) => sum + s.duration, 0);
  const globalAvgPace = totalTime > 0 ? (totalTime / 60) / (totalDist / 1000) : 0;

  // 6. Classifier chaque segment (rapide/lent par rapport à la moyenne)
  for (const seg of mergedSegments) {
    if (seg.avgPace < globalAvgPace * 0.90) {
      seg.type = 'fast';
    } else if (seg.avgPace > globalAvgPace * 1.10) {
      seg.type = 'recovery';
    } else {
      seg.type = 'steady';
    }
  }

  // 8. Identifier warmup (premier segment si lent) et cooldown (dernier si lent)
  let warmup: IntervalSegment | undefined;
  let cooldown: IntervalSegment | undefined;
  let mainSegments = [...mergedSegments];

  // Warmup : premier segment si > 2min et plus lent que la moyenne
  if (mainSegments[0] && mainSegments[0].duration > 120 && mainSegments[0].avgPace > globalAvgPace) {
    warmup = { ...mainSegments[0], type: 'warmup' };
    mainSegments = mainSegments.slice(1);
  }

  // Cooldown : dernier segment si > 1min30 et plus lent que la moyenne
  const lastIdx = mainSegments.length - 1;
  if (lastIdx >= 0 && mainSegments[lastIdx].duration > 90 && mainSegments[lastIdx].avgPace > globalAvgPace) {
    cooldown = { ...mainSegments[lastIdx], type: 'cooldown' };
    mainSegments = mainSegments.slice(0, lastIdx);
  }

  // 9. Détecter les patterns de répétition par distance ou durée similaire
  // Ne considérer que les segments > 100m pour éviter le bruit
  let intervalPattern: IntervalPattern | undefined;
  const significantFastSegments = mainSegments.filter(s => s.type === 'fast' && s.distance >= 100);
  const recoverySegments = mainSegments.filter(s => (s.type === 'recovery' || s.type === 'steady') && s.distance >= 50);

  // Chercher des groupes de segments avec distance similaire (±20%)
  if (significantFastSegments.length >= 2) {
    const distGroups = groupBySimilarity(significantFastSegments.map(s => s.distance), 0.20);
    const largestGroup = distGroups.reduce((max, g) => g.length > max.length ? g : max, []);

    if (largestGroup.length >= 2) {
      const matchingSegments = largestGroup.map(idx => significantFastSegments[idx]);
      const avgDist = matchingSegments.reduce((sum, s) => sum + s.distance, 0) / matchingSegments.length;
      const avgDur = matchingSegments.reduce((sum, s) => sum + s.duration, 0) / matchingSegments.length;
      const avgPace = matchingSegments.reduce((sum, s) => sum + s.avgPace, 0) / matchingSegments.length;

      // Calculer les récups entre les intervalles rapides
      let avgRecDist = 0, avgRecDur = 0, avgRecPace = 0;
      if (recoverySegments.length > 0) {
        avgRecDist = recoverySegments.reduce((sum, s) => sum + s.distance, 0) / recoverySegments.length;
        avgRecDur = recoverySegments.reduce((sum, s) => sum + s.duration, 0) / recoverySegments.length;
        avgRecPace = recoverySegments.reduce((sum, s) => sum + s.avgPace, 0) / recoverySegments.length;
      }

      intervalPattern = {
        count: matchingSegments.length,
        avgDistance: Math.round(avgDist),
        avgDuration: Math.round(avgDur),
        avgPace,
        avgRecoveryDistance: Math.round(avgRecDist),
        avgRecoveryDuration: Math.round(avgRecDur),
        avgRecoveryPace: avgRecPace,
      };
    }
  }

  const isStructuredInterval = (intervalPattern?.count ?? 0) >= 2;

  const result = {
    warmup,
    cooldown,
    mainSegments,
    intervalPattern,
    isStructuredInterval,
  };

  console.log('[IntervalDetection] Résultat final:', {
    hasWarmup: !!warmup,
    hasCooldown: !!cooldown,
    mainSegmentsCount: mainSegments.length,
    intervalPattern: intervalPattern ? `${intervalPattern.count}x ~${intervalPattern.avgDistance}m` : 'aucun',
    isStructuredInterval,
    segments: mainSegments.map(s => ({
      type: s.type,
      dist: s.distance,
      dur: s.duration,
      pace: s.avgPace.toFixed(2),
    })),
  });

  return result;
}

/**
 * Groupe les valeurs similaires (dans une tolérance donnée)
 * Retourne les indices des éléments dans chaque groupe
 */
function groupBySimilarity(values: number[], tolerance: number): number[][] {
  const groups: number[][] = [];
  const used = new Set<number>();

  for (let i = 0; i < values.length; i++) {
    if (used.has(i)) continue;

    const group = [i];
    used.add(i);

    for (let j = i + 1; j < values.length; j++) {
      if (used.has(j)) continue;

      const diff = Math.abs(values[j] - values[i]) / values[i];
      if (diff <= tolerance) {
        group.push(j);
        used.add(j);
      }
    }

    groups.push(group);
  }

  return groups;
}

// Estimer le niveau d'effort
function estimateEffort(
  avgPace: number,
  avgHr?: number,
  maxHr?: number,
  _duration?: number
): 'easy' | 'moderate' | 'hard' | 'very_hard' {
  // Basé sur la FC si disponible
  if (avgHr && maxHr) {
    const hrPercent = avgHr / maxHr;
    if (hrPercent < 0.7) return 'easy';
    if (hrPercent < 0.8) return 'moderate';
    if (hrPercent < 0.9) return 'hard';
    return 'very_hard';
  }

  // Sinon basé sur l'allure (approximation)
  if (avgPace < 4.5) return 'very_hard';
  if (avgPace < 5.5) return 'hard';
  if (avgPace < 6.5) return 'moderate';
  return 'easy';
}

// Identifier les points forts et axes d'amélioration
function identifyInsights(
  _splits: SplitAnalysis[],
  metrics: RunningAnalysis['metrics']
): { strengths: string[]; improvements: string[] } {
  const strengths: string[] = [];
  const improvements: string[] = [];

  // Régularité d'allure
  if (metrics.paceVariability < 5) {
    strengths.push('Excellente régularité d\'allure');
  } else if (metrics.paceVariability > 10) {
    improvements.push('Travailler la régularité d\'allure (variation > 10%)');
  }

  // Negative split
  if (metrics.negativeSplit) {
    strengths.push('Negative split : accélération en 2ème partie');
  } else if (metrics.secondHalfPace > metrics.firstHalfPace * 1.05) {
    improvements.push('Éviter de partir trop vite - la 2ème moitié était plus lente');
  }

  // Cadence
  if (metrics.avgCadence) {
    if (metrics.cadenceStatus === 'optimal') {
      strengths.push('Cadence optimale (170-190 pas/min)');
    } else if (metrics.cadenceStatus === 'low') {
      improvements.push('Augmenter la cadence (viser 175-180 pas/min) pour réduire l\'impact');
    }
    // Variabilité cadence
    if (metrics.cadenceVariability !== undefined && metrics.cadenceVariability < 5) {
      strengths.push('Cadence très régulière');
    }
  }

  // Longueur de foulée
  if (metrics.avgStrideLength) {
    if (metrics.strideLengthStatus === 'optimal') {
      strengths.push('Longueur de foulée adaptée');
    } else if (metrics.strideLengthStatus === 'long') {
      improvements.push('Foulée peut-être trop longue - risque de sur-stride');
    }
  }

  // Dérive cardiaque
  if (metrics.cardiacDrift !== undefined) {
    if (metrics.cardiacDriftStatus === 'good') {
      strengths.push('Excellente stabilité cardiaque (bonne hydratation/forme)');
    } else if (metrics.cardiacDriftStatus === 'high') {
      improvements.push('Dérive cardiaque élevée - penser à l\'hydratation et à la récupération');
    }
  }

  // Efficacité
  if (metrics.efficiencyTrend === 'improving') {
    strengths.push('Efficacité en amélioration au fil de la séance');
  } else if (metrics.efficiencyTrend === 'declining') {
    improvements.push('Efficacité en baisse - fatigue musculaire possible');
  }

  // Zones FC
  if (metrics.hrZones) {
    const easyZonePercent = (metrics.hrZones[0]?.percent || 0) + (metrics.hrZones[1]?.percent || 0);
    const hardZonePercent = (metrics.hrZones[3]?.percent || 0) + (metrics.hrZones[4]?.percent || 0);

    if (easyZonePercent > 70 && metrics.estimatedEffort === 'easy') {
      strengths.push('Bonne séance d\'endurance fondamentale');
    }
    if (hardZonePercent > 30) {
      strengths.push('Bonne intensité pour une séance qualitative');
    }
  }

  // GAP - terrain vallonné bien géré
  if (metrics.avgGAP && metrics.gapDifference && metrics.gapDifference > 10) {
    strengths.push('Bon effort malgré le terrain vallonné');
  }

  return { strengths, improvements };
}

// Formater une durée en mm:ss ou hh:mm:ss
function formatDuration(seconds: number): string {
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}'${secs.toString().padStart(2, '0')}`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h${mins.toString().padStart(2, '0')}`;
}

// Formater une distance en mètres ou km
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)}m`;
}

// Générer le résumé texte pour l'IA
function generateSummary(analysis: RunningAnalysis): string {
  const { activity, splits, metrics, strengths, improvements, workoutStructure } = analysis;

  console.log('[GenerateSummary] workoutStructure reçu:', workoutStructure ? {
    hasWarmup: !!workoutStructure.warmup,
    hasCooldown: !!workoutStructure.cooldown,
    mainSegments: workoutStructure.mainSegments?.length || 0,
    isStructuredInterval: workoutStructure.isStructuredInterval,
  } : 'undefined');

  const date = new Date(activity.start_date_local).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  let summary = `# Analyse de la séance : ${activity.name}\n`;
  summary += `Date : ${date}\n\n`;

  // Résumé global
  summary += `## Résumé\n`;
  summary += `- Distance : ${(activity.distance / 1000).toFixed(2)} km\n`;
  summary += `- Durée : ${Math.floor(activity.moving_time / 60)} min ${activity.moving_time % 60} sec\n`;
  summary += `- Allure moyenne : ${formatPace(metrics.avgPace)}/km\n`;

  // GAP si différent de l'allure réelle
  if (metrics.avgGAP && metrics.gapDifference && Math.abs(metrics.gapDifference) > 3) {
    summary += `- GAP (allure ajustée terrain) : ${formatPace(metrics.avgGAP)}/km`;
    summary += metrics.gapDifference > 0 ? ` (${Math.round(metrics.gapDifference)}s/km plus rapide sur plat)\n` : '\n';
  }

  if (metrics.avgHr) {
    summary += `- FC moyenne : ${metrics.avgHr} bpm (max: ${metrics.maxHr} bpm)\n`;
  }
  if (metrics.avgCadence) {
    const cadenceIcon = metrics.cadenceStatus === 'optimal' ? '✅' : metrics.cadenceStatus === 'low' ? '⚠️' : '⚡';
    summary += `- Cadence moyenne : ${metrics.avgCadence} pas/min ${cadenceIcon}\n`;
  }
  if (metrics.avgStrideLength) {
    summary += `- Longueur de foulée : ${metrics.avgStrideLength}m\n`;
  }
  if (metrics.elevationGain > 10) {
    summary += `- Dénivelé : +${metrics.elevationGain}m / -${metrics.elevationLoss}m\n`;
  }
  summary += `- Niveau d'effort estimé : ${metrics.estimatedEffort}\n`;

  // Type de séance détecté
  if (metrics.sessionType) {
    const sessionLabel = SESSION_TYPE_LABELS[metrics.sessionType] || metrics.sessionType;
    summary += `- Type de séance : ${sessionLabel}`;
    if (metrics.sessionTypeConfidence && metrics.sessionTypeConfidence >= 50) {
      summary += ` (confiance: ${metrics.sessionTypeConfidence}%)`;
    }
    summary += '\n';
  }

  // Structure de la séance (intervalles détectés)
  if (workoutStructure && (workoutStructure.mainSegments.length > 0 || workoutStructure.warmup || workoutStructure.cooldown)) {
    summary += `\n## Structure de la séance (${workoutStructure.mainSegments.length + (workoutStructure.warmup ? 1 : 0) + (workoutStructure.cooldown ? 1 : 0)} segments détectés)\n`;

    // Pattern résumé si détecté
    if (workoutStructure.intervalPattern && workoutStructure.intervalPattern.count >= 2) {
      const p = workoutStructure.intervalPattern;
      summary += `**Pattern détecté** : ${p.count} x ~${formatDistance(p.avgDistance)} à ${formatPace(p.avgPace)}/km`;
      if (p.avgRecoveryDistance > 0) {
        summary += ` (récup ~${formatDistance(p.avgRecoveryDistance)} à ${formatPace(p.avgRecoveryPace)}/km)`;
      }
      summary += '\n\n';
    }

    // Échauffement
    if (workoutStructure.warmup) {
      const w = workoutStructure.warmup;
      summary += `1. **Échauffement** : ${formatDistance(w.distance)} en ${formatDuration(w.duration)} à ${formatPace(w.avgPace)}/km`;
      if (w.avgHr) summary += ` | FC ${w.avgHr}`;
      summary += '\n';
    }

    // Tous les segments du corps de séance avec numérotation
    let segNum = workoutStructure.warmup ? 2 : 1;
    for (const seg of workoutStructure.mainSegments) {
      const typeLabel = seg.type === 'fast' ? '🔴' : seg.type === 'recovery' ? '🟢' : '⚪';
      const typeText = seg.type === 'fast' ? 'Effort' : seg.type === 'recovery' ? 'Récup' : 'Transition';
      summary += `${segNum}. ${typeLabel} **${typeText}** : ${formatDistance(seg.distance)} en ${formatDuration(seg.duration)} à ${formatPace(seg.avgPace)}/km`;
      if (seg.avgHr) summary += ` | FC ${seg.avgHr}`;
      summary += '\n';
      segNum++;
    }

    // Retour au calme
    if (workoutStructure.cooldown) {
      const c = workoutStructure.cooldown;
      summary += `${segNum}. **Retour au calme** : ${formatDistance(c.distance)} en ${formatDuration(c.duration)} à ${formatPace(c.avgPace)}/km`;
      if (c.avgHr) summary += ` | FC ${c.avgHr}`;
      summary += '\n';
    }
  }

  // Efficacité et dérive cardiaque
  if (metrics.efficiencyFactor) {
    summary += `- Facteur d'efficacité : ${metrics.efficiencyFactor.toFixed(2)}`;
    if (metrics.efficiencyTrend) {
      const trendIcon = metrics.efficiencyTrend === 'improving' ? '📈' : metrics.efficiencyTrend === 'declining' ? '📉' : '➡️';
      summary += ` ${trendIcon}`;
    }
    summary += '\n';
  }
  if (metrics.cardiacDrift !== undefined) {
    const driftIcon = metrics.cardiacDriftStatus === 'good' ? '✅' : metrics.cardiacDriftStatus === 'moderate' ? '⚠️' : '🔴';
    summary += `- Dérive cardiaque : ${metrics.cardiacDrift > 0 ? '+' : ''}${metrics.cardiacDrift}% ${driftIcon}\n`;
  }

  // Splits
  summary += `\n## Splits par kilomètre\n`;
  for (const split of splits) {
    const icon = split.comparison === 'faster' ? '🟢' : split.comparison === 'slower' ? '🔴' : '⚪';
    summary += `- Km ${split.km}: ${formatPace(split.pace)}/km ${icon}`;
    if (split.avgHr) summary += ` | FC: ${split.avgHr}`;
    if (split.avgCadence) summary += ` | Cad: ${split.avgCadence}`;
    summary += '\n';
  }

  // Stratégie de course
  summary += `\n## Stratégie de course\n`;
  summary += `- 1ère moitié : ${formatPace(metrics.firstHalfPace)}/km\n`;
  summary += `- 2ème moitié : ${formatPace(metrics.secondHalfPace)}/km\n`;
  summary += `- ${metrics.negativeSplit ? '✅ Negative split (bien !)' : '⚠️ Positive split'}\n`;
  summary += `- Régularité : ${metrics.paceVariability.toFixed(1)}% de variation\n`;

  // Meilleurs efforts
  if (metrics.bestEfforts && metrics.bestEfforts.length > 0) {
    summary += `\n## Meilleurs efforts de la séance\n`;
    for (const effort of metrics.bestEfforts) {
      const mins = Math.floor(effort.time / 60);
      const secs = effort.time % 60;
      summary += `- ${effort.name} : ${mins}:${secs.toString().padStart(2, '0')} (${formatPace(effort.pace)}/km)\n`;
    }
  }

  // Zones FC si disponibles
  if (metrics.hrZones && metrics.hrZones.length > 0) {
    summary += `\n## Temps par zone cardiaque\n`;
    for (const zone of metrics.hrZones) {
      if (zone.percent > 0) {
        const mins = Math.floor(zone.duration / 60);
        summary += `- Z${zone.zone} ${zone.name} (${zone.minHr}-${zone.maxHr} bpm): ${mins} min (${zone.percent}%)\n`;
      }
    }
  }

  // Comparaison avec le profil athlète
  if (metrics.profileComparison) {
    const pc = metrics.profileComparison;
    summary += `\n## Comparaison avec ton profil\n`;

    if (pc.hrZonesSource === 'profile') {
      summary += `- Zones FC : basées sur ton profil\n`;
    }

    if (pc.paceVsVma) {
      summary += `- Allure moyenne : ${pc.paceVsVma.avgPacePercent}% de ta VMA (${pc.paceVsVma.vma} km/h)\n`;
      summary += `- Zone d'effort correspondante : ${pc.paceVsVma.expectedZone}\n`;
    }

    if (pc.paceVsReference) {
      const statusIcon = pc.paceVsReference.status === 'on_target' ? '✅' :
                         pc.paceVsReference.status === 'faster' ? '🚀' : '🐢';
      const diffText = pc.paceVsReference.difference > 0
        ? `+${pc.paceVsReference.difference}s/km plus lent`
        : pc.paceVsReference.difference < 0
          ? `${Math.abs(pc.paceVsReference.difference)}s/km plus rapide`
          : 'pile dans la cible';
      summary += `- Par rapport à ton allure ${pc.paceVsReference.closestZone} : ${diffText} ${statusIcon}\n`;
    }
  }

  // Points forts et améliorations
  if (strengths.length > 0) {
    summary += `\n## Points forts\n`;
    for (const s of strengths) {
      summary += `- ✅ ${s}\n`;
    }
  }

  if (improvements.length > 0) {
    summary += `\n## Axes d'amélioration\n`;
    for (const i of improvements) {
      summary += `- 💡 ${i}\n`;
    }
  }

  // Récupération
  if (metrics.estimatedRecoveryHours) {
    summary += `\n## Récupération\n`;
    summary += `- Temps de récupération estimé : ${metrics.estimatedRecoveryHours}h\n`;
    if (metrics.nextWorkoutSuggestion) {
      summary += `- Conseil : ${metrics.nextWorkoutSuggestion}\n`;
    }
  }

  return summary;
}

// Labels des types de séance
export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  'recovery': 'Récupération',
  'easy': 'Endurance fondamentale',
  'long_run': 'Sortie longue',
  'tempo': 'Tempo',
  'threshold': 'Seuil',
  'intervals': 'Fractionné',
  'fartlek': 'Fartlek',
  'race': 'Compétition',
  'mixed': 'Séance mixte',
};

/**
 * Détecte le type de séance basé sur les caractéristiques de l'activité
 */
function detectSessionType(
  details: StravaActivityDetails,
  _splits: SplitAnalysis[],
  hrZones?: HrZoneTime[],
  paceVariability?: number,
  laps?: StravaLap[]
): SessionTypeResult {
  const characteristics: string[] = [];
  const scores: Record<SessionType, number> = {
    'recovery': 0,
    'easy': 0,
    'long_run': 0,
    'tempo': 0,
    'threshold': 0,
    'intervals': 0,
    'fartlek': 0,
    'race': 0,
    'mixed': 0,
  };

  const durationMin = details.moving_time / 60;

  // 1. Analyser la durée/distance
  if (durationMin < 30) {
    scores['recovery'] += 15;
    scores['easy'] += 10;
  } else if (durationMin >= 30 && durationMin < 50) {
    scores['easy'] += 15;
    scores['tempo'] += 10;
  } else if (durationMin >= 50 && durationMin < 80) {
    scores['easy'] += 10;
    scores['tempo'] += 15;
    scores['threshold'] += 10;
  } else if (durationMin >= 80) {
    scores['long_run'] += 25;
    characteristics.push('Durée longue (>80min)');
  }

  // 2. Analyser la variabilité de l'allure
  if (paceVariability !== undefined) {
    if (paceVariability < 5) {
      // Très régulier
      scores['tempo'] += 15;
      scores['threshold'] += 15;
      scores['race'] += 10;
      characteristics.push('Allure très régulière');
    } else if (paceVariability < 10) {
      // Assez régulier
      scores['easy'] += 10;
      scores['long_run'] += 10;
    } else if (paceVariability < 20) {
      // Variable
      scores['fartlek'] += 20;
      characteristics.push('Variations d\'allure');
    } else {
      // Très variable - probable fractionné
      scores['intervals'] += 30;
      characteristics.push('Forte variabilité d\'allure');
    }
  }

  // 3. Analyser les zones FC
  if (hrZones && hrZones.length >= 5) {
    const z1z2Percent = (hrZones[0]?.percent || 0) + (hrZones[1]?.percent || 0);
    const z3Percent = hrZones[2]?.percent || 0;
    const z4Percent = hrZones[3]?.percent || 0;
    const z5Percent = hrZones[4]?.percent || 0;
    const z4z5Percent = z4Percent + z5Percent;

    if (z1z2Percent > 80) {
      scores['recovery'] += 25;
      scores['easy'] += 20;
      characteristics.push('Majoritairement en Z1-Z2');
    } else if (z1z2Percent > 60) {
      scores['easy'] += 15;
      scores['long_run'] += 15;
    }

    if (z3Percent > 40) {
      scores['tempo'] += 20;
      characteristics.push('Beaucoup de temps en Z3 (tempo)');
    }

    if (z4Percent > 30) {
      scores['threshold'] += 25;
      characteristics.push('Effort soutenu en Z4 (seuil)');
    }

    if (z4z5Percent > 50) {
      scores['race'] += 20;
      scores['threshold'] += 10;
      characteristics.push('Haute intensité (>50% en Z4-Z5)');
    }

    // Pattern fractionné: alternance entre zones basses et hautes
    // Approximation basée sur la distribution
    if (z5Percent > 15 && z1z2Percent > 30) {
      scores['intervals'] += 20;
      characteristics.push('Distribution FC typique fractionné');
    }
  }

  // 4. Analyser les laps (si disponibles et nombreux)
  if (laps && laps.length >= 4) {
    const lapPaces = laps.map(l => l.distance > 0 ? l.moving_time / (l.distance / 1000) : 0);
    const validPaces = lapPaces.filter(p => p > 0 && p < 15);

    if (validPaces.length >= 4) {
      // Vérifier si les laps ont une structure répétée (fractionné)
      const lapDistances = laps.map(l => l.distance);
      const uniqueDistances = new Set(lapDistances.map(d => Math.round(d / 50) * 50)); // Arrondir à 50m

      if (uniqueDistances.size <= 3 && laps.length >= 6) {
        // Distances répétitives = fractionné structuré
        scores['intervals'] += 25;
        characteristics.push(`${laps.length} laps avec distances répétées`);
      }

      // Vérifier alternance rapide/lent
      let fastSlowAlternations = 0;
      for (let i = 1; i < validPaces.length; i++) {
        const diff = Math.abs(validPaces[i] - validPaces[i-1]);
        if (diff > 1) fastSlowAlternations++;
      }

      if (fastSlowAlternations >= validPaces.length * 0.4) {
        scores['intervals'] += 15;
        scores['fartlek'] += 10;
      }
    }
  }

  // 5. Analyser le nom de l'activité (indice de l'utilisateur)
  const nameLower = details.name.toLowerCase();
  if (nameLower.includes('recup') || nameLower.includes('récup') || nameLower.includes('recovery')) {
    scores['recovery'] += 30;
  }
  if (nameLower.includes('ef') || nameLower.includes('endurance') || nameLower.includes('easy') || nameLower.includes('footing')) {
    scores['easy'] += 25;
  }
  if (nameLower.includes('long') || nameLower.includes('sortie longue') || nameLower.includes('sl')) {
    scores['long_run'] += 30;
  }
  if (nameLower.includes('tempo') || nameLower.includes('allure')) {
    scores['tempo'] += 30;
  }
  if (nameLower.includes('seuil') || nameLower.includes('threshold') || nameLower.includes('lt')) {
    scores['threshold'] += 30;
  }
  if (nameLower.includes('fractionné') || nameLower.includes('interval') || nameLower.includes('vma') ||
      nameLower.includes('30/30') || nameLower.includes('200m') || nameLower.includes('400m') ||
      nameLower.includes('1000m') || nameLower.includes('répét')) {
    scores['intervals'] += 35;
  }
  if (nameLower.includes('fartlek')) {
    scores['fartlek'] += 35;
  }
  if (nameLower.includes('race') || nameLower.includes('course') || nameLower.includes('marathon') ||
      nameLower.includes('semi') || nameLower.includes('10k') || nameLower.includes('5k') ||
      nameLower.includes('compétition') || nameLower.includes('chrono')) {
    scores['race'] += 30;
  }

  // 6. Suffer score élevé = effort intense
  if (details.suffer_score) {
    if (details.suffer_score > 150) {
      scores['race'] += 15;
      scores['threshold'] += 10;
    } else if (details.suffer_score < 50) {
      scores['recovery'] += 10;
      scores['easy'] += 10;
    }
  }

  // Trouver le type avec le score le plus élevé
  let maxType: SessionType = 'easy';
  let maxScore = 0;
  let totalScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    totalScore += score;
    if (score > maxScore) {
      maxScore = score;
      maxType = type as SessionType;
    }
  }

  // Si plusieurs types ont des scores proches, c'est une séance mixte
  const secondMaxScore = Object.values(scores)
    .filter(s => s !== maxScore)
    .sort((a, b) => b - a)[0] || 0;

  if (maxScore > 0 && secondMaxScore > maxScore * 0.8 && maxScore < 40) {
    maxType = 'mixed';
  }

  // Calculer la confiance (0-100)
  const confidence = totalScore > 0
    ? Math.min(100, Math.round((maxScore / Math.max(totalScore, 50)) * 100 + maxScore / 2))
    : 30;

  return {
    type: maxType,
    confidence,
    characteristics,
  };
}

/**
 * Analyse complète d'une activité de course à pied
 */
export async function analyzeRunningActivity(
  activityId: number
): Promise<RunningAnalysis> {
  // Récupérer toutes les données en parallèle
  const [details, streams, laps] = await Promise.all([
    stravaApi.getActivityDetails(activityId),
    stravaApi.getActivityStreams(activityId).catch(() => ({} as StravaStreams)),
    stravaApi.getActivityLaps(activityId).catch(() => [] as StravaLap[]),
  ]);

  // Extraire les données des streams
  const distanceData = streams.distance?.data || [];
  const timeData = streams.time?.data || [];
  const hrData = streams.heartrate?.data;
  const cadenceData = streams.cadence?.data;
  const altitudeData = streams.altitude?.data;
  const velocityData = streams.velocity_smooth?.data;
  const gradeData = streams.grade_smooth?.data;
  // Le stream moving peut contenir des booléens ou des nombres (0/1)
  const movingData = streams.moving?.data as (number | boolean)[] | undefined;

  // Calculer les splits (en utilisant le temps de mouvement, pas le temps écoulé)
  let splits: SplitAnalysis[] = [];
  if (distanceData.length > 0 && timeData.length > 0) {
    splits = calculateSplitsFromStreams(
      distanceData,
      timeData,
      hrData,
      cadenceData,
      altitudeData,
      movingData
    );
  } else if (details.splits_metric) {
    // Fallback sur les splits de l'API
    splits = details.splits_metric.map((s, i) => ({
      km: i + 1,
      distance: Math.round(s.distance),
      duration: s.moving_time,
      pace: speedToPace(s.average_speed),
      avgHr: s.average_heartrate,
      comparison: 'average' as const,
    }));
  }

  // Calculer les métriques
  const avgPace = speedToPace(details.average_speed);
  const paces = splits.map(s => s.pace).filter(p => p > 0);
  const avgPaceFromSplits = paces.length > 0
    ? paces.reduce((a, b) => a + b, 0) / paces.length
    : avgPace;

  // Calcul de la variabilité (écart-type en %)
  const paceStdDev = paces.length > 1
    ? Math.sqrt(paces.reduce((sum, p) => sum + Math.pow(p - avgPaceFromSplits, 2), 0) / paces.length)
    : 0;
  const paceVariability = avgPaceFromSplits > 0 ? (paceStdDev / avgPaceFromSplits) * 100 : 0;

  // First/second half
  const midpoint = Math.floor(splits.length / 2);
  const firstHalfPaces = splits.slice(0, midpoint).map(s => s.pace);
  const secondHalfPaces = splits.slice(midpoint).map(s => s.pace);
  const firstHalfPace = firstHalfPaces.length > 0
    ? firstHalfPaces.reduce((a, b) => a + b, 0) / firstHalfPaces.length
    : avgPace;
  const secondHalfPace = secondHalfPaces.length > 0
    ? secondHalfPaces.reduce((a, b) => a + b, 0) / secondHalfPaces.length
    : avgPace;
  const negativeSplit = secondHalfPace < firstHalfPace * 0.98;

  // Zones FC (utilise le profil si disponible)
  let hrZones: HrZoneTime[] | undefined;
  let hrZonesSource: 'profile' | 'calculated' = 'calculated';
  const maxHr = details.max_heartrate || (hrData ? Math.max(...hrData) : undefined);
  if (hrData && timeData && maxHr) {
    const hrAnalysis = analyzeHrZones(hrData, timeData, maxHr);
    hrZones = hrAnalysis.hrZones;
    hrZonesSource = hrAnalysis.source;
  }

  // Dénivelé
  let elevationGain = details.total_elevation_gain || 0;
  let elevationLoss = 0;
  if (altitudeData && altitudeData.length > 1) {
    for (let i = 1; i < altitudeData.length; i++) {
      const diff = altitudeData[i] - altitudeData[i - 1];
      if (diff < 0) elevationLoss += Math.abs(diff);
    }
  }

  // === NOUVELLES MÉTRIQUES ===

  // GAP (Grade Adjusted Pace)
  let avgGAP: number | undefined;
  let gapDifference: number | undefined;
  if (gradeData && velocityData && gradeData.length > 0) {
    // Calculer le GAP moyen pondéré par la distance
    let totalGapTime = 0;
    let totalDistance = 0;
    for (let i = 1; i < gradeData.length && i < velocityData.length; i++) {
      const segmentDist = distanceData[i] - distanceData[i - 1];
      if (segmentDist <= 0) continue;

      const segmentPace = speedToPace(velocityData[i]);
      const segmentGap = calculateGAP(segmentPace, gradeData[i]);
      if (segmentGap > 0 && isFinite(segmentGap)) {
        totalGapTime += segmentGap * segmentDist;
        totalDistance += segmentDist;
      }
    }
    if (totalDistance > 0) {
      avgGAP = totalGapTime / totalDistance;
      gapDifference = (avgPace - avgGAP) * 60; // en secondes/km
    }
  }

  // Cadence (Strava donne demi-cadence pour la course)
  const avgCadence = details.average_cadence ? Math.round(details.average_cadence * 2) : undefined;
  let cadenceVariability: number | undefined;
  let cadenceStatus: 'low' | 'optimal' | 'high' | undefined;
  if (cadenceData && cadenceData.length > 0) {
    const cadences = cadenceData.map(c => c * 2); // Convertir en vraie cadence
    const avgCad = cadences.reduce((a, b) => a + b, 0) / cadences.length;
    const cadStdDev = Math.sqrt(cadences.reduce((sum, c) => sum + Math.pow(c - avgCad, 2), 0) / cadences.length);
    cadenceVariability = avgCad > 0 ? (cadStdDev / avgCad) * 100 : 0;
    if (avgCadence) {
      cadenceStatus = evaluateCadence(avgCadence);
    }
  }

  // Longueur de foulée
  let avgStrideLength: number | undefined;
  let strideLengthStatus: 'short' | 'optimal' | 'long' | undefined;
  if (avgCadence && details.average_speed > 0) {
    avgStrideLength = calculateStrideLength(details.average_speed, avgCadence);
    avgStrideLength = Math.round(avgStrideLength * 100) / 100; // Arrondir à 2 décimales
    strideLengthStatus = evaluateStrideLength(avgStrideLength);
  }

  // Dérive cardiaque
  let cardiacDrift: number | undefined;
  let cardiacDriftStatus: 'good' | 'moderate' | 'high' | undefined;
  if (hrData && velocityData && timeData) {
    const driftResult = calculateCardiacDrift(hrData, timeData, velocityData);
    if (driftResult) {
      cardiacDrift = driftResult.drift;
      cardiacDriftStatus = driftResult.status;
    }
  }

  // Facteur d'efficacité
  let efficiencyFactor: number | undefined;
  let efficiencyTrend: 'improving' | 'stable' | 'declining' | undefined;
  if (details.average_speed > 0 && details.average_heartrate) {
    efficiencyFactor = calculateEfficiencyFactor(details.average_speed, details.average_heartrate);
    efficiencyFactor = Math.round(efficiencyFactor * 100) / 100;

    // Comparer efficacité 1ère vs 2ème moitié pour déterminer la tendance
    if (hrData && velocityData) {
      const mid = Math.floor(hrData.length / 2);
      const ef1 = calculateEfficiencyFactor(
        velocityData.slice(0, mid).reduce((a, b) => a + b, 0) / mid,
        hrData.slice(0, mid).reduce((a, b) => a + b, 0) / mid
      );
      const ef2 = calculateEfficiencyFactor(
        velocityData.slice(mid).reduce((a, b) => a + b, 0) / (velocityData.length - mid),
        hrData.slice(mid).reduce((a, b) => a + b, 0) / (hrData.length - mid)
      );
      const efChange = ((ef2 - ef1) / ef1) * 100;
      if (efChange > 3) efficiencyTrend = 'improving';
      else if (efChange < -3) efficiencyTrend = 'declining';
      else efficiencyTrend = 'stable';
    }
  }

  // Meilleurs efforts
  let bestEfforts: BestEffort[] | undefined;
  if (distanceData.length > 0 && timeData.length > 0) {
    bestEfforts = calculateBestEfforts(distanceData, timeData, movingData);
  }

  // Estimation effort et récupération
  const estimatedEffort = estimateEffort(avgPace, details.average_heartrate, maxHr, details.moving_time);

  // Détection du type de séance
  const sessionTypeResult = detectSessionType(
    details,
    splits,
    hrZones,
    paceVariability,
    laps
  );

  // Adapter la récupération selon le type de séance
  const recovery = estimateRecoveryWithSessionType(
    estimatedEffort,
    details.moving_time / 60,
    details.average_heartrate,
    maxHr,
    sessionTypeResult.type
  );

  // Détecter la structure de la séance (intervalles)
  const workoutStructure = velocityData && distanceData.length > 0 && timeData.length > 0
    ? detectWorkoutStructure(distanceData, timeData, velocityData, hrData)
    : undefined;

  const metrics: RunningAnalysis['metrics'] = {
    avgPace,
    bestPace: paces.length > 0 ? Math.min(...paces) : avgPace,
    worstPace: paces.length > 0 ? Math.max(...paces) : avgPace,
    paceVariability,
    avgGAP,
    gapDifference,
    negativeSplit,
    firstHalfPace,
    secondHalfPace,
    avgHr: details.average_heartrate,
    maxHr: details.max_heartrate,
    hrZones,
    cardiacDrift,
    cardiacDriftStatus,
    avgCadence,
    cadenceVariability,
    cadenceStatus,
    avgStrideLength,
    strideLengthStatus,
    efficiencyFactor,
    efficiencyTrend,
    elevationGain: Math.round(elevationGain),
    elevationLoss: Math.round(elevationLoss),
    estimatedEffort,
    sessionType: sessionTypeResult.type,
    sessionTypeConfidence: sessionTypeResult.confidence,
    bestEfforts,
    estimatedRecoveryHours: recovery.hours,
    nextWorkoutSuggestion: recovery.suggestion,
    profileComparison: calculateProfileComparison(avgPace, hrZonesSource),
  };

  // Identifier insights
  const { strengths, improvements } = identifyInsights(splits, metrics);

  // Créer l'analyse
  const analysis: RunningAnalysis = {
    activity: details,
    splits,
    metrics,
    strengths,
    improvements,
    workoutStructure,
    summary: '',
  };

  // Générer le résumé
  analysis.summary = generateSummary(analysis);

  return analysis;
}

// ======== FONCTIONS VÉLO ========

// Calculer la puissance normalisée (NP)
// Moyenne pondérée des puissances sur 30s, élevée à la puissance 4
function calculateNormalizedPower(powerData: number[], _timeData: number[]): number | undefined {
  if (!powerData || powerData.length < 30) return undefined;

  // Moyenne glissante sur 30 secondes
  const windowSize = 30;
  const rollingPowers: number[] = [];

  for (let i = windowSize; i < powerData.length; i++) {
    const window = powerData.slice(i - windowSize, i);
    const avgWindow = window.reduce((a, b) => a + b, 0) / window.length;
    rollingPowers.push(avgWindow);
  }

  if (rollingPowers.length === 0) return undefined;

  // Élever à la puissance 4, moyenner, puis racine 4ème
  const avgPower4 = rollingPowers.reduce((sum, p) => sum + Math.pow(p, 4), 0) / rollingPowers.length;
  return Math.round(Math.pow(avgPower4, 0.25));
}

// Calculer les zones de puissance (basé sur FTP)
function calculatePowerZones(ftp: number): { min: number; max: number; name: string }[] {
  return [
    { min: 0, max: Math.round(ftp * 0.55), name: 'Récupération' },
    { min: Math.round(ftp * 0.55), max: Math.round(ftp * 0.75), name: 'Endurance' },
    { min: Math.round(ftp * 0.75), max: Math.round(ftp * 0.90), name: 'Tempo' },
    { min: Math.round(ftp * 0.90), max: Math.round(ftp * 1.05), name: 'Seuil' },
    { min: Math.round(ftp * 1.05), max: Math.round(ftp * 1.20), name: 'VO2max' },
    { min: Math.round(ftp * 1.20), max: Math.round(ftp * 1.50), name: 'Anaérobie' },
    { min: Math.round(ftp * 1.50), max: 9999, name: 'Sprint' },
  ];
}

// Analyser le temps passé dans chaque zone de puissance
function analyzePowerZones(
  powerData: number[],
  timeData: number[],
  ftp: number
): PowerZoneTime[] {
  const zones = calculatePowerZones(ftp);
  const zoneTime: number[] = new Array(7).fill(0);
  let totalTime = 0;

  for (let i = 1; i < powerData.length; i++) {
    const power = powerData[i];
    const duration = timeData[i] - timeData[i - 1];
    totalTime += duration;

    for (let z = zones.length - 1; z >= 0; z--) {
      if (power >= zones[z].min) {
        zoneTime[z] += duration;
        break;
      }
    }
  }

  return zones.map((zone, i) => ({
    zone: i + 1,
    name: zone.name,
    minPower: zone.min,
    maxPower: zone.max === 9999 ? 0 : zone.max,
    duration: Math.round(zoneTime[i]),
    percent: totalTime > 0 ? Math.round((zoneTime[i] / totalTime) * 100) : 0,
  }));
}

// Détecter le type de séance vélo
function detectCyclingSessionType(
  details: StravaActivityDetails,
  powerZones?: PowerZoneTime[],
  hrZones?: HrZoneTime[]
): { type: CyclingSessionType; confidence: number } {
  const scores: Record<CyclingSessionType, number> = {
    'recovery': 0,
    'endurance': 0,
    'tempo': 0,
    'threshold': 0,
    'vo2max': 0,
    'anaerobic': 0,
    'sprint': 0,
    'climb': 0,
    'race': 0,
    'mixed': 0,
  };

  const durationMin = details.moving_time / 60;
  const elevationPerKm = details.distance > 0 ? (details.total_elevation_gain / (details.distance / 1000)) : 0;

  // Analyse durée
  if (durationMin < 45) {
    scores['recovery'] += 10;
  } else if (durationMin >= 120) {
    scores['endurance'] += 15;
  }

  // Analyse dénivelé
  if (elevationPerKm > 20) {
    scores['climb'] += 25;
  } else if (elevationPerKm > 15) {
    scores['climb'] += 15;
  }

  // Analyse zones puissance
  if (powerZones) {
    const z1z2 = (powerZones[0]?.percent || 0) + (powerZones[1]?.percent || 0);
    const z3 = powerZones[2]?.percent || 0;
    const z4 = powerZones[3]?.percent || 0;
    const z5 = powerZones[4]?.percent || 0;
    const z6z7 = (powerZones[5]?.percent || 0) + (powerZones[6]?.percent || 0);

    if (z1z2 > 80) {
      scores['recovery'] += 25;
      scores['endurance'] += 20;
    } else if (z1z2 > 60) {
      scores['endurance'] += 25;
    }

    if (z3 > 40) {
      scores['tempo'] += 25;
    }

    if (z4 > 25) {
      scores['threshold'] += 30;
    }

    if (z5 > 15) {
      scores['vo2max'] += 25;
    }

    if (z6z7 > 10) {
      scores['anaerobic'] += 20;
      if (z6z7 > 20) scores['sprint'] += 15;
    }
  }

  // Analyse zones FC
  if (hrZones && !powerZones) {
    const z1z2 = (hrZones[0]?.percent || 0) + (hrZones[1]?.percent || 0);
    const z4z5 = (hrZones[3]?.percent || 0) + (hrZones[4]?.percent || 0);

    if (z1z2 > 70) {
      scores['recovery'] += 20;
      scores['endurance'] += 15;
    }
    if (z4z5 > 40) {
      scores['threshold'] += 15;
      scores['race'] += 10;
    }
  }

  // Analyse nom
  const nameLower = details.name.toLowerCase();
  if (nameLower.includes('récup') || nameLower.includes('recup') || nameLower.includes('recovery')) {
    scores['recovery'] += 25;
  }
  if (nameLower.includes('endurance') || nameLower.includes('z2') || nameLower.includes('ef')) {
    scores['endurance'] += 25;
  }
  if (nameLower.includes('tempo') || nameLower.includes('sweet')) {
    scores['tempo'] += 25;
  }
  if (nameLower.includes('ftp') || nameLower.includes('threshold') || nameLower.includes('seuil')) {
    scores['threshold'] += 30;
  }
  if (nameLower.includes('interval') || nameLower.includes('vo2')) {
    scores['vo2max'] += 30;
  }
  if (nameLower.includes('sprint')) {
    scores['sprint'] += 30;
  }
  if (nameLower.includes('col') || nameLower.includes('climb') || nameLower.includes('montée') || nameLower.includes('grimpeur')) {
    scores['climb'] += 30;
  }
  if (nameLower.includes('race') || nameLower.includes('course') || nameLower.includes('cyclo') || nameLower.includes('granfondo')) {
    scores['race'] += 30;
  }

  // Trouver le max
  let maxType: CyclingSessionType = 'endurance';
  let maxScore = 0;
  let totalScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    totalScore += score;
    if (score > maxScore) {
      maxScore = score;
      maxType = type as CyclingSessionType;
    }
  }

  const confidence = totalScore > 0
    ? Math.min(100, Math.round((maxScore / Math.max(totalScore, 50)) * 100 + maxScore / 2))
    : 30;

  return { type: maxType, confidence };
}

// Générer le résumé vélo pour l'IA
function generateCyclingSummary(analysis: CyclingAnalysis): string {
  const { activity, metrics } = analysis;
  const date = new Date(activity.start_date_local).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  let summary = `# Analyse de la sortie vélo : ${activity.name}\n`;
  summary += `Date : ${date}\n\n`;

  summary += `## Résumé\n`;
  summary += `- Distance : ${(activity.distance / 1000).toFixed(1)} km\n`;
  summary += `- Durée : ${Math.floor(activity.moving_time / 3600)}h${Math.floor((activity.moving_time % 3600) / 60).toString().padStart(2, '0')}\n`;
  summary += `- Vitesse moyenne : ${metrics.avgSpeed.toFixed(1)} km/h (max: ${metrics.maxSpeed.toFixed(1)} km/h)\n`;

  if (metrics.avgPower) {
    summary += `- Puissance moyenne : ${metrics.avgPower}W\n`;
    if (metrics.normalizedPower) {
      summary += `- Puissance normalisée (NP) : ${metrics.normalizedPower}W\n`;
    }
    if (metrics.intensityFactor) {
      summary += `- Facteur d'intensité (IF) : ${metrics.intensityFactor.toFixed(2)}\n`;
    }
    if (metrics.trainingStressScore) {
      summary += `- TSS : ${metrics.trainingStressScore}\n`;
    }
  }

  if (metrics.avgHr) {
    summary += `- FC moyenne : ${metrics.avgHr} bpm (max: ${metrics.maxHr} bpm)\n`;
  }

  if (metrics.avgCadence) {
    summary += `- Cadence moyenne : ${metrics.avgCadence} rpm\n`;
  }

  if (metrics.elevationGain > 50) {
    summary += `- Dénivelé : +${metrics.elevationGain}m / -${metrics.elevationLoss}m\n`;
    if (metrics.climbingVAM) {
      summary += `- VAM (vitesse ascensionnelle) : ${metrics.climbingVAM} m/h\n`;
    }
  }

  if (metrics.sessionType) {
    const label = CYCLING_SESSION_LABELS[metrics.sessionType];
    summary += `- Type de séance : ${label}\n`;
  }

  summary += `- Effort estimé : ${metrics.estimatedEffort}\n`;

  // Zones de puissance
  if (metrics.powerZones && metrics.powerZones.length > 0) {
    summary += `\n## Distribution de puissance\n`;
    for (const zone of metrics.powerZones) {
      if (zone.percent > 0) {
        summary += `- Z${zone.zone} ${zone.name}: ${Math.round(zone.duration / 60)} min (${zone.percent}%)\n`;
      }
    }
  }

  // Zones FC
  if (metrics.hrZones && metrics.hrZones.length > 0 && !metrics.powerZones) {
    summary += `\n## Zones cardiaques\n`;
    for (const zone of metrics.hrZones) {
      if (zone.percent > 0) {
        summary += `- Z${zone.zone} ${zone.name}: ${Math.round(zone.duration / 60)} min (${zone.percent}%)\n`;
      }
    }
  }

  // Récupération
  if (metrics.estimatedRecoveryHours) {
    summary += `\n## Récupération\n`;
    summary += `- Temps de récupération : ${metrics.estimatedRecoveryHours}h\n`;
    if (metrics.nextWorkoutSuggestion) {
      summary += `- Conseil : ${metrics.nextWorkoutSuggestion}\n`;
    }
  }

  // Points forts et améliorations
  if (analysis.strengths.length > 0) {
    summary += `\n## Points forts\n`;
    for (const s of analysis.strengths) {
      summary += `- ${s}\n`;
    }
  }

  if (analysis.improvements.length > 0) {
    summary += `\n## Axes d'amélioration\n`;
    for (const i of analysis.improvements) {
      summary += `- ${i}\n`;
    }
  }

  return summary;
}

/**
 * Analyse complète d'une activité vélo
 */
export async function analyzeCyclingActivity(
  activityId: number,
  ftp?: number // FTP optionnel pour calculer les zones de puissance
): Promise<CyclingAnalysis> {
  const [details, streams] = await Promise.all([
    stravaApi.getActivityDetails(activityId),
    stravaApi.getActivityStreams(activityId).catch(() => ({} as StravaStreams)),
  ]);

  const timeData = streams.time?.data || [];
  const powerData = streams.watts?.data;
  const hrData = streams.heartrate?.data;
  const cadenceData = streams.cadence?.data;
  const velocityData = streams.velocity_smooth?.data;
  const altitudeData = streams.altitude?.data;

  // Vitesse
  const avgSpeedMs = details.average_speed;
  const avgSpeed = avgSpeedMs * 3.6; // m/s -> km/h
  const maxSpeed = details.max_speed * 3.6;

  // Variabilité vitesse
  let speedVariability = 0;
  if (velocityData && velocityData.length > 10) {
    const avgVel = velocityData.reduce((a, b) => a + b, 0) / velocityData.length;
    const stdDev = Math.sqrt(velocityData.reduce((sum, v) => sum + Math.pow(v - avgVel, 2), 0) / velocityData.length);
    speedVariability = avgVel > 0 ? (stdDev / avgVel) * 100 : 0;
  }

  // Puissance
  let avgPower: number | undefined;
  let maxPower: number | undefined;
  let normalizedPower: number | undefined;
  let intensityFactor: number | undefined;
  let trainingStressScore: number | undefined;
  let variabilityIndex: number | undefined;
  let powerZones: PowerZoneTime[] | undefined;

  if (powerData && powerData.length > 0) {
    avgPower = details.average_watts || Math.round(powerData.reduce((a, b) => a + b, 0) / powerData.length);
    maxPower = Math.max(...powerData);
    normalizedPower = calculateNormalizedPower(powerData, timeData);

    if (ftp && ftp > 0) {
      powerZones = analyzePowerZones(powerData, timeData, ftp);

      if (normalizedPower) {
        intensityFactor = normalizedPower / ftp;
        // TSS = (durée en secondes * NP * IF) / (FTP * 3600) * 100
        trainingStressScore = Math.round(
          (details.moving_time * normalizedPower * intensityFactor) / (ftp * 3600) * 100
        );
      }
    }

    if (avgPower && normalizedPower) {
      variabilityIndex = normalizedPower / avgPower;
    }
  }

  // Cadence
  let avgCadence: number | undefined;
  let cadenceVariability: number | undefined;
  if (cadenceData && cadenceData.length > 0) {
    const validCadence = cadenceData.filter(c => c > 0);
    if (validCadence.length > 0) {
      avgCadence = Math.round(validCadence.reduce((a, b) => a + b, 0) / validCadence.length);
      const avgCad = avgCadence;
      const stdDev = Math.sqrt(validCadence.reduce((sum, c) => sum + Math.pow(c - avgCad, 2), 0) / validCadence.length);
      cadenceVariability = avgCad > 0 ? (stdDev / avgCad) * 100 : 0;
    }
  }

  // Zones FC
  let hrZones: HrZoneTime[] | undefined;
  const maxHr = details.max_heartrate || (hrData ? Math.max(...hrData) : undefined);
  if (hrData && timeData && maxHr) {
    const hrAnalysis = analyzeHrZones(hrData, timeData, maxHr);
    hrZones = hrAnalysis.hrZones;
  }

  // Dénivelé
  const elevationGain = details.total_elevation_gain;
  let elevationLoss = 0;
  if (altitudeData && altitudeData.length > 1) {
    for (let i = 1; i < altitudeData.length; i++) {
      const diff = altitudeData[i] - altitudeData[i - 1];
      if (diff < 0) elevationLoss += Math.abs(diff);
    }
  }

  // VAM (vitesse ascensionnelle moyenne)
  let climbingVAM: number | undefined;
  if (elevationGain > 100 && details.moving_time > 0) {
    // Estimer le temps de montée (approximation: 60% du temps si beaucoup de D+)
    const climbRatio = Math.min(0.8, elevationGain / (details.distance / 1000) / 50);
    const climbingTimeHours = (details.moving_time * climbRatio) / 3600;
    if (climbingTimeHours > 0.1) {
      climbingVAM = Math.round(elevationGain / climbingTimeHours);
    }
  }

  // Type de séance et effort
  const sessionResult = detectCyclingSessionType(details, powerZones, hrZones);

  const estimatedEffort = estimateCyclingEffort(
    avgSpeed,
    details.average_heartrate,
    maxHr,
    details.moving_time,
    avgPower,
    ftp,
    elevationGain
  );

  const recovery = estimateCyclingRecovery(estimatedEffort, details.moving_time / 60, sessionResult.type, trainingStressScore);

  // Identifier forces et faiblesses
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (avgCadence && avgCadence >= 85 && avgCadence <= 95) {
    strengths.push('Cadence optimale');
  } else if (avgCadence && avgCadence < 75) {
    improvements.push('Cadence trop basse, essayer de mouliner plus');
  }

  if (variabilityIndex && variabilityIndex < 1.05) {
    strengths.push('Effort très régulier');
  } else if (variabilityIndex && variabilityIndex > 1.15) {
    improvements.push('Effort irrégulier, travailler la gestion de l\'effort');
  }

  if (elevationGain > 1000 && climbingVAM && climbingVAM > 800) {
    strengths.push('Bonne capacité en montée');
  }

  if (intensityFactor && intensityFactor > 0.95 && details.moving_time > 3600) {
    strengths.push('Excellente capacité à tenir un effort élevé');
  }

  const metrics: CyclingAnalysis['metrics'] = {
    avgSpeed,
    maxSpeed,
    speedVariability,
    avgPower,
    maxPower,
    normalizedPower,
    intensityFactor,
    trainingStressScore,
    variabilityIndex,
    powerZones,
    avgCadence,
    cadenceVariability,
    avgHr: details.average_heartrate,
    maxHr: details.max_heartrate,
    hrZones,
    elevationGain: Math.round(elevationGain),
    elevationLoss: Math.round(elevationLoss),
    climbingVAM,
    sessionType: sessionResult.type,
    sessionTypeConfidence: sessionResult.confidence,
    estimatedEffort,
    estimatedRecoveryHours: recovery.hours,
    nextWorkoutSuggestion: recovery.suggestion,
  };

  const analysis: CyclingAnalysis = {
    activity: details,
    metrics,
    strengths,
    improvements,
    summary: '',
  };

  analysis.summary = generateCyclingSummary(analysis);

  return analysis;
}

// Estimer l'effort vélo
function estimateCyclingEffort(
  _avgSpeed: number,
  avgHr?: number,
  maxHr?: number,
  durationSeconds?: number,
  avgPower?: number,
  ftp?: number,
  elevationGain?: number
): 'easy' | 'moderate' | 'hard' | 'very_hard' {
  let score = 0;

  // Basé sur la puissance relative à FTP
  if (avgPower && ftp) {
    const intensity = avgPower / ftp;
    if (intensity > 0.9) score += 3;
    else if (intensity > 0.75) score += 2;
    else if (intensity > 0.6) score += 1;
  }

  // Basé sur la FC
  if (avgHr && maxHr) {
    const hrPercent = avgHr / maxHr;
    if (hrPercent > 0.85) score += 2;
    else if (hrPercent > 0.75) score += 1;
  }

  // Basé sur la durée
  if (durationSeconds) {
    if (durationSeconds > 14400) score += 2; // > 4h
    else if (durationSeconds > 7200) score += 1; // > 2h
  }

  // Basé sur le dénivelé
  if (elevationGain) {
    if (elevationGain > 2000) score += 2;
    else if (elevationGain > 1000) score += 1;
  }

  if (score >= 5) return 'very_hard';
  if (score >= 3) return 'hard';
  if (score >= 1) return 'moderate';
  return 'easy';
}

// Récupération vélo
function estimateCyclingRecovery(
  effort: 'easy' | 'moderate' | 'hard' | 'very_hard',
  durationMin: number,
  sessionType?: CyclingSessionType,
  tss?: number
): { hours: number; suggestion: string } {
  let hours = 0;

  // Basé sur le TSS si disponible
  if (tss) {
    if (tss > 300) hours = 72;
    else if (tss > 200) hours = 48;
    else if (tss > 150) hours = 36;
    else if (tss > 100) hours = 24;
    else if (tss > 50) hours = 18;
    else hours = 12;
  } else {
    // Basé sur l'effort
    const baseRecovery: Record<string, number> = {
      'easy': 12,
      'moderate': 24,
      'hard': 36,
      'very_hard': 48,
    };
    hours = baseRecovery[effort];
  }

  // Ajustement selon type de séance
  if (sessionType === 'race') hours += 24;
  if (sessionType === 'vo2max' || sessionType === 'anaerobic') hours += 6;

  // Ajustement durée
  if (durationMin > 240) hours += 12;
  else if (durationMin > 180) hours += 6;

  hours = Math.min(96, hours);

  let suggestion = '';
  if (hours >= 48) {
    suggestion = 'Repos ou récupération active très légère';
  } else if (hours >= 36) {
    suggestion = 'Sortie récupération ou cross-training léger';
  } else if (hours >= 24) {
    suggestion = 'Sortie endurance possible demain';
  } else {
    suggestion = 'Entraînement normal possible';
  }

  return { hours, suggestion };
}

// ======== FONCTIONS NATATION ========

// Convertir secondes/100m en format lisible
export function formatSwimPace(seconds100m: number): string {
  if (!seconds100m || seconds100m <= 0 || !isFinite(seconds100m)) return '--';
  const minutes = Math.floor(seconds100m / 60);
  const secs = Math.round(seconds100m % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// Détecter le type de séance natation
function detectSwimmingSessionType(
  details: StravaActivityDetails,
  paceVariability: number,
  laps?: StravaLap[]
): { type: SwimmingSessionType; confidence: number } {
  const scores: Record<SwimmingSessionType, number> = {
    'recovery': 0,
    'technique': 0,
    'endurance': 0,
    'threshold': 0,
    'intervals': 0,
    'sprint': 0,
    'race': 0,
    'mixed': 0,
  };

  const durationMin = details.moving_time / 60;
  const distanceM = details.distance;

  // Courte durée + faible distance = récup ou technique
  if (durationMin < 30 && distanceM < 1500) {
    scores['recovery'] += 15;
    scores['technique'] += 20;
  }

  // Longue durée = endurance
  if (durationMin > 45 && distanceM > 2000) {
    scores['endurance'] += 20;
  }

  // Haute variabilité d'allure = fractionné
  if (paceVariability > 20) {
    scores['intervals'] += 25;
  } else if (paceVariability < 8) {
    scores['endurance'] += 15;
    scores['threshold'] += 15;
  }

  // Analyser les laps s'ils existent
  if (laps && laps.length > 0) {
    // Beaucoup de laps avec durées variées = fractionné
    const lapDurations = laps.map(l => l.moving_time);
    if (lapDurations.length > 10) {
      const avgDur = lapDurations.reduce((a, b) => a + b, 0) / lapDurations.length;
      const durVariability = lapDurations.filter(d => Math.abs(d - avgDur) > avgDur * 0.3).length;
      if (durVariability > lapDurations.length * 0.4) {
        scores['intervals'] += 20;
      }
    }
  }

  // Analyser le nom
  const nameLower = details.name.toLowerCase();
  if (nameLower.includes('récup') || nameLower.includes('recup') || nameLower.includes('easy')) {
    scores['recovery'] += 30;
  }
  if (nameLower.includes('technique') || nameLower.includes('drill') || nameLower.includes('éducatif')) {
    scores['technique'] += 30;
  }
  if (nameLower.includes('endurance') || nameLower.includes('continu') || nameLower.includes('aérobie')) {
    scores['endurance'] += 25;
  }
  if (nameLower.includes('seuil') || nameLower.includes('threshold') || nameLower.includes('css')) {
    scores['threshold'] += 30;
  }
  if (nameLower.includes('fractionné') || nameLower.includes('interval') || nameLower.includes('série')) {
    scores['intervals'] += 30;
  }
  if (nameLower.includes('sprint') || nameLower.includes('vitesse')) {
    scores['sprint'] += 30;
  }
  if (nameLower.includes('test') || nameLower.includes('chrono') || nameLower.includes('compétition')) {
    scores['race'] += 30;
  }

  // Trouver le max
  let maxType: SwimmingSessionType = 'endurance';
  let maxScore = 0;
  let totalScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    totalScore += score;
    if (score > maxScore) {
      maxScore = score;
      maxType = type as SwimmingSessionType;
    }
  }

  const confidence = totalScore > 0
    ? Math.min(100, Math.round((maxScore / Math.max(totalScore, 50)) * 100 + maxScore / 2))
    : 30;

  return { type: maxType, confidence };
}

// Générer le résumé natation pour l'IA
function generateSwimmingSummary(analysis: SwimmingAnalysis): string {
  const { activity, metrics } = analysis;
  const date = new Date(activity.start_date_local).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  let summary = `# Analyse de la séance natation : ${activity.name}\n`;
  summary += `Date : ${date}\n\n`;

  summary += `## Résumé\n`;
  summary += `- Distance : ${metrics.distance}m\n`;
  summary += `- Durée : ${Math.floor(metrics.duration / 60)} min\n`;
  summary += `- Longueurs : ${metrics.laps}\n`;
  summary += `- Allure moyenne : ${formatSwimPace(metrics.avgPace100m)}/100m\n`;
  summary += `- Meilleure allure : ${formatSwimPace(metrics.bestPace100m)}/100m\n`;

  if (metrics.avgSwolf) {
    summary += `- SWOLF moyen : ${metrics.avgSwolf}`;
    if (metrics.bestSwolf) {
      summary += ` (meilleur: ${metrics.bestSwolf})`;
    }
    summary += '\n';
  }

  if (metrics.avgStrokeRate) {
    summary += `- Fréquence de nage : ${metrics.avgStrokeRate} coups/min\n`;
  }

  if (metrics.avgStrokesPerLength) {
    summary += `- Coups par longueur : ${metrics.avgStrokesPerLength}\n`;
  }

  if (metrics.strokeEfficiency) {
    summary += `- Distance par coup : ${metrics.strokeEfficiency.toFixed(2)}m\n`;
  }

  if (metrics.avgHr) {
    summary += `- FC moyenne : ${metrics.avgHr} bpm (max: ${metrics.maxHr} bpm)\n`;
  }

  if (metrics.sessionType) {
    const label = SWIMMING_SESSION_LABELS[metrics.sessionType];
    summary += `- Type de séance : ${label}\n`;
  }

  summary += `- Effort estimé : ${metrics.estimatedEffort}\n`;

  // Zones FC
  if (metrics.hrZones && metrics.hrZones.length > 0) {
    summary += `\n## Zones cardiaques\n`;
    for (const zone of metrics.hrZones) {
      if (zone.percent > 0) {
        summary += `- Z${zone.zone} ${zone.name}: ${Math.round(zone.duration / 60)} min (${zone.percent}%)\n`;
      }
    }
  }

  // Récupération
  if (metrics.estimatedRecoveryHours) {
    summary += `\n## Récupération\n`;
    summary += `- Temps de récupération : ${metrics.estimatedRecoveryHours}h\n`;
    if (metrics.nextWorkoutSuggestion) {
      summary += `- Conseil : ${metrics.nextWorkoutSuggestion}\n`;
    }
  }

  // Points forts et améliorations
  if (analysis.strengths.length > 0) {
    summary += `\n## Points forts\n`;
    for (const s of analysis.strengths) {
      summary += `- ${s}\n`;
    }
  }

  if (analysis.improvements.length > 0) {
    summary += `\n## Axes d'amélioration\n`;
    for (const i of analysis.improvements) {
      summary += `- ${i}\n`;
    }
  }

  return summary;
}

/**
 * Analyse complète d'une activité de natation
 */
export async function analyzeSwimmingActivity(
  activityId: number,
  poolLength: number = 25 // Longueur du bassin en mètres
): Promise<SwimmingAnalysis> {
  const [details, streams, laps] = await Promise.all([
    stravaApi.getActivityDetails(activityId),
    stravaApi.getActivityStreams(activityId).catch(() => ({} as StravaStreams)),
    stravaApi.getActivityLaps(activityId).catch(() => [] as StravaLap[]),
  ]);

  const distance = details.distance;
  const duration = details.moving_time;
  const numLaps = Math.round(distance / poolLength);

  // Allure par 100m
  const avgPace100m = distance > 0 ? (duration / distance) * 100 : 0;

  // Analyser les laps pour l'allure
  let bestPace100m = avgPace100m;
  let paceVariability = 0;
  const lapDetails: SwimLapDetail[] = [];

  if (laps && laps.length > 0) {
    const lapPaces = laps
      .filter(l => l.distance > 0)
      .map(l => (l.moving_time / l.distance) * 100);

    if (lapPaces.length > 0) {
      bestPace100m = Math.min(...lapPaces);
      const avgLapPace = lapPaces.reduce((a, b) => a + b, 0) / lapPaces.length;
      const stdDev = Math.sqrt(lapPaces.reduce((sum, p) => sum + Math.pow(p - avgLapPace, 2), 0) / lapPaces.length);
      paceVariability = avgLapPace > 0 ? (stdDev / avgLapPace) * 100 : 0;

      // Créer les détails par lap
      laps.forEach((lap, i) => {
        if (lap.distance > 0) {
          lapDetails.push({
            lap: i + 1,
            distance: lap.distance,
            duration: lap.moving_time,
            pace100m: (lap.moving_time / lap.distance) * 100,
          });
        }
      });
    }
  }

  // SWOLF et données de nage (depuis les streams si disponibles)
  let avgSwolf: number | undefined;
  let bestSwolf: number | undefined;
  let avgStrokeRate: number | undefined;
  let avgStrokesPerLength: number | undefined;
  let strokeEfficiency: number | undefined;

  // Si on a des données de cadence (coups/min en natation)
  const cadenceData = streams.cadence?.data;
  if (cadenceData && cadenceData.length > 0) {
    const validCadence = cadenceData.filter(c => c > 0);
    if (validCadence.length > 0) {
      avgStrokeRate = Math.round(validCadence.reduce((a, b) => a + b, 0) / validCadence.length);

      // Estimer les coups par longueur et le SWOLF
      if (avgStrokeRate > 0 && numLaps > 0) {
        const avgLapDuration = duration / numLaps;
        avgStrokesPerLength = Math.round((avgStrokeRate * avgLapDuration) / 60);
        avgSwolf = Math.round(avgStrokesPerLength + avgLapDuration);
        strokeEfficiency = poolLength / avgStrokesPerLength;
      }
    }
  }

  // Zones FC
  let hrZones: HrZoneTime[] | undefined;
  const hrData = streams.heartrate?.data;
  const timeData = streams.time?.data || [];
  const maxHr = details.max_heartrate || (hrData ? Math.max(...hrData) : undefined);
  if (hrData && timeData && maxHr) {
    const hrAnalysis = analyzeHrZones(hrData, timeData, maxHr);
    hrZones = hrAnalysis.hrZones;
  }

  // Type de séance
  const sessionResult = detectSwimmingSessionType(details, paceVariability, laps);

  // Effort
  const estimatedEffort = estimateSwimmingEffort(avgPace100m, duration, details.average_heartrate, maxHr);

  // Récupération
  const recovery = estimateSwimmingRecovery(estimatedEffort, duration / 60, sessionResult.type);

  // Points forts et améliorations
  const strengths: string[] = [];
  const improvements: string[] = [];

  if (paceVariability < 8) {
    strengths.push('Allure très régulière');
  } else if (paceVariability > 20) {
    improvements.push('Travaillerla régularité de l\'allure');
  }

  if (avgSwolf && avgSwolf < 40) {
    strengths.push('Excellent SWOLF - nage très efficace');
  } else if (avgSwolf && avgSwolf > 60) {
    improvements.push('Améliorer l\'efficacité technique (SWOLF élevé)');
  }

  if (strokeEfficiency && strokeEfficiency > 2) {
    strengths.push('Bonne amplitude de nage');
  } else if (strokeEfficiency && strokeEfficiency < 1.5) {
    improvements.push('Travailler l\'amplitude des mouvements');
  }

  const metrics: SwimmingAnalysis['metrics'] = {
    distance,
    duration,
    laps: numLaps,
    avgPace100m,
    bestPace100m,
    paceVariability,
    avgSwolf,
    bestSwolf,
    avgStrokeRate,
    avgStrokesPerLength,
    strokeEfficiency,
    avgHr: details.average_heartrate,
    maxHr: details.max_heartrate,
    hrZones,
    sessionType: sessionResult.type,
    sessionTypeConfidence: sessionResult.confidence,
    estimatedEffort,
    estimatedRecoveryHours: recovery.hours,
    nextWorkoutSuggestion: recovery.suggestion,
  };

  const analysis: SwimmingAnalysis = {
    activity: details,
    metrics,
    lapDetails: lapDetails.length > 0 ? lapDetails : undefined,
    strengths,
    improvements,
    summary: '',
  };

  analysis.summary = generateSwimmingSummary(analysis);

  return analysis;
}

// Estimer l'effort natation
function estimateSwimmingEffort(
  avgPace100m: number,
  durationSeconds: number,
  avgHr?: number,
  maxHr?: number
): 'easy' | 'moderate' | 'hard' | 'very_hard' {
  let score = 0;

  // Basé sur l'allure (CSS typique ~1:40-2:00 /100m pour nageur moyen)
  if (avgPace100m < 90) score += 3;  // < 1:30 = très rapide
  else if (avgPace100m < 110) score += 2;  // < 1:50
  else if (avgPace100m < 130) score += 1;  // < 2:10

  // Basé sur la FC
  if (avgHr && maxHr) {
    const hrPercent = avgHr / maxHr;
    if (hrPercent > 0.85) score += 2;
    else if (hrPercent > 0.75) score += 1;
  }

  // Basé sur la durée
  if (durationSeconds > 5400) score += 2;  // > 90min
  else if (durationSeconds > 3600) score += 1;  // > 60min

  if (score >= 5) return 'very_hard';
  if (score >= 3) return 'hard';
  if (score >= 1) return 'moderate';
  return 'easy';
}

// Récupération natation
function estimateSwimmingRecovery(
  effort: 'easy' | 'moderate' | 'hard' | 'very_hard',
  durationMin: number,
  sessionType?: SwimmingSessionType
): { hours: number; suggestion: string } {
  const baseRecovery: Record<string, number> = {
    'easy': 8,
    'moderate': 16,
    'hard': 24,
    'very_hard': 36,
  };

  let hours = baseRecovery[effort];

  // Natation = moins traumatisant que course, récup plus rapide
  if (sessionType === 'technique' || sessionType === 'recovery') {
    hours = Math.min(8, hours);
  }
  if (sessionType === 'race') {
    hours += 12;
  }

  // Ajustement durée
  if (durationMin > 90) hours += 8;
  else if (durationMin > 60) hours += 4;

  hours = Math.min(48, hours);

  let suggestion = '';
  if (hours >= 24) {
    suggestion = 'Récupération ou technique légère demain';
  } else if (hours >= 16) {
    suggestion = 'Séance endurance possible demain';
  } else {
    suggestion = 'Entraînement normal possible';
  }

  return { hours, suggestion };
}

/**
 * Trouver la dernière activité d'un type donné
 */
export async function findLastActivity(
  sportType?: string // 'Run', 'Ride', 'Swim', etc. ou undefined pour toutes
): Promise<StravaActivity | null> {
  const activities = await stravaApi.getActivities({ perPage: 20 });

  if (!sportType) {
    return activities[0] || null;
  }

  // Mapper les termes en français vers les types Strava
  const typeMapping: Record<string, string[]> = {
    'course': ['Run', 'TrailRun', 'VirtualRun', 'Treadmill'],
    'running': ['Run', 'TrailRun', 'VirtualRun', 'Treadmill'],
    'vélo': ['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide'],
    'cycling': ['Ride', 'VirtualRide', 'GravelRide', 'MountainBikeRide', 'EBikeRide'],
    'natation': ['Swim'],
    'swimming': ['Swim'],
  };

  const matchingTypes = typeMapping[sportType.toLowerCase()] || [sportType];

  return activities.find(a => matchingTypes.includes(a.type)) || null;
}

// Export
export const activityAnalysisService = {
  analyzeRunningActivity,
  analyzeCyclingActivity,
  analyzeSwimmingActivity,
  findLastActivity,
  formatPace,
  formatSwimPace,
};
