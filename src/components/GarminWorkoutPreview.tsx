import { GarminStep, GarminWorkout, GarminSport } from '../lib/garmin-format';

interface GarminWorkoutPreviewProps {
  garminWorkout: GarminWorkout;
}

const SPORT_LABELS: Record<GarminSport, string> = {
  RUNNING: 'Course à pied',
  CYCLING: 'Vélo',
  LAP_SWIMMING: 'Natation',
};

const INTENSITY_COLORS: Record<string, string> = {
  WARMUP: 'bg-orange-100 border-orange-300 text-orange-800',
  ACTIVE: 'bg-blue-100 border-blue-300 text-blue-800',
  RECOVERY: 'bg-green-100 border-green-300 text-green-800',
  COOLDOWN: 'bg-purple-100 border-purple-300 text-purple-800',
  REST: 'bg-gray-100 border-gray-300 text-gray-800',
  INTERVAL: 'bg-slate-100 border-slate-300 text-slate-800',
};

const INTENSITY_LABELS: Record<string, string> = {
  WARMUP: 'Échauffement',
  ACTIVE: 'Actif',
  RECOVERY: 'Récupération',
  COOLDOWN: 'Retour au calme',
  REST: 'Repos',
  INTERVAL: 'Intervalle',
};

function formatDuration(step: GarminStep): string {
  if (step.durationType === 'OPEN') return 'Lap';
  if (step.durationType === 'TIME' && step.durationValue) {
    const minutes = Math.floor(step.durationValue / 60);
    const seconds = step.durationValue % 60;
    if (minutes > 0 && seconds > 0) return `${minutes}'${seconds.toString().padStart(2, '0')}"`;
    if (minutes > 0) return `${minutes} min`;
    return `${seconds} s`;
  }
  if (step.durationType === 'DISTANCE' && step.durationValue) {
    if (step.durationValue >= 1000) return `${(step.durationValue / 1000).toFixed(2)} km`;
    return `${step.durationValue} m`;
  }
  return 'Lap';
}

function formatPace(minPerKm: number): string {
  const mins = Math.floor(minPerKm);
  const secs = Math.round((minPerKm - mins) * 60);
  return `${mins}'${secs.toString().padStart(2, '0')}/km`;
}

function formatTarget(step: GarminStep): string | null {
  if (step.targetType === 'PACE' && (step.targetValueLow || step.targetValueHigh)) {
    const low = step.targetValueHigh ? formatPace(1000 / (step.targetValueHigh * 60) / 60) : null;
    const high = step.targetValueLow ? formatPace(1000 / (step.targetValueLow * 60) / 60) : null;
    if (low && high && low !== high) return `${low} - ${high}`;
    return low || high || null;
  }

  if (step.targetType === 'POWER') {
    if (step.targetValueType === 'PERCENT' && (step.targetValueLow || step.targetValueHigh)) {
      return `${step.targetValueLow ?? ''}-${step.targetValueHigh ?? ''}% FTP`;
    }
    if (step.targetValueLow !== null || step.targetValueHigh !== null) {
      return `${step.targetValueLow ?? ''}-${step.targetValueHigh ?? ''} W`;
    }
  }

  if (step.targetType === 'CADENCE' && (step.targetValueLow || step.targetValueHigh)) {
    return `${step.targetValueLow ?? ''}-${step.targetValueHigh ?? ''} rpm`;
  }

  return null;
}

function formatSecondaryTarget(step: GarminStep): string | null {
  if (step.secondaryTargetType === 'CADENCE' && (step.secondaryTargetValueLow || step.secondaryTargetValueHigh)) {
    return `${step.secondaryTargetValueLow ?? ''}-${step.secondaryTargetValueHigh ?? ''} rpm`;
  }

  if (step.secondaryTargetType === 'PACE_ZONE' && (step.secondaryTargetValueLow || step.secondaryTargetValueHigh)) {
    const low = step.secondaryTargetValueHigh ? formatPace(100 / (step.secondaryTargetValueHigh * 60) / 60) : null;
    const high = step.secondaryTargetValueLow ? formatPace(100 / (step.secondaryTargetValueLow * 60) / 60) : null;
    if (low && high && low !== high) return `${low} - ${high}/100m`;
    return low || high || null;
  }

  if (step.secondaryTargetType === 'SWIM_INSTRUCTION' && step.secondaryTargetValueLow) {
    const map: Record<number, string> = {
      1: 'Récup',
      3: 'Facile',
      4: 'Modéré',
      5: 'Difficile',
      6: 'Très difficile',
      7: 'Max',
    };
    return map[step.secondaryTargetValueLow] || null;
  }

  return null;
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
      if (step.durationType === 'TIME' && step.durationValue) acc.time += step.durationValue;
      if (step.durationType === 'DISTANCE' && step.durationValue) acc.distance += step.durationValue;
      return acc;
    },
    { time: 0, distance: 0 }
  );
}

