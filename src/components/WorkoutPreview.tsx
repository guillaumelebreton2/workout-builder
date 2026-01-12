import { WorkoutStep, SWIM_STROKE_LABELS, SWIM_EQUIPMENT_LABELS, SWIM_DRILL_LABELS, SWIM_INTENSITY_LABELS } from '../lib/types';
import { formatDurationDisplay } from '../lib/workout-parser';

interface WorkoutPreviewProps {
  steps: WorkoutStep[];
}

// Structure pour l'affichage groupé
interface DisplayBlock {
  type: 'single' | 'repeat';
  steps: WorkoutStep[];
  repeatCount?: number;
}

const STEP_COLORS: Record<string, string> = {
  warmup: 'bg-orange-50 border-orange-300 text-orange-800',
  active: 'bg-blue-50 border-blue-300 text-blue-800',
  recovery: 'bg-green-50 border-green-300 text-green-800',
  cooldown: 'bg-purple-50 border-purple-300 text-purple-800',
  rest: 'bg-gray-50 border-gray-300 text-gray-800',
  other: 'bg-slate-50 border-slate-300 text-slate-800',
};

const ZONE_COLORS: Record<number, string> = {
  1: 'bg-gray-200',
  2: 'bg-green-200',
  3: 'bg-yellow-200',
  4: 'bg-orange-200',
  5: 'bg-red-200',
};

// Formater l'allure en min:sec
function formatPace(minutes: number): string {
  const mins = Math.floor(minutes);
  const secs = Math.round((minutes - mins) * 60);
  return `${mins}'${secs.toString().padStart(2, '0')}`;
}

// Formater une plage d'allures, avec gestion des valeurs uniques
// Si low ≈ high (moins de 2 secondes d'écart), afficher une petite plage de 1 seconde
function formatPaceRange(low: number, high: number): string {
  const diffSeconds = Math.abs(low - high) * 60;

  if (diffSeconds < 2) {
    // Valeur unique : créer une plage de 1 seconde (ex: 4:59 - 5:00)
    const baseSeconds = Math.round(Math.max(low, high) * 60);
    const highMins = Math.floor(baseSeconds / 60);
    const highSecs = baseSeconds % 60;
    const lowSeconds = baseSeconds - 1;
    const lowMins = Math.floor(lowSeconds / 60);
    const lowSecs = lowSeconds % 60;
    return `${lowMins}'${lowSecs.toString().padStart(2, '0')} - ${highMins}'${highSecs.toString().padStart(2, '0')}/km`;
  }

  // Plage normale
  return `${formatPace(low)} - ${formatPace(high)}/km`;
}

