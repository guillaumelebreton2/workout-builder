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
  WARMUP: '#EF4444',   // rouge
  ACTIVE: '#3B82F6',   // bleu
  RECOVERY: '#9CA3AF', // gris
  COOLDOWN: '#22C55E', // vert
  REST: '#D1D5DB',     // gris clair
  INTERVAL: '#6B7280', // gris foncé
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

function formatTarget(step: GarminStep): string | null {
  const { targetType, targetValueLow, targetValueHigh, targetValueType } = step;

  if (targetType === 'PACE' && (targetValueLow || targetValueHigh)) {
    const lowMs = targetValueHigh ?? targetValueLow ?? 0;
    const highMs = targetValueLow ?? targetValueHigh ?? 0;
    const lowPace = formatPace(msToMinPerKm(lowMs));
    const highPace = formatPace(msToMinPerKm(highMs));
    const range = lowPace === highPace ? lowPace : `${lowPace} - ${highPace}`;
    return `Allure • ${range} min/km`;
  }

  if (targetType === 'POWER') {
    if (targetValueType === 'PERCENT' && (targetValueLow || targetValueHigh)) {
      const range = targetValueLow === targetValueHigh
        ? `${targetValueLow}%`
        : `${targetValueLow}-${targetValueHigh}%`;
      return `Puissance • ${range} FTP`;
    }
    if (targetValueLow || targetValueHigh) {
      const range = targetValueLow === targetValueHigh
        ? `${targetValueLow} W`
        : `${targetValueLow}-${targetValueHigh} W`;
      return `Puissance • ${range}`;
    }
  }

  if (targetType === 'CADENCE' && (targetValueLow || targetValueHigh)) {
    const range = targetValueLow === targetValueHigh
      ? `${targetValueLow} rpm`
      : `${targetValueLow}-${targetValueHigh} rpm`;
    return `Cadence • ${range}`;
  }

  if (targetType === 'HEART_RATE' && (targetValueLow || targetValueHigh)) {
    const range = targetValueLow === targetValueHigh
      ? `${targetValueLow} bpm`
      : `${targetValueLow}-${targetValueHigh} bpm`;
    return `FC • ${range}`;
  }

  return null;
}

