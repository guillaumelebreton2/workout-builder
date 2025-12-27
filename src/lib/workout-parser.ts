/**
 * Parser de descriptions d'entraînement en français
 *
 * Supporte les formats :
 * - Simple: "10min échauffement + 5x400m récup 1min"
 * - Nolio/Garmin: "15' Échauffement\n20' Corps de séance\n10' Repos"
 */

import { WorkoutStep, StepType, generateId } from './types';

interface ParsedDuration {
  type: 'time' | 'distance';
  value: number; // seconds or meters
}

// Parse une durée (ex: "10min", "1h30", "2km", "400m", "15'", "1min30")
function parseDuration(str: string): ParsedDuration | null {
  str = str.trim().toLowerCase();

  // Format avec apostrophe: 15', 20'
  const apostropheMatch = str.match(/^(\d+)['′]$/);
  if (apostropheMatch) {
    return { type: 'time', value: parseInt(apostropheMatch[1]) * 60 };
  }

  // Heures et minutes: 1h30, 1h
  const hoursMatch = str.match(/^(\d+)h(\d+)?$/);
  if (hoursMatch) {
    const hours = parseInt(hoursMatch[1]);
    const mins = hoursMatch[2] ? parseInt(hoursMatch[2]) : 0;
    return { type: 'time', value: hours * 3600 + mins * 60 };
  }

  // Minutes et secondes: 10min, 1min30, 30s
  const minsMatch = str.match(/^(\d+)\s*min(\d+)?s?$/);
  if (minsMatch) {
    const mins = parseInt(minsMatch[1]);
    const secs = minsMatch[2] ? parseInt(minsMatch[2]) : 0;
    return { type: 'time', value: mins * 60 + secs };
  }

  // Secondes seules: 90s, 45sec
  const secsMatch = str.match(/^(\d+)\s*s(ec)?$/);
  if (secsMatch) {
    return { type: 'time', value: parseInt(secsMatch[1]) };
  }

  // Kilomètres: 2km, 1.5km
  const kmMatch = str.match(/^(\d+(?:[.,]\d+)?)\s*km$/);
  if (kmMatch) {
    return { type: 'distance', value: parseFloat(kmMatch[1].replace(',', '.')) * 1000 };
  }

  // Mètres: 400m, 1000m
  const mMatch = str.match(/^(\d+)\s*m$/);
  if (mMatch) {
    return { type: 'distance', value: parseInt(mMatch[1]) };
  }

  // Nombre seul (interprété comme mètres si > 100, sinon minutes)
  const numMatch = str.match(/^(\d+)$/);
  if (numMatch) {
    const num = parseInt(numMatch[1]);
    if (num > 100) {
      return { type: 'distance', value: num };
    }
    return { type: 'time', value: num * 60 };
  }

  return null;
}

// Détermine le type de step basé sur les mots-clés
function determineStepType(str: string): StepType {
  str = str.toLowerCase();

  if (str.includes('échauffement') || str.includes('echauffement') || str.includes('warmup') || str.includes('warm up')) {
    return 'warmup';
  }
  if (str.includes('récup') || str.includes('recup') || str.includes('repos') || str.includes('rest')) {
    return 'recovery';
  }
  if (str.includes('retour') || str.includes('cooldown') || str.includes('cool down') || str.includes('cool')) {
    return 'cooldown';
  }

  return 'active';
}

// Détermine le nom de l'étape basé sur le contenu
function determineStepName(str: string, type: StepType): string {
  str = str.toLowerCase();

  if (str.includes('corps de séance') || str.includes('corps de seance')) {
    return 'Corps de séance';
  }
  if (str.includes('vitesse max') || str.includes('test')) {
    return 'Test vitesse max';
  }

  switch (type) {
    case 'warmup': return 'Échauffement';
    case 'cooldown': return 'Retour au calme';
    case 'recovery': return 'Récupération';
    default: return 'Actif';
  }
}

// Parse une zone depuis le texte (ex: "Zone 2", "55% - 75%", "101% - 105%")
function parseIntensity(str: string): { zone: number } | null {
  str = str.toLowerCase();

  // Format pourcentage: 55% - 75%, 101% - 105%
  const percentMatch = str.match(/(\d+)%\s*-\s*(\d+)%/);
  if (percentMatch) {
    const low = parseInt(percentMatch[1]);
    const high = parseInt(percentMatch[2]);
    const avg = (low + high) / 2;

    if (avg <= 60) return { zone: 1 };
    if (avg <= 75) return { zone: 2 };
    if (avg <= 90) return { zone: 3 };
    if (avg <= 105) return { zone: 4 };
    return { zone: 5 };
  }

  // Format zone explicite
  const zoneMatch = str.match(/z(?:one)?\s*(\d)/);
  if (zoneMatch) {
    return { zone: parseInt(zoneMatch[1]) };
  }

  // Mots-clés d'intensité
  if (str.includes('récup') || str.includes('repos') || str.includes('facile')) return { zone: 1 };
  if (str.includes('endurance') || str.includes('fondamentale')) return { zone: 2 };
  if (str.includes('tempo') || str.includes('modéré')) return { zone: 3 };
  if (str.includes('seuil') || str.includes('vite')) return { zone: 4 };
  if (str.includes('vo2') || str.includes('max') || str.includes('sprint')) return { zone: 5 };

  return null;
}

// Parse les répétitions (ex: "5x", "8 x", "10fois")
function parseRepetitions(str: string): { count: number; rest: string } | null {
  const match = str.match(/^(\d+)\s*[x×]\s*(.+)$/i);
  if (match) {
    return { count: parseInt(match[1]), rest: match[2] };
  }

  const foisMatch = str.match(/^(\d+)\s*fois\s+(.+)$/i);
  if (foisMatch) {
    return { count: parseInt(foisMatch[1]), rest: foisMatch[2] };
  }

  return null;
}

// Détecte si c'est un format structuré (Nolio) avec lignes séparées
// Format: "15' Échauffement 55%-75%"
function isStructuredFormat(text: string): boolean {
  const lines = text.split('\n').filter(l => l.trim());
  const structuredLines = lines.filter(line =>
    /^\d+['′]?\s+\w/.test(line.trim()) ||
    /^\d+\s*min\s+\w/i.test(line.trim())
  );
  return structuredLines.length >= 2;
}

// Parse le format structuré (Nolio)
// Formats acceptés:
// - "15' Échauffement 55%-75%"
// - "15' Échauffement 100%"
// - "lap Échauffement 55%-75%" (appui bouton lap)
// - "Échauffement 55%-75%" (sans durée = lap)
function parseStructuredFormat(text: string): WorkoutStep[] {
  const steps: WorkoutStep[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let durationMins: number | null = null;
    let description: string = '';
    let capLow: number | null = null;
    let capHigh: number | null = null;
    let isLap = false;

    // Format avec durée: "15' Échauffement 55%-75%"
    const matchWithDuration = trimmed.match(/^(\d+)['′]?\s+(.+?)(?:\s+(\d+)%(?:\s*-\s*(\d+)%)?)?$/);

    // Format lap explicite: "lap Échauffement 55%-75%"
    const matchLap = trimmed.match(/^lap\s+(.+?)(?:\s+(\d+)%(?:\s*-\s*(\d+)%)?)?$/i);

    // Format sans durée (implicitement lap): "Échauffement 55%-75%"
    const matchNoDuration = trimmed.match(/^([a-zA-ZÀ-ÿ\s]+?)(?:\s+(\d+)%(?:\s*-\s*(\d+)%)?)?$/);

    if (matchWithDuration) {
      durationMins = parseInt(matchWithDuration[1]);
      description = matchWithDuration[2].trim();
      capLow = matchWithDuration[3] ? parseInt(matchWithDuration[3]) : null;
      capHigh = matchWithDuration[4] ? parseInt(matchWithDuration[4]) : capLow;
    } else if (matchLap) {
      isLap = true;
      description = matchLap[1].trim();
      capLow = matchLap[2] ? parseInt(matchLap[2]) : null;
      capHigh = matchLap[3] ? parseInt(matchLap[3]) : capLow;
    } else if (matchNoDuration && determineStepType(matchNoDuration[1]) !== 'active') {
      // Seulement si c'est un mot-clé reconnu (échauffement, repos, etc.)
      isLap = true;
      description = matchNoDuration[1].trim();
      capLow = matchNoDuration[2] ? parseInt(matchNoDuration[2]) : null;
      capHigh = matchNoDuration[3] ? parseInt(matchNoDuration[3]) : capLow;
    } else {
      continue; // Ligne non reconnue
    }

    const type = determineStepType(description);
    const name = determineStepName(description, type);

    // Calculer la zone à partir du % CAP
    let zone: number | undefined;
    if (capLow) {
      const avg = capHigh ? (capLow + capHigh) / 2 : capLow;
      if (avg <= 60) zone = 1;
      else if (avg <= 75) zone = 2;
      else if (avg <= 90) zone = 3;
      else if (avg <= 105) zone = 4;
      else zone = 5;
    }

    const step: WorkoutStep = {
      id: generateId(),
      type,
      name: isLap ? `${name} (lap)` : name,
      duration: {
        type: isLap ? 'open' : 'time',
        value: durationMins ? durationMins * 60 : undefined,
      },
    };

    if (zone) {
      step.intensity = { type: 'heartRate', zone };
    }

    if (capLow) {
      step.details = {
        capPercent: { low: capLow, high: capHigh || capLow },
      };
    }

    steps.push(step);
  }

  return steps;
}

// Parse le format simple (inline)
function parseSimpleFormat(description: string): WorkoutStep[] {
  const steps: WorkoutStep[] = [];

  // Nettoyer et normaliser
  let text = description
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/['′]/g, 'min')
    .replace(/["″]/g, 's')
    .trim();

  // Séparer par les connecteurs
  const segments = text.split(/\s*(?:\+|puis|ensuite|et puis|,)\s*/);

  for (const segment of segments) {
    if (!segment.trim()) continue;

    // Vérifier si c'est une répétition
    const repMatch = parseRepetitions(segment);

    if (repMatch) {
      const { count, rest } = repMatch;

      // Chercher la récupération
      const recupMatch = rest.match(/(.+?)\s*(?:récup|recup|repos|r)\s*(.+)?$/i);

      if (recupMatch) {
        const mainPart = recupMatch[1].trim();
        const recupPart = recupMatch[2]?.trim();

        const mainDuration = parseDuration(mainPart.split(/\s+/)[0]);

        if (mainDuration) {
          for (let i = 0; i < count; i++) {
            steps.push({
              id: generateId(),
              type: 'active',
              name: `Intervalle ${i + 1}/${count}`,
              duration: {
                type: mainDuration.type,
                value: mainDuration.value,
              },
              intensity: { type: 'heartRate', zone: 4 },
            });

            if (recupPart && i < count - 1) {
              const recupDuration = parseDuration(recupPart.split(/\s+/)[0]);
              if (recupDuration) {
                steps.push({
                  id: generateId(),
                  type: 'recovery',
                  name: 'Récupération',
                  duration: {
                    type: recupDuration.type,
                    value: recupDuration.value,
                  },
                  intensity: { type: 'heartRate', zone: 1 },
                });
              }
            }
          }
        }
      } else {
        // Simple répétition sans récup
        const duration = parseDuration(rest.split(/\s+/)[0]);
        if (duration) {
          for (let i = 0; i < count; i++) {
            steps.push({
              id: generateId(),
              type: 'active',
              name: `Répétition ${i + 1}/${count}`,
              duration: {
                type: duration.type,
                value: duration.value,
              },
              intensity: { type: 'heartRate', zone: 4 },
            });
          }
        }
      }
    } else {
      // Segment simple
      const type = determineStepType(segment);
      const intensity = parseIntensity(segment);

      const words = segment.split(/\s+/);
      let duration: ParsedDuration | null = null;

      for (const word of words) {
        duration = parseDuration(word);
        if (duration) break;
      }

      if (duration) {
        steps.push({
          id: generateId(),
          type,
          name: determineStepName(segment, type),
          duration: {
            type: duration.type,
            value: duration.value,
          },
          intensity: intensity ? { type: 'heartRate', ...intensity } :
                     type === 'warmup' || type === 'cooldown' ? { type: 'heartRate', zone: 2 } :
                     type === 'recovery' ? { type: 'heartRate', zone: 1 } :
                     undefined,
        });
      }
    }
  }

  return steps;
}

// Calculer l'allure à partir du % CAP et de l'allure de référence
function calculatePaceFromCap(capPercent: { low: number; high: number }, referenceSpeedKmh: number): { low: number; high: number } {
  // CAP% s'applique à la vitesse
  // Ex: référence 15 km/h, 80% CAP = 12 km/h
  const speedLow = referenceSpeedKmh * (capPercent.low / 100);
  const speedHigh = referenceSpeedKmh * (capPercent.high / 100);

  // Convertir en allure (min/km)
  return {
    low: 60 / speedHigh,  // vitesse haute = allure basse
    high: 60 / speedLow,  // vitesse basse = allure haute
  };
}

// Calculer la distance estimée à partir de la durée et de l'allure
function calculateDistance(durationSeconds: number, paceMinKm: { low: number; high: number }): { low: number; high: number } {
  const durationMin = durationSeconds / 60;
  return {
    low: Math.round((durationMin / paceMinKm.high) * 1000),  // allure haute = distance basse
    high: Math.round((durationMin / paceMinKm.low) * 1000),  // allure basse = distance haute
  };
}

// Enrichir les steps avec les allures calculées
function enrichStepsWithPace(steps: WorkoutStep[], referencePaceMinKm: number | null): WorkoutStep[] {
  if (!referencePaceMinKm) return steps;

  // Convertir l'allure de référence en vitesse (km/h)
  const referenceSpeedKmh = 60 / referencePaceMinKm;

  return steps.map(step => {
    const newStep = { ...step };

    // Si on a un % CAP mais pas d'allure, calculer l'allure
    if (step.details?.capPercent && !step.details?.paceMinKm) {
      const paceMinKm = calculatePaceFromCap(step.details.capPercent, referenceSpeedKmh);
      const speedKmh = {
        low: 60 / paceMinKm.high,
        high: 60 / paceMinKm.low,
      };

      newStep.details = {
        ...step.details,
        paceMinKm,
        speedKmh,
      };

      // Calculer la distance si on a une durée en temps
      if (step.duration.type === 'time' && step.duration.value && !step.details?.distanceMeters) {
        newStep.details.distanceMeters = calculateDistance(step.duration.value, paceMinKm);
      }
    }

    return newStep;
  });
}

// Parser principal
export function parseWorkoutDescription(description: string, referencePaceMinKm?: number): WorkoutStep[] {
  if (!description.trim()) {
    return [];
  }

  let steps: WorkoutStep[];

  // Détecter le format
  if (isStructuredFormat(description)) {
    steps = parseStructuredFormat(description);
  } else {
    steps = parseSimpleFormat(description);
  }

  // Enrichir avec les allures calculées si on a une référence
  if (referencePaceMinKm) {
    steps = enrichStepsWithPace(steps, referencePaceMinKm);
  }

  return steps;
}

// Formater une durée pour l'affichage
export function formatDurationDisplay(type: 'time' | 'distance' | 'open', value: number): string {
  if (type === 'open') {
    return 'Lap';
  }
  if (type === 'distance') {
    if (value >= 1000) {
      const km = value / 1000;
      return km % 1 === 0 ? `${km} km` : `${km.toFixed(1)} km`;
    }
    return `${value} m`;
  }

  const hours = Math.floor(value / 3600);
  const mins = Math.floor((value % 3600) / 60);
  const secs = value % 60;

  if (hours > 0) {
    return mins > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : `${hours}h`;
  }
  if (mins > 0) {
    return secs > 0 ? `${mins}min${secs.toString().padStart(2, '0')}s` : `${mins} min`;
  }
  return `${secs}s`;
}