// Formater la distance
function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters} m`;
}

// Comparer deux steps pour voir s'ils sont similaires (pour détecter les répétitions)
function stepsAreSimilar(a: WorkoutStep, b: WorkoutStep): boolean {
  // Vérifications de base
  if (a.type !== b.type) return false;
  if (a.duration.type !== b.duration.type) return false;
  if (a.duration.value !== b.duration.value) return false;
  if (a.details?.capPercent?.low !== b.details?.capPercent?.low) return false;
  if (a.details?.capPercent?.high !== b.details?.capPercent?.high) return false;

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
  const aEquip = a.details?.swimEquipment?.sort().join(',') || '';
  const bEquip = b.details?.swimEquipment?.sort().join(',') || '';
  if (aEquip !== bEquip) return false;

  return true;
}

// Détecter les patterns de répétition dans les steps
function detectRepeatBlocks(steps: WorkoutStep[]): DisplayBlock[] {
  if (steps.length === 0) return [];

  const blocks: DisplayBlock[] = [];
  let i = 0;

  while (i < steps.length) {
    // Chercher un pattern de répétition à partir de la position actuelle
    // On essaie différentes tailles de pattern (1-4 steps par répétition)
    let bestPattern: { size: number; count: number; hasPartialEnd: boolean } | null = null;

    for (let patternSize = 1; patternSize <= 4; patternSize++) {
      if (i + patternSize > steps.length) break;

      const pattern = steps.slice(i, i + patternSize);
      let repeatCount = 1;

      // Compter combien de fois ce pattern se répète
      let j = i + patternSize;
      while (j + patternSize <= steps.length) {
        const nextChunk = steps.slice(j, j + patternSize);
        const matches = pattern.every((step, idx) => stepsAreSimilar(step, nextChunk[idx]));
        if (matches) {
          repeatCount++;
          j += patternSize;
        } else {
          break;
        }
      }

      // Vérifier s'il y a un pattern partiel à la fin (ex: dernier 800m sans récup)
      // Pour un pattern [effort, récup], vérifier si le step suivant est juste l'effort
      let hasPartialEnd = false;
      if (patternSize >= 2 && j < steps.length) {
        // Vérifier si les steps restants correspondent au début du pattern
        const remaining = steps.length - j;
        if (remaining < patternSize) {
          const partialMatch = steps.slice(j).every((step, idx) => stepsAreSimilar(step, pattern[idx]));
          if (partialMatch) {
            hasPartialEnd = true;
            repeatCount++; // Compter cette répétition partielle
          }
        }
      }

      // On garde le meilleur pattern (au moins 2 répétitions pour être significatif)
      if (repeatCount >= 2 && (!bestPattern || repeatCount * patternSize > bestPattern.count * bestPattern.size)) {
        bestPattern = { size: patternSize, count: repeatCount, hasPartialEnd };
      }
    }

    if (bestPattern && bestPattern.count >= 2) {
      // On a trouvé un pattern répété
      // Déterminer quels steps inclure dans le pattern affiché
      const patternToShow = steps.slice(i, i + bestPattern.size);

      // Si la dernière répétition est partielle (sans récup), on affiche le pattern complet
      // mais on note que la dernière n'a pas de récup
      const fullPatternSteps = bestPattern.hasPartialEnd
        ? bestPattern.size * (bestPattern.count - 1) + (steps.length - (i + bestPattern.size * (bestPattern.count - 1)))
        : bestPattern.size * bestPattern.count;

      blocks.push({
        type: 'repeat',
        steps: patternToShow,
        repeatCount: bestPattern.count,
      });
      i += fullPatternSteps;
    } else {
      // Pas de répétition, ajouter comme step simple
      blocks.push({
        type: 'single',
        steps: [steps[i]],
      });
      i++;
    }
  }

  return blocks;
}

// Composant pour afficher un step individuel
function StepRow({ step, showIndex, index }: { step: WorkoutStep; showIndex?: boolean; index?: number }) {
  return (
    <div className={`p-3 rounded border ${STEP_COLORS[step.type]}`}>
      {/* Ligne principale */}
      <div className="flex items-center gap-3">
        {showIndex && (
          <span className="text-xs font-mono w-6 text-center opacity-60">
            {index}
          </span>
        )}
        <div className="flex-1">
          <div>
            <span className="font-medium">{step.name}</span>
            {step.intensity?.zone && (
              <span className="ml-2 text-xs opacity-75">
                Zone {step.intensity.zone}
              </span>
            )}
          </div>
          {step.notes && step.notes !== step.name && (
            <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">
              {step.notes}
            </div>
          )}
        </div>
        <span className="text-sm font-mono font-medium">
          {step.duration.type === 'open'
            ? '⏱ Lap'
            : step.duration.value
              ? formatDurationDisplay(step.duration.type, step.duration.value)
              : 'Libre'}
        </span>
      </div>

      {/* Détails supplémentaires */}
      {step.details && (
        <div className={`mt-2 ${showIndex ? 'ml-9' : ''} flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80`}>
          {/* % CAP */}
          {step.details.capPercent && (
            <span className="flex items-center gap-1">
              <span className="font-medium">CAP:</span>
              {step.details.capPercent.low}% - {step.details.capPercent.high}%
            </span>
          )}

          {/* Allure course à pied : allure /km + (km/h) entre parenthèses si disponible */}
          {step.details.paceMinKm && (
            <span className="flex items-center gap-1">
              <span className="font-medium">Allure:</span>
              {formatPaceRange(step.details.paceMinKm.low, step.details.paceMinKm.high)}
              {step.details.speedKmh && (
                <span className="text-gray-500">
                  ({step.details.speedKmh.low.toFixed(1)} - {step.details.speedKmh.high.toFixed(1)} km/h)
                </span>
              )}
            </span>
          )}
          {/* Vitesse seule si pas d'allure (ne devrait pas arriver) */}
          {!step.details.paceMinKm && step.details.speedKmh && (
            <span className="flex items-center gap-1">
              <span className="font-medium">Vitesse:</span>
              {step.details.speedKmh.low.toFixed(1)} - {step.details.speedKmh.high.toFixed(1)} km/h
            </span>
          )}

          {/* Puissance vélo : afficher watts + % entre parenthèses si applicable */}
          {step.details.watts && (
            <span className="flex items-center gap-1">
              <span className="font-medium">Puissance:</span>
              {step.details.watts.low} - {step.details.watts.high} W
              {step.details.powerPercent && (
                <span className="text-gray-500">
                  ({step.details.powerPercent.low}% - {step.details.powerPercent.high}%)
                </span>
              )}
            </span>
          )}
          {/* Si seulement % sans watts (ne devrait pas arriver normalement) */}
          {!step.details.watts && step.details.powerPercent && (
            <span className="flex items-center gap-1">
              <span className="font-medium">Puissance:</span>
              {step.details.powerPercent.low}% - {step.details.powerPercent.high}%
            </span>
          )}

          {/* Cadence (vélo) */}
          {step.details.cadence && (
            <span className="flex items-center gap-1">
              <span className="font-medium">Cadence:</span>
              {step.details.cadence} rpm
            </span>
          )}

          {/* Allure natation */}
          {step.details.swimPaceMin100m && (
            <span className="flex items-center gap-1">
              <span className="font-medium">Allure:</span>
              {formatPace(step.details.swimPaceMin100m.low)} - {formatPace(step.details.swimPaceMin100m.high)}/100m
            </span>
          )}

          {/* Type de nage */}
          {step.details.swimStroke && (
            <span className="flex items-center gap-1">
              <span className="font-medium">Nage:</span>
              {SWIM_STROKE_LABELS[step.details.swimStroke]}
            </span>
          )}

          {/* Équipements natation */}
          {step.details.swimEquipment && step.details.swimEquipment.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="font-medium">Équipement:</span>
              {step.details.swimEquipment.map(eq => SWIM_EQUIPMENT_LABELS[eq]).join(', ')}
            </span>
          )}

          {/* Type d'exercice natation */}
          {step.details.swimDrill && (
            <span className="flex items-center gap-1">
              <span className="font-medium">Exercice:</span>
              {SWIM_DRILL_LABELS[step.details.swimDrill]}
            </span>
          )}

          {/* Intensité natation */}
          {step.details.swimIntensity && (
            <span className="flex items-center gap-1">
              <span className="font-medium">Intensité:</span>
              {SWIM_INTENSITY_LABELS[step.details.swimIntensity]}
            </span>
          )}

          {/* Notes natation */}
          {step.details.swimNotes && (
            <span className="flex items-center gap-1 italic text-gray-600">
              {step.details.swimNotes}
            </span>
          )}

          {/* Distance estimée */}
          {step.details.distanceMeters && (
            <span className="flex items-center gap-1">
              <span className="font-medium">Distance:</span>
              {formatDistance(step.details.distanceMeters.low)} - {formatDistance(step.details.distanceMeters.high)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkoutPreview({ steps }: WorkoutPreviewProps) {
  if (steps.length === 0) {
    return null;
  }

  // Détecter les blocs de répétition
  const displayBlocks = detectRepeatBlocks(steps);

  // Calculer la durée/distance totale
  const totals = steps.reduce(
    (acc, step) => {
      if (step.duration.value) {
        if (step.duration.type === 'time') {
          acc.time += step.duration.value;
        } else if (step.duration.type === 'distance') {
          acc.distance += step.duration.value;
        }
      }
      return acc;
    },
    { time: 0, distance: 0 }
  );

  // Compter les steps uniques pour l'affichage
  let stepCounter = 0;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-medium text-gray-900">Prévisualisation</h3>
          <div className="text-sm text-gray-600">
            {steps.length} étape{steps.length > 1 ? 's' : ''}
            {totals.time > 0 && (
              <span className="ml-2">
                • {formatDurationDisplay('time', totals.time)}
              </span>
            )}
            {totals.distance > 0 && (
              <span className="ml-2">
                • {formatDistance(totals.distance)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Timeline visuelle */}
      <div className="p-4">
        <div className="flex gap-0.5 mb-4 h-8 rounded overflow-hidden">
          {steps.map((step) => {
            const totalValue = totals.time > 0 ? totals.time : totals.distance;
            const stepValue = step.duration.value || 0;
            const widthPercent = totalValue > 0
              ? (stepValue / totalValue) * 100
              : 100 / steps.length;
            const zoneColor = step.intensity?.zone
              ? ZONE_COLORS[step.intensity.zone]
              : 'bg-blue-200';

            return (
              <div
                key={step.id}
                className={`${zoneColor} flex items-center justify-center text-xs font-medium min-w-[4px]`}
                style={{ width: `${Math.max(widthPercent, 1)}%` }}
                title={`${step.name}: ${formatDurationDisplay(step.duration.type, step.duration.value || 0)}`}
              >
                {widthPercent > 5 && step.intensity?.zone && `Z${step.intensity.zone}`}
              </div>
            );
          })}
        </div>

        {/* Liste des blocs */}
        <div className="space-y-2">
          {displayBlocks.map((block, blockIndex) => {
            if (block.type === 'repeat') {
              // Bloc de répétition
              const patternSteps = block.steps;
              return (
                <div
                  key={`block-${blockIndex}`}
                  className="border-2 border-indigo-300 rounded-lg overflow-hidden"
                >
                  {/* Header du bloc répétition */}
                  <div className="bg-indigo-100 px-3 py-2 flex items-center gap-2">
                    <span className="bg-indigo-600 text-white text-sm font-bold px-2 py-0.5 rounded">
                      {block.repeatCount}x
                    </span>
                    <span className="text-indigo-800 text-sm font-medium">
                      Répéter {block.repeatCount} fois
                    </span>
                  </div>

                  {/* Contenu du pattern */}
                  <div className="p-2 space-y-2 bg-indigo-50/50">
                    {patternSteps.map((step, stepIndex) => (
                      <StepRow key={`${block.repeatCount}-${stepIndex}`} step={step} />
                    ))}
                  </div>
                </div>
              );
            } else {
              // Step simple
              stepCounter++;
              return (
                <StepRow
                  key={block.steps[0].id}
                  step={block.steps[0]}
                  showIndex
                  index={stepCounter}
                />
              );
            }
          })}
        </div>
      </div>

      {/* Légende des zones */}
      <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-gray-200"></span> Z1 Récup
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-green-200"></span> Z2 Endurance
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-yellow-200"></span> Z3 Tempo
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-orange-200"></span> Z4 Seuil
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-200"></span> Z5 VO2max
          </span>
        </div>
      </div>
    </div>
  );
}