function formatSecondaryTarget(step: GarminStep): string | null {
  const { secondaryTargetType, secondaryTargetValueLow, secondaryTargetValueHigh } = step;

  if (secondaryTargetType === 'CADENCE' && (secondaryTargetValueLow || secondaryTargetValueHigh)) {
    const range = secondaryTargetValueLow === secondaryTargetValueHigh
      ? `${secondaryTargetValueLow} rpm`
      : `${secondaryTargetValueLow}-${secondaryTargetValueHigh} rpm`;
    return `Cadence • ${range}`;
  }

  if (secondaryTargetType === 'PACE_ZONE' && (secondaryTargetValueLow || secondaryTargetValueHigh)) {
    const lowMs = secondaryTargetValueHigh ?? secondaryTargetValueLow ?? 0;
    const highMs = secondaryTargetValueLow ?? secondaryTargetValueHigh ?? 0;
    const lowPace = formatPace(msToMinPerKm(lowMs) / 10);
    const highPace = formatPace(msToMinPerKm(highMs) / 10);
    const range = lowPace === highPace ? lowPace : `${lowPace} - ${highPace}`;
    return `Allure • ${range} /100m`;
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
    return label ? `Intensité • ${label}` : null;
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
  const target = formatTarget(step);
  const secondary = formatSecondaryTarget(step);
  const estTime = estimateTimeSeconds(step);
  const estDistance = estimateDistanceMeters(step);

  const metrics: { value: string; label: string }[] = [];

  if (step.durationType === 'TIME' && step.durationValue) {
    metrics.push({ value: formatDuration(step.durationValue), label: 'Temps total' });
    if (estDistance !== null) {
      metrics.push({ value: formatDistance(estDistance), label: 'Distance estimée' });
    }
  } else if (step.durationType === 'DISTANCE' && step.durationValue) {
    metrics.push({ value: formatDistance(step.durationValue), label: 'Distance totale' });
    if (estTime !== null) {
      metrics.push({ value: formatDuration(estTime), label: 'Temps estimé' });
    }
  }

  if (target) metrics.push({ value: target, label: "Objectif d'intensité" });
  if (secondary) metrics.push({ value: secondary, label: '2e cible' });

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      style={{ borderLeftWidth: '8px', borderLeftColor: color }}
    >
      <div className="p-4">
        <div className="min-w-0">
          <div className="font-semibold text-gray-900 text-base leading-tight">
            {getStepLabel(step, sport)}
          </div>
          <div className="text-gray-500 text-sm mt-0.5">
            {getStepDurationLabel(step)}
          </div>
        </div>

        {metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mt-3">
            {metrics.map((m, idx) => (
              <div key={idx}>
                <div className="text-gray-900 font-medium text-sm leading-tight">{m.value}</div>
                <div className="text-xs text-gray-500 mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {step.description && (
        <div className="px-4 pb-3 pt-0">
          <div className="border-t border-gray-100 pt-2 text-sm text-gray-600 italic">
            {step.description}
          </div>
        </div>
      )}
    </div>
  );
}

function RepeatBlock({ step, sport, depth = 0 }: { step: GarminStep; sport: GarminSport; depth?: number }) {
  if (!step.steps || step.steps.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-gray-200 overflow-hidden"
      style={{ backgroundColor: depth % 2 === 0 ? '#F3F4F6' : '#E5E7EB' }}
    >
      <div className="px-4 py-2 flex items-center gap-2 text-gray-900 font-semibold">
        <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            <RepeatBlock key={`nested-${idx}`} step={s} sport={sport} depth={depth + 1} />
          ) : (
            <StepCard key={`step-${idx}`} step={s} sport={sport} />
          )
        )}
      </div>
      <div className="px-4 pb-3 text-xs text-gray-500">
        Ignorer la dernière récupération : Désactivé
      </div>
    </div>
  );
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
    <div className="flex items-end gap-1 h-24 bg-gray-50 rounded-xl p-3">
      {flat.map((step, idx) => {
        const stepValue =
          (step.durationType === 'TIME' || step.durationType === 'DISTANCE') && step.durationValue
            ? step.durationValue
            : 0;
        const widthPercent = totalValue > 0 ? (stepValue / totalValue) * 100 : 100 / flat.length;
        const color = INTENSITY_COLORS[step.intensity || 'ACTIVE'] || INTENSITY_COLORS.ACTIVE;

        return (
          <div
            key={`timeline-${idx}`}
            className="rounded-md min-w-[4px] h-full transition-all hover:opacity-80"
            style={{
              width: `${Math.max(widthPercent, 0.5)}%`,
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

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#007CC3] flex items-center justify-center text-white font-bold text-sm shrink-0">
            {garminWorkout.sport === 'RUNNING' && (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M13.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM9.8 8.9L7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3C14.8 12 16.8 13 19 13v-2c-1.9 0-3.5-1-4.3-2.4l-1-1.6c-.4-.6-1-1-1.7-1-.3 0-.5.1-.8.1L6 8.3V13h2V9.6l1.8-.7z"/>
              </svg>
            )}
            {garminWorkout.sport === 'CYCLING' && (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M15.5 5.5c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zM5 12c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5zm5.8-2.5l1.5-2.6c.3-.5.1-1.1-.4-1.4-.5-.3-1.1-.1-1.4.4L8.6 18c-.5.2-.8.8-.6 1.3.2.6.8.9 1.4.7h-.6zm9.2-6c-2.8 0-5 2.2-5 5s2.2 5 5 5 5-2.2 5-5-2.2-5-5-5zm0 8.5c-1.9 0-3.5-1.6-3.5-3.5s1.6-3.5 3.5-3.5 3.5 1.6 3.5 3.5-1.6 3.5-3.5 3.5z"/>
              </svg>
            )}
            {garminWorkout.sport === 'LAP_SWIMMING' && (
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M2 15c1.6-1 3.1-1.6 4.7-1.6 1.8 0 3.3.8 4.5 1.5 1.1.7 2.2 1.1 3.4 1.1 1.7 0 3.3-.8 4.6-1.5l.3-.2c.4-.3.8-.5 1.3-.6.5-.2 1-.2 1.5-.2 1 0 2 .3 2.7.8V12c-.9-.6-2-1-3.3-1-1.1 0-2.1.3-3.1.9l-.3.2c-1 .6-2.1 1.1-3.4 1.1-1.2 0-2.3-.4-3.4-1.1C10.6 11.4 9.1 10.6 7.3 10.6c-1.8 0-3.3.8-4.7 1.6v2.8zm0 4c1.6-1 3.1-1.6 4.7-1.6 1.8 0 3.3.8 4.5 1.5 1.1.7 2.2 1.1 3.4 1.1 1.7 0 3.3-.8 4.6-1.5l.3-.2c.4-.3.8-.5 1.3-.6.5-.2 1-.2 1.5-.2 1 0 2 .3 2.7.8V16c-.9-.6-2-1-3.3-1-1.1 0-2.1.3-3.1.9l-.3.2c-1 .6-2.1 1.1-3.4 1.1-1.2 0-2.3-.4-3.4-1.1-1.2-.7-2.7-1.5-4.5-1.5-1.8 0-3.3.8-4.7 1.6v2.8z"/>
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 text-lg truncate">
              {garminWorkout.workoutName}
            </h3>
            <p className="text-sm text-gray-500">{SPORT_LABELS[garminWorkout.sport]}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 mt-3 text-sm">
          {totals.time > 0 && (
            <span className="text-gray-700">
              <span className="text-gray-400">Temps estimé</span>{' '}
              <span className="font-medium">{formatDuration(totals.time)}</span>
            </span>
          )}
          {totals.distance > 0 && (
            <span className="text-gray-700">
              <span className="text-gray-400">Distance estimée</span>{' '}
              <span className="font-medium">{formatDistance(totals.distance)}</span>
            </span>
          )}
        </div>
      </div>

      <div className="p-5 space-y-5">
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
