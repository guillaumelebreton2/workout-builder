import { GarminStep, GarminWorkout, GarminIntensity, GarminSport } from '../lib/garmin-format';

interface GarminWorkoutPreviewProps {
  garminWorkout: GarminWorkout;
}

const SPORT_LABELS: Record<GarminSport, string> = {
  RUNNING: 'Course à pied',
  CYCLING: 'Vélo',
  LAP_SWIMMING: 'Natation',
};

const INTENSITY_LABELS: Record<GarminIntensity | string, string> = {
  WARMUP: 'Échauffement',
  ACTIVE: 'Actif',
  RECOVERY: 'Récupération',
  COOLDOWN: 'Récupération',
  REST: 'Repos',
  INTERVAL: 'Autre',
};

const INTENSITY_COLORS: Record<GarminIntensity | string, string> = {
  WARMUP: '#e02c2c',        // rouge
  ACTIVE: '#1976d2',        // bleu
  RECOVERY: '#a6a6a6',      // gris
  COOLDOWN: '#16a544',      // vert
  REST: '#a6a6a6',          // gris
  INTERVAL: '#1976d2',      // bleu
  INTERVAL_WALK: '#1976d2', // bleu
  OTHER: '#1976d2',         // bleu
};

const INTENSITY_BG_COLORS: Record<GarminIntensity | string, string> = {
  WARMUP: 'bg-red-950/30',
  ACTIVE: 'bg-blue-950/30',
  RECOVERY: 'bg-gray-800',
  COOLDOWN: 'bg-green-950/30',
  REST: 'bg-gray-800',
  INTERVAL: 'bg-blue-950/30',
  INTERVAL_WALK: 'bg-blue-950/30',
  OTHER: 'bg-blue-950/30',
};

const SPORT_COLORS: Record<GarminSport, { bg: string; text: string }> = {
  RUNNING: { bg: 'bg-orange-500', text: 'text-orange-400' },
  CYCLING: { bg: 'bg-blue-500', text: 'text-blue-400' },
  LAP_SWIMMING: { bg: 'bg-cyan-500', text: 'text-cyan-400' },
};