function StepRow({ step, showIndex, index }: { step: GarminStep; showIndex?: boolean; index?: number }) {
  const target = formatTarget(step);
  const secondary = formatSecondaryTarget(step);
  const colorClass = INTENSITY_COLORS[step.intensity || 'ACTIVE'] || INTENSITY_COLORS.ACTIVE;

  return (
    <div className={`p-3 rounded border ${colorClass}`}>
      <div className="flex items-center gap-3">
        {showIndex && (
          <span className="text-xs font-mono w-6 text-center opacity-60">{index}</span>
        )}
        <div className="flex-1">
          <div className="font-medium">{step.description || INTENSITY_LABELS[step.intensity || 'ACTIVE']}</div>
          {step.strokeType && (
            <div className="text-xs opacity-80 mt-0.5">{step.strokeType}{step.equipmentType ? ` • ${step.equipmentType}` : ''}</div>
          )}
        </div>
        <span className="text-sm font-mono font-medium">{formatDuration(step)}</span>
      </div>

      {(target || secondary) && (
        <div className={`mt-2 ${showIndex ? 'ml-9' : ''} flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80`}>
          {target && (
            <span><span className="font-medium">Cible:</span> {target}</span>
          )}
          {secondary && (
            <span><span className="font-medium">2e cible:</span> {secondary}</span>
          )}
        </div>
      )}
    </div>
  );
}

function RepeatBlock({ step }: { step: GarminStep }) {
  if (!step.steps) return null;

  return (
    <div className="border-2 border-indigo-300 rounded-lg overflow-hidden">
      <div className="bg-indigo-100 px-3 py-2 flex items-center gap-2">
        <span className="bg-indigo-600 text-white text-sm font-bold px-2 py-0.5 rounded">
          {step.repeatValue}x
        </span>
        <span className="text-indigo-800 text-sm font-medium">
          Répéter {step.repeatValue} fois
        </span>
      </div>
      <div className="p-2 space-y-2 bg-indigo-50/50">
        {step.steps.map((s, idx) => (
          <StepRow key={`${step.repeatValue}-${idx}`} step={s} />
        ))}
      </div>
    </div>
  );
}

export function GarminWorkoutPreview({ garminWorkout }: GarminWorkoutPreviewProps) {
  const segment = garminWorkout.segments[0];
  if (!segment) return null;

  const flatSteps = flattenSteps(segment.steps);
  const totals = computeTotals(segment.steps);

  let stepCounter = 0;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex justify-between items-center flex-wrap gap-2">
          <div>
            <h3 className="font-medium text-gray-900">{garminWorkout.workoutName}</h3>
            <p className="text-xs text-gray-500">{SPORT_LABELS[garminWorkout.sport]}</p>
          </div>
          <div className="text-sm text-gray-600">
            {flatSteps.length} étape{flatSteps.length > 1 ? 's' : ''}
            {totals.time > 0 && <span className="ml-2">• {formatDuration({ durationType: 'TIME', durationValue: totals.time } as GarminStep)}</span>}
            {totals.distance > 0 && <span className="ml-2">• {(totals.distance / 1000).toFixed(2)} km</span>}
          </div>
        </div>
      </div>

      <div className="p-4">
        {/* Timeline visuelle */}
        <div className="flex gap-0.5 mb-4 h-8 rounded overflow-hidden">
          {flatSteps.map((step, idx) => {
            const totalValue = totals.time > 0 ? totals.time : totals.distance;
            const stepValue =
              step.durationType === 'TIME' ? step.durationValue || 0 :
              step.durationType === 'DISTANCE' ? step.durationValue || 0 : 0;
            const widthPercent = totalValue > 0
              ? (stepValue / totalValue) * 100
              : 100 / flatSteps.length;
            const colorKey = step.intensity || 'ACTIVE';
            const baseColor = INTENSITY_COLORS[colorKey]?.split(' ')[0].replace('bg-', '') || 'blue-200';

            return (
              <div
                key={`${step.stepOrder}-${idx}`}
                className={`bg-${baseColor} flex items-center justify-center text-xs font-medium min-w-[4px]`}
                style={{ width: `${Math.max(widthPercent, 1)}%` }}
                title={`${step.description || INTENSITY_LABELS[step.intensity || 'ACTIVE']}: ${formatDuration(step)}`}
              />
            );
          })}
        </div>

        {/* Liste des steps */}
        <div className="space-y-2">
          {segment.steps.map((step, idx) => {
            if (step.type === 'WorkoutRepeatStep') {
              return <RepeatBlock key={`block-${idx}`} step={step} />;
            }
            stepCounter++;
            return (
              <StepRow
                key={`${step.stepOrder}-${idx}`}
                step={step}
                showIndex
                index={stepCounter}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