function formatDuration(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDistance(meters: number): string {
  if (meters >= 1000) {
    const km = meters / 1000;
    return km % 1 === 0 ? `${km} km` : `${km.toFixed(2).replace('.', ',')} km`;
  }
  return `${meters} m`;
}

function formatPace(minPerKm: number): string {
  if (!isFinite(minPerKm) || minPerKm <= 0) return '--';
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function msToMinPerKm(ms: number): number {
  // m/s -> min/km : 1000m / (ms * 60)
  return 1000 / (ms * 60);
}

interface TargetDisplay {
  main: string;
  range?: string;
  label: string;
}

function formatTarget(step: GarminStep): TargetDisplay | null {
  const { targetType, targetValueLow, targetValueHigh, targetValueType } = step;

  if (targetType === 'PACE' && (targetValueLow || targetValueHigh)) {
    const lowMs = targetValueHigh ?? targetValueLow ?? 0;
    const highMs = targetValueLow ?? targetValueHigh ?? 0;
    const lowPace = formatPace(msToMinPerKm(lowMs));
    const highPace = formatPace(msToMinPerKm(highMs));
    const mainPace = formatPace((msToMinPerKm(lowMs) + msToMinPerKm(highMs)) / 2);
    return {
      main: `${mainPace} /km`,
      range: lowPace === highPace ? undefined : `(${lowPace}-${highPace} /km)`,
      label: "Objectif d'intensité",
    };
  }

  if (targetType === 'POWER') {
    if (targetValueType === 'PERCENT' && (targetValueLow || targetValueHigh)) {
      const main = targetValueLow === targetValueHigh
        ? `${targetValueLow}%`
        : `${targetValueLow}-${targetValueHigh}%`;
      return { main: `${main} FTP`, label: 'Puissance' };
    }
    if (targetValueLow || targetValueHigh) {
      const main = targetValueLow === targetValueHigh
        ? `${targetValueLow} W`
        : `${targetValueLow}-${targetValueHigh} W`;
      return { main, label: 'Puissance' };
    }
  }

  if (targetType === 'CADENCE' && (targetValueLow || targetValueHigh)) {
    const main = targetValueLow === targetValueHigh
      ? `${targetValueLow} rpm`
      : `${targetValueLow}-${targetValueHigh} rpm`;
    return { main, label: 'Cadence' };
  }

  if (targetType === 'HEART_RATE' && (targetValueLow || targetValueHigh)) {
    const main = targetValueLow === targetValueHigh
      ? `${targetValueLow} bpm`
      : `${targetValueLow}-${targetValueHigh} bpm`;
    return { main, label: 'Fréquence cardiaque' };
  }

  return null;
}

function formatSecondaryTarget(step: GarminStep): TargetDisplay | null {
  const { secondaryTargetType, secondaryTargetValueLow, secondaryTargetValueHigh } = step;

  if (secondaryTargetType === 'CADENCE' && (secondaryTargetValueLow || secondaryTargetValueHigh)) {
    const main = secondaryTargetValueLow === secondaryTargetValueHigh
      ? `${secondaryTargetValueLow} rpm`
      : `${secondaryTargetValueLow}-${secondaryTargetValueHigh} rpm`;
    return { main, label: 'Cadence' };
  }

  if (secondaryTargetType === 'PACE_ZONE' && (secondaryTargetValueLow || secondaryTargetValueHigh)) {
    const lowMs = secondaryTargetValueHigh ?? secondaryTargetValueLow ?? 0;
    const highMs = secondaryTargetValueLow ?? secondaryTargetValueHigh ?? 0;
    const lowPace = formatPace(msToMinPerKm(lowMs) / 10);
    const highPace = formatPace(msToMinPerKm(highMs) / 10);
    const mainPace = formatPace((msToMinPerKm(lowMs) + msToMinPerKm(highMs)) / 20);
    return {
      main: `${mainPace} /100m`,
      range: lowPace === highPace ? undefined : `(${lowPace}-${highPace} /100m)`,
      label: 'Allure',
    };
  }

  if (secondaryTargetType === 'SWIM_INSTRUCTION' && secondaryTargetValueLow) {
    const map: Record<number, string> = {
      1: 'Récup',
      3: 'Facile',
      4: 'Modéré',
      5: 'Difficile',
      6: 'Très difficile',
      7: 'Max',
    };
    const label = map[secondaryTargetValueLow];
    return label ? { main: label, label: 'Intensité' } : null;
  }

  return null;
}

function estimateTimeSeconds(step: GarminStep): number | null {
  if (step.durationType === 'TIME' && step.durationValue) {
    return step.durationValue;
  }
  if (step.durationType === 'DISTANCE' && step.durationValue && step.targetType === 'PACE') {
    const ms = step.targetValueLow || step.targetValueHigh || 0;
    if (ms > 0) {
      return (step.durationValue / ms);
    }
  }
  return null;
}

function estimateDistanceMeters(step: GarminStep): number | null {
  if (step.durationType === 'DISTANCE' && step.durationValue) {
    return step.durationValue;
  }
  if (step.durationType === 'TIME' && step.durationValue && step.targetType === 'PACE') {
    const ms = step.targetValueLow || step.targetValueHigh || 0;
    if (ms > 0) {
      return Math.round(step.durationValue * ms);
    }
  }
  return null;
}

function getStepLabel(step: GarminStep, sport: GarminSport): string {
  if (step.intensity === 'ACTIVE') {
    if (sport === 'RUNNING') return 'Course à pied';
    if (sport === 'CYCLING') return 'Vélo';
    if (sport === 'LAP_SWIMMING') return 'Natation';
  }
  if (step.intensity && INTENSITY_LABELS[step.intensity]) {
    return INTENSITY_LABELS[step.intensity];
  }
  return step.description || 'Étape';
}

function getStepDurationLabel(step: GarminStep): string {
  if (step.durationType === 'OPEN') return 'Appui sur touche Lap';
  if (step.durationType === 'TIME' && step.durationValue) return formatDuration(step.durationValue);
  if (step.durationType === 'DISTANCE' && step.durationValue) return formatDistance(step.durationValue);
  return 'Appui sur touche Lap';
}

function flattenSteps(steps: GarminStep[]): GarminStep[] {
  const result: GarminStep[] = [];
  for (const step of steps) {
    if (step.type === 'WorkoutRepeatStep' && step.steps && step.repeatValue) {
      for (let i = 0; i < step.repeatValue; i++) {
        result.push(...step.steps);
      }
    } else {
      result.push(step);
    }
  }
  return result;
}

function computeTotals(steps: GarminStep[]): { time: number; distance: number } {
  const flat = flattenSteps(steps);
  return flat.reduce(
    (acc, step) => {
      const estTime = estimateTimeSeconds(step);
      const estDist = estimateDistanceMeters(step);
      if (estTime) acc.time += estTime;
      if (estDist) acc.distance += estDist;
      return acc;
    },
    { time: 0, distance: 0 }
  );
}

function StepCard({ step, sport }: { step: GarminStep; sport: GarminSport }) {
  const color = INTENSITY_COLORS[step.intensity || 'ACTIVE'] || INTENSITY_COLORS.ACTIVE;
  const bgColor = INTENSITY_BG_COLORS[step.intensity || 'ACTIVE'] || INTENSITY_BG_COLORS.ACTIVE;
  const target = formatTarget(step);
  const secondary = formatSecondaryTarget(step);
  const estTime = estimateTimeSeconds(step);
  const estDistance = estimateDistanceMeters(step);

  const primaryMetrics: { value: string; label: string }[] = [];

  if (step.durationType === 'TIME' && step.durationValue) {
    primaryMetrics.push({ value: formatDuration(step.durationValue), label: 'Temps total' });
    if (estDistance !== null) {
      primaryMetrics.push({ value: formatDistance(estDistance), label: 'Distance estimée' });
    }
  } else if (step.durationType === 'DISTANCE' && step.durationValue) {
    primaryMetrics.push({ value: formatDistance(step.durationValue), label: 'Distance totale' });
    if (estTime !== null) {
      primaryMetrics.push({ value: formatDuration(estTime), label: 'Temps estimé' });
    }
  }

  return (
    <div
      className={`${bgColor} rounded-xl overflow-hidden`}
      style={{ borderLeftWidth: '6px', borderLeftColor: color }}
    >
      <div className="p-4">
        <div className="font-semibold text-white text-base leading-tight">
          {getStepLabel(step, sport)}
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-3">
          {primaryMetrics.map((m, idx) => (
            <div key={idx}>
              <div className="text-white font-medium text-sm leading-tight">{m.value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{m.label}</div>
            </div>
          ))}
          {target && (
            <div>
              <div className="text-white font-medium text-sm leading-tight">{target.main}</div>
              {target.range && (
                <div className="text-gray-400 text-xs leading-tight mt-0.5">{target.range}</div>
              )}
              <div className="text-xs text-gray-400 mt-0.5">{target.label}</div>
            </div>
          )}
          {secondary && (
            <div>
              <div className="text-white font-medium text-sm leading-tight">{secondary.main}</div>
              {secondary.range && (
                <div className="text-gray-400 text-xs leading-tight mt-0.5">{secondary.range}</div>
              )}
              <div className="text-xs text-gray-400 mt-0.5">{secondary.label}</div>
            </div>
          )}
        </div>
      </div>

      {step.description && (
        <div className="px-4 pb-3 pt-0">
          <div className="border-t border-white/10 pt-2 text-sm text-gray-300 italic">
            {step.description}
          </div>
        </div>
      )}
    </div>
  );
}

function RepeatBlock({ step, sport }: { step: GarminStep; sport: GarminSport }) {
  if (!step.steps || step.steps.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-600 overflow-hidden">
      <div className="px-4 py-2 flex items-center gap-2 text-white font-semibold bg-gray-800/50">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>{step.repeatValue} fois</span>
      </div>
      <div className="px-3 pb-3 space-y-2">
        {step.steps.map((s, idx) =>
          s.type === 'WorkoutRepeatStep' ? (
            <RepeatBlock key={`nested-${idx}`} step={s} sport={sport} />
          ) : (
            <StepCard key={`step-${idx}`} step={s} sport={sport} />
          )
        )}
      </div>
      <div className="px-4 pb-3 text-xs text-gray-400">
        Ignorer la dernière récupération : Désactivé
      </div>
    </div>
  );
}

const INTENSITY_HEIGHTS: Record<GarminIntensity | string, string> = {
  WARMUP: '45%',
  ACTIVE: '100%',
  RECOVERY: '35%',
  COOLDOWN: '45%',
  REST: '30%',
  INTERVAL: '90%',
};

function getIntensityHeight(intensity?: GarminIntensity | null): string {
  return (intensity && INTENSITY_HEIGHTS[intensity]) || '70%';
}

function Timeline({ steps, sport }: { steps: GarminStep[]; sport: GarminSport }) {
  const flat = flattenSteps(steps);
  if (flat.length === 0) return null;

  const totalValue = flat.reduce((acc, step) => {
    if (step.durationType === 'TIME' && step.durationValue) return acc + step.durationValue;
    if (step.durationType === 'DISTANCE' && step.durationValue) return acc + step.durationValue;
    return acc;
  }, 0);

  return (
    <div className="flex items-end gap-1 h-24 bg-gray-800 rounded-xl p-3">
      {flat.map((step, idx) => {
        const stepValue =
          (step.durationType === 'TIME' || step.durationType === 'DISTANCE') && step.durationValue
            ? step.durationValue
            : 0;
        const widthPercent = totalValue > 0 ? (stepValue / totalValue) * 100 : 100 / flat.length;
        const color = INTENSITY_COLORS[step.intensity || 'ACTIVE'] || INTENSITY_COLORS.ACTIVE;
        const height = getIntensityHeight(step.intensity);

        return (
          <div
            key={`timeline-${idx}`}
            className="rounded-sm min-w-[4px] transition-all hover:opacity-80"
            style={{
              width: `${Math.max(widthPercent, 0.5)}%`,
              height,
              backgroundColor: color,
            }}
            title={`${getStepLabel(step, sport)} : ${getStepDurationLabel(step)}`}
          />
        );
      })}
    </div>
  );
}

export function GarminWorkoutPreview({ garminWorkout }: GarminWorkoutPreviewProps) {
  const segment = garminWorkout.segments[0];
  if (!segment) return null;

  const totals = computeTotals(segment.steps);
  const sportColor = SPORT_COLORS[garminWorkout.sport];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${sportColor.bg} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
            {garminWorkout.sport === 'RUNNING' && (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 -960 960 960">
                <path d="M520-40v-240l-84-80-40 176-276-56 16-80 192 40 64-324-72 28v136h-80v-188l158-68q35-15 51.5-19.5T480-720q21 0 39 11t29 29l40 64q26 42 70.5 69T760-520v80q-66 0-123.5-27.5T540-540l-24 120 84 80v300h-80Zm-36.5-723.5Q460-787 460-820t23.5-56.5Q507-900 540-900t56.5 23.5Q620-853 620-820t-23.5 56.5Q573-740 540-740t-56.5-23.5Z"/>
              </svg>
            )}
            {garminWorkout.sport === 'CYCLING' && (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 -960 960 960">
                <path d="M200-80q-83 0-141.5-58.5T0-280q0-83 58.5-141.5T200-480q83 0 141.5 58.5T400-280q0 83-58.5 141.5T200-80Zm85-115q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Zm155-5v-200L312-512q-12-11-18-25.5t-6-30.5q0-16 6.5-30.5T312-624l112-112q12-12 27.5-18t32.5-6q17 0 32.5 6t27.5 18l76 76q28 28 64 44t76 16v80q-57 0-108.5-22T560-604l-32-32-96 96 88 92v248h-80Zm123.5-563.5Q540-787 540-820t23.5-56.5Q587-900 620-900t56.5 23.5Q700-853 700-820t-23.5 56.5Q653-740 620-740t-56.5-23.5ZM760-80q-83 0-141.5-58.5T560-280q0-83 58.5-141.5T760-480q83 0 141.5 58.5T960-280q0 83-58.5 141.5T760-80Zm85-115q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Z"/>
              </svg>
            )}
            {garminWorkout.sport === 'LAP_SWIMMING' && (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 -960 960 960">
                <path d="M80-120v-80q38 0 57-20t75-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 75 20t57 20v80q-59 0-77.5-20T748-160q-36 0-57 20t-77 20q-56 0-77-20t-57-20q-36 0-57 20t-77 20q-56 0-77-20t-57-20q-36 0-54.5 20T80-120Zm0-180v-80q38 0 57-20t75-20q56 0 77.5 20t56.5 20q36 0 57-20t77-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 75 20t57 20v80q-59 0-77.5-20T748-340q-36 0-55.5 20T614-300q-57 0-77.5-20T480-340q-38 0-56.5 20T346-300q-59 0-78.5-20T212-340q-36 0-54.5 20T80-300Zm196-204 133-133-40-40q-33-33-70-48t-91-15v-100q75 0 124 16.5t96 63.5l256 256q-17 11-33 17.5t-37 6.5q-36 0-57-20t-77-20q-56 0-77 20t-57 20q-21 0-37-6.5T276-504Zm463-306.5q29 29.5 29 70.5 0 42-29 71t-71 29q-42 0-71-29t-29-71q0-41 29-70.5t71-29.5q42 0 71 29.5Z"/>
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-white text-lg truncate">
              {garminWorkout.workoutName}
            </h3>
            <p className={`text-sm ${sportColor.text}`}>{SPORT_LABELS[garminWorkout.sport]}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          {totals.time > 0 && (
            <span className="text-gray-300">
              <span className="text-gray-500">Temps estimé</span>{' '}
              <span className="font-medium text-white">{formatDuration(totals.time)}</span>
            </span>
          )}
          {totals.distance > 0 && (
            <span className="text-gray-300">
              <span className="text-gray-500">Distance estimée</span>{' '}
              <span className="font-medium text-white">{formatDistance(totals.distance)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Notes */}
        {garminWorkout.description && garminWorkout.description !== 'Created with Enduzo' && (
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">Notes</h4>
            <p className="text-sm text-gray-300 whitespace-pre-line">{garminWorkout.description}</p>
          </div>
        )}

        {/* Timeline */}
        <Timeline steps={segment.steps} sport={garminWorkout.sport} />

        {/* Steps list */}
        <div className="space-y-3">
          {segment.steps.map((step, idx) =>
            step.type === 'WorkoutRepeatStep' ? (
              <RepeatBlock key={`block-${idx}`} step={step} sport={garminWorkout.sport} />
            ) : (
              <StepCard key={`step-${idx}`} step={step} sport={garminWorkout.sport} />
            )
          )}
        </div>
      </div>
    </div>
  );
}
