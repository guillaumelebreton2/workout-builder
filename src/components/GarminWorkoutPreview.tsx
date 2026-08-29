import { useState, useEffect } from 'react';
import { GarminStep, GarminWorkout, GarminIntensity, GarminSport, GarminDurationType, GarminTargetType } from '../lib/garmin-format';

interface GarminWorkoutPreviewProps {
  garminWorkout: GarminWorkout;
  onChange?: (workout: GarminWorkout) => void;
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

function createEmptyStep(): GarminStep {
  return {
    type: 'WorkoutStep',
    stepOrder: 1,
    intensity: 'ACTIVE',
    description: null,
    durationType: 'OPEN',
    durationValue: null,
    durationValueType: null,
    targetType: 'OPEN',
    targetValue: null,
    targetValueLow: null,
    targetValueHigh: null,
    targetValueType: null,
    secondaryTargetType: null,
    secondaryTargetValue: null,
    secondaryTargetValueLow: null,
    secondaryTargetValueHigh: null,
    secondaryTargetValueType: null,
    strokeType: null,
    drillType: null,
    equipmentType: null,
    exerciseCategory: null,
    exerciseName: null,
    weightValue: null,
    weightDisplayUnit: null,
  };
}

function createEmptyRepeat(): GarminStep {
  return {
    type: 'WorkoutRepeatStep',
    stepOrder: 1,
    intensity: null,
    description: null,
    durationType: 'OPEN',
    durationValue: null,
    durationValueType: null,
    targetType: null,
    targetValue: null,
    targetValueLow: null,
    targetValueHigh: null,
    targetValueType: null,
    secondaryTargetType: null,
    secondaryTargetValue: null,
    secondaryTargetValueLow: null,
    secondaryTargetValueHigh: null,
    secondaryTargetValueType: null,
    strokeType: null,
    drillType: null,
    equipmentType: null,
    exerciseCategory: null,
    exerciseName: null,
    weightValue: null,
    weightDisplayUnit: null,
    repeatType: 'REPEAT_UNTIL_STEPS_CMPLT',
    repeatValue: 2,
    skipLastRestStep: false,
    steps: [createEmptyStep(), createEmptyStep()],
  };
}

function reorderSteps(steps: GarminStep[]): GarminStep[] {
  return steps.map((step, idx) => ({
    ...step,
    stepOrder: idx + 1,
    steps: step.steps ? reorderSteps(step.steps) : undefined,
  }));
}

function reorderSegmentSteps(segments: GarminWorkout['segments']): GarminWorkout['segments'] {
  return segments.map(seg => ({
    ...seg,
    steps: reorderSteps(seg.steps),
  }));
}

// PATH helpers

function updateStepsAtPath(steps: GarminStep[], path: number[], updates: Partial<GarminStep>): GarminStep[] {
  const [index, ...rest] = path;
  if (index === undefined) return steps;

  const step = steps[index];
  if (!step) return steps;

  if (rest.length === 0) {
    return [
      ...steps.slice(0, index),
      { ...step, ...updates },
      ...steps.slice(index + 1),
    ];
  }

  if (!step.steps) return steps;

  return [
    ...steps.slice(0, index),
    { ...step, steps: updateStepsAtPath(step.steps, rest, updates) },
    ...steps.slice(index + 1),
  ];
}

function insertStepAtPath(steps: GarminStep[], path: number[], newStep: GarminStep, position: 'before' | 'after'): GarminStep[] {
  if (path.length === 0) return steps;

  const [index, ...rest] = path;
  if (rest.length === 0) {
    const insertIndex = position === 'before' ? index : index + 1;
    return [...steps.slice(0, insertIndex), newStep, ...steps.slice(insertIndex)];
  }

  const step = steps[index];
  if (!step || !step.steps) return steps;

  return [
    ...steps.slice(0, index),
    { ...step, steps: insertStepAtPath(step.steps, rest, newStep, position) },
    ...steps.slice(index + 1),
  ];
}

function deleteStepAtPath(steps: GarminStep[], path: number[]): GarminStep[] {
  if (path.length === 0) return steps;

  const [index, ...rest] = path;
  if (rest.length === 0) {
    return [...steps.slice(0, index), ...steps.slice(index + 1)];
  }

  const step = steps[index];
  if (!step || !step.steps) return steps;

  return [
    ...steps.slice(0, index),
    { ...step, steps: deleteStepAtPath(step.steps, rest) },
    ...steps.slice(index + 1),
  ];
}

function duplicateStepAtPath(steps: GarminStep[], path: number[]): GarminStep[] {
  if (path.length === 0) return steps;

  const [index, ...rest] = path;
  if (rest.length === 0) {
    const step = steps[index];
    if (!step) return steps;
    const copy = JSON.parse(JSON.stringify(step));
    return [...steps.slice(0, index + 1), copy, ...steps.slice(index + 1)];
  }

  const step = steps[index];
  if (!step || !step.steps) return steps;

  return [
    ...steps.slice(0, index),
    { ...step, steps: duplicateStepAtPath(step.steps, rest) },
    ...steps.slice(index + 1),
  ];
}

// Inputs

function parsePaceToMs(input: string): number | null {
  const match = input.match(/^(\d+)[:'′](\d+)$/);
  if (match) {
    const min = parseInt(match[1], 10);
    const sec = parseInt(match[2], 10);
    return 1000 / ((min + sec / 60) * 60);
  }
  const decimal = parseFloat(input);
  if (!isNaN(decimal) && decimal > 0) {
    return 1000 / (decimal * 60);
  }
  return null;
}

function formatMsAsPace(ms: number): string {
  return formatPace(msToMinPerKm(ms));
}

function secondsToHms(totalSeconds: number): { h: string; m: string; s: string } {
  const sec = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return { h: h.toString(), m: m.toString().padStart(2, '0'), s: s.toString().padStart(2, '0') };
}

function hmsToSeconds(h: string, m: string, s: string): number | null {
  const hours = parseInt(h, 10) || 0;
  const mins = parseInt(m, 10) || 0;
  const secs = parseInt(s, 10) || 0;
  const total = hours * 3600 + mins * 60 + secs;
  return total > 0 ? total : null;
}

function DurationInput({ value, onChange }: { value: number | null; onChange: (seconds: number | null) => void }) {
  const initial = secondsToHms(value ?? 0);
  const [h, setH] = useState(value ? initial.h : '');
  const [m, setM] = useState(value ? initial.m : '');
  const [s, setS] = useState(value ? initial.s : '');

  const handleChange = (newH: string, newM: string, newS: string) => {
    const total = hmsToSeconds(newH, newM, newS);
    onChange(total);
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <label className="block text-[10px] text-gray-500 mb-0.5">h</label>
        <input
          type="number"
          min={0}
          value={h}
          onChange={(e) => {
            setH(e.target.value);
            handleChange(e.target.value, m, s);
          }}
          className="w-full text-sm bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white"
        />
      </div>
      <div className="flex-1">
        <label className="block text-[10px] text-gray-500 mb-0.5">min</label>
        <input
          type="number"
          min={0}
          max={59}
          value={m}
          onChange={(e) => {
            setM(e.target.value);
            handleChange(h, e.target.value, s);
          }}
          className="w-full text-sm bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white"
        />
      </div>
      <div className="flex-1">
        <label className="block text-[10px] text-gray-500 mb-0.5">s</label>
        <input
          type="number"
          min={0}
          max={59}
          value={s}
          onChange={(e) => {
            setS(e.target.value);
            handleChange(h, m, e.target.value);
          }}
          className="w-full text-sm bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white"
        />
      </div>
    </div>
  );
}

interface StepCardProps {
  step: GarminStep;
  sport: GarminSport;
  path: number[];
  editable: boolean;
  onUpdate: (segmentIndex: number, path: number[], updates: Partial<GarminStep>) => void;
  onAdd: (path: number[], position: 'before' | 'after') => void;
  onDuplicate: (path: number[]) => void;
  onDelete: (path: number[]) => void;
}

function StepCard({ step, sport, path, editable, onUpdate, onAdd, onDuplicate, onDelete }: StepCardProps) {
  const segmentIndex = 0;
  const color = INTENSITY_COLORS[step.intensity || 'ACTIVE'] || INTENSITY_COLORS.ACTIVE;
  const bgColor = INTENSITY_BG_COLORS[step.intensity || 'ACTIVE'] || INTENSITY_BG_COLORS.ACTIVE;
  const target = formatTarget(step);
  const secondary = formatSecondaryTarget(step);
  const estTime = estimateTimeSeconds(step);
  const estDistance = estimateDistanceMeters(step);

  const update = (updates: Partial<GarminStep>) => onUpdate(segmentIndex, path, updates);

  const handleTargetLowChange = (value: string) => {
    let ms: number | null = null;
    if (step.targetType === 'PACE') {
      ms = parsePaceToMs(value);
    } else {
      ms = value === '' ? null : parseFloat(value);
    }
    update({ targetValueLow: ms });
  };

  const handleTargetHighChange = (value: string) => {
    let ms: number | null = null;
    if (step.targetType === 'PACE') {
      ms = parsePaceToMs(value);
    } else {
      ms = value === '' ? null : parseFloat(value);
    }
    update({ targetValueHigh: ms });
  };

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
  } else if (step.durationType === 'OPEN') {
    primaryMetrics.push({ value: 'Appui sur touche Lap', label: 'Changement d\'étape' });
  }

  return (
    <div
      className={`${bgColor} rounded-xl overflow-hidden`}
      style={{ borderLeftWidth: '6px', borderLeftColor: color }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="font-semibold text-white text-base leading-tight">
            {getStepLabel(step, sport)}
          </div>
          {editable && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onAdd(path, 'before')}
                title="Ajouter avant"
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6"/></svg>
              </button>
              <button
                type="button"
                onClick={() => onDuplicate(path)}
                title="Dupliquer"
                className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
              </button>
              <button
                type="button"
                onClick={() => onDelete(path)}
                title="Supprimer"
                className="p-1 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          )}
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

        {editable && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Intensité</label>
                <select
                  value={step.intensity || 'ACTIVE'}
                  onChange={(e) => update({ intensity: e.target.value as GarminIntensity })}
                  className="w-full text-sm bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white"
                >
                  {(['WARMUP', 'ACTIVE', 'RECOVERY', 'COOLDOWN', 'REST', 'INTERVAL'] as GarminIntensity[]).map(i => (
                    <option key={i} value={i}>{INTENSITY_LABELS[i]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Type durée</label>
                <select
                  value={step.durationType}
                  onChange={(e) => update({
                    durationType: e.target.value as GarminDurationType,
                    durationValue: e.target.value === 'OPEN' ? null : step.durationValue,
                    durationValueType: e.target.value === 'DISTANCE' ? 'METER' : null,
                  })}
                  className="w-full text-sm bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white"
                >
                  <option value="OPEN">Appui Lap</option>
                  <option value="TIME">Temps</option>
                  <option value="DISTANCE">Distance</option>
                </select>
              </div>
            </div>

            {step.durationType === 'TIME' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Durée</label>
                <DurationInput
                  key={step.durationValue ?? 'empty'}
                  value={step.durationValue}
                  onChange={(seconds) => update({ durationValue: seconds })}
                />
              </div>
            )}

            {step.durationType === 'DISTANCE' && (
              <div>
                <label className="block text-xs text-gray-400 mb-1">Distance (mètres)</label>
                <input
                  type="number"
                  min={0}
                  value={step.durationValue ?? ''}
                  onChange={(e) => update({
                    durationValue: e.target.value === '' ? null : parseFloat(e.target.value),
                    durationValueType: 'METER',
                  })}
                  className="w-full text-sm bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-xs text-gray-400 mb-1">Objectif principal</label>
              <select
                value={step.targetType || 'OPEN'}
                onChange={(e) => update({
                  targetType: e.target.value === 'OPEN' ? 'OPEN' : e.target.value as Exclude<GarminTargetType, null>,
                  targetValueLow: null,
                  targetValueHigh: null,
                })}
                className="w-full text-sm bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white"
              >
                <option value="OPEN">Aucun</option>
                <option value="PACE">Allure</option>
                <option value="POWER">Puissance</option>
                <option value="CADENCE">Cadence</option>
                <option value="HEART_RATE">FC</option>
              </select>
            </div>

            {step.targetType && step.targetType !== 'OPEN' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {step.targetType === 'PACE' ? 'Allure min (min/km)' : 'Valeur basse'}
                  </label>
                  <input
                    type="text"
                    value={step.targetValueLow ? (step.targetType === 'PACE' ? formatMsAsPace(step.targetValueLow) : step.targetValueLow) : ''}
                    onChange={(e) => handleTargetLowChange(e.target.value)}
                    className="w-full text-sm bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    {step.targetType === 'PACE' ? 'Allure max (min/km)' : 'Valeur haute'}
                  </label>
                  <input
                    type="text"
                    value={step.targetValueHigh ? (step.targetType === 'PACE' ? formatMsAsPace(step.targetValueHigh) : step.targetValueHigh) : ''}
                    onChange={(e) => handleTargetHighChange(e.target.value)}
                    className="w-full text-sm bg-gray-900 border border-gray-600 rounded px-2 py-1.5 text-white"
                  />
                </div>
              </div>
            )}
          </div>
        )}
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

interface RepeatBlockProps {
  step: GarminStep;
  sport: GarminSport;
  path: number[];
  editable: boolean;
  onUpdate: (segmentIndex: number, path: number[], updates: Partial<GarminStep>) => void;
  onAdd: (path: number[], position: 'before' | 'after') => void;
  onDuplicate: (path: number[]) => void;
  onDelete: (path: number[]) => void;
}

function RepeatBlock({ step, sport, path, editable, onUpdate, onAdd, onDuplicate, onDelete }: RepeatBlockProps) {
  if (!step.steps || step.steps.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-600 overflow-hidden">
      <div className="px-4 py-2 flex items-center justify-between gap-2 text-white font-semibold bg-gray-800/50">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          {editable ? (
            <input
              type="number"
              min={1}
              value={step.repeatValue ?? 1}
              onChange={(e) => onUpdate(0, path, { repeatValue: parseInt(e.target.value, 10) || 1 })}
              className="w-16 text-sm bg-gray-900 border border-gray-600 rounded px-2 py-1 text-white"
            />
          ) : (
            <span>{step.repeatValue} fois</span>
          )}
        </div>
        {editable && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onAdd(path, 'before')}
              title="Ajouter avant"
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m6-6H6"/></svg>
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(path)}
              title="Dupliquer"
              className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
            </button>
            <button
              type="button"
              onClick={() => onDelete(path)}
              title="Supprimer"
              className="p-1 text-gray-400 hover:text-red-400 hover:bg-white/10 rounded"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
        )}
      </div>
      <div className="px-3 pb-3 space-y-2">
        {step.steps.map((s, idx) =>
          s.type === 'WorkoutRepeatStep' ? (
            <RepeatBlock key={`nested-${idx}`} step={s} sport={sport} path={[...path, idx]} editable={editable} onUpdate={onUpdate} onAdd={onAdd} onDuplicate={onDuplicate} onDelete={onDelete} />
          ) : (
            <StepCard key={`step-${idx}`} step={s} sport={sport} path={[...path, idx]} editable={editable} onUpdate={onUpdate} onAdd={onAdd} onDuplicate={onDuplicate} onDelete={onDelete} />
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

export function GarminWorkoutPreview({ garminWorkout, onChange }: GarminWorkoutPreviewProps) {
  const [localWorkout, setLocalWorkout] = useState(garminWorkout);
  const [isEditing, setIsEditing] = useState(false);
  const editable = !!onChange;

  useEffect(() => {
    setLocalWorkout(garminWorkout);
  }, [garminWorkout]);

  useEffect(() => {
    if (editable) {
      onChange(localWorkout);
    }
  }, [localWorkout, editable, onChange]);

  const updateWorkout = (updates: Partial<GarminWorkout>) => {
    setLocalWorkout(prev => ({ ...prev, ...updates }));
  };

  const updateStep = (_segmentIndex: number, stepPath: number[], updates: Partial<GarminStep>) => {
    setLocalWorkout(prev => {
      const segments = prev.segments.map((seg, idx) =>
        idx === _segmentIndex
          ? { ...seg, steps: updateStepsAtPath(seg.steps, stepPath, updates) }
          : seg
      );
      return { ...prev, segments: reorderSegmentSteps(segments) };
    });
  };

  const handleAdd = (stepPath: number[], position: 'before' | 'after') => {
    setLocalWorkout(prev => {
      const segments = prev.segments.map((seg, idx) =>
        idx === 0
          ? { ...seg, steps: insertStepAtPath(seg.steps, stepPath, createEmptyStep(), position) }
          : seg
      );
      return { ...prev, segments: reorderSegmentSteps(segments) };
    });
  };

  const handleDuplicate = (stepPath: number[]) => {
    setLocalWorkout(prev => {
      const segments = prev.segments.map((seg, idx) =>
        idx === 0
          ? { ...seg, steps: duplicateStepAtPath(seg.steps, stepPath) }
          : seg
      );
      return { ...prev, segments: reorderSegmentSteps(segments) };
    });
  };

  const handleDelete = (stepPath: number[]) => {
    setLocalWorkout(prev => {
      const segments = prev.segments.map((seg, idx) =>
        idx === 0
          ? { ...seg, steps: deleteStepAtPath(seg.steps, stepPath) }
          : seg
      );
      return { ...prev, segments: reorderSegmentSteps(segments) };
    });
  };

  const handleAddRepeat = () => {
    setLocalWorkout(prev => {
      const segments = prev.segments.map((seg, idx) =>
        idx === 0
          ? { ...seg, steps: [...seg.steps, createEmptyRepeat()] }
          : seg
      );
      return { ...prev, segments: reorderSegmentSteps(segments) };
    });
  };

  const segment = localWorkout.segments[0];
  if (!segment) return null;

  const totals = computeTotals(segment.steps);
  const sportColor = SPORT_COLORS[localWorkout.sport];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-700">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-full ${sportColor.bg} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
              {localWorkout.sport === 'RUNNING' && (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 -960 960 960">
                  <path d="M520-40v-240l-84-80-40 176-276-56 16-80 192 40 64-324-72 28v136h-80v-188l158-68q35-15 51.5-19.5T480-720q21 0 39 11t29 29l40 64q26 42 70.5 69T760-520v80q-66 0-123.5-27.5T540-540l-24 120 84 80v300h-80Zm-36.5-723.5Q460-787 460-820t23.5-56.5Q507-900 540-900t56.5 23.5Q620-853 620-820t-23.5 56.5Q573-740 540-740t-56.5-23.5Z"/>
                </svg>
              )}
              {localWorkout.sport === 'CYCLING' && (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 -960 960 960">
                  <path d="M200-80q-83 0-141.5-58.5T0-280q0-83 58.5-141.5T200-480q83 0 141.5 58.5T400-280q0 83-58.5 141.5T200-80Zm85-115q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Zm155-5v-200L312-512q-12-11-18-25.5t-6-30.5q0-16 6.5-30.5T312-624l112-112q12-12 27.5-18t32.5-6q17 0 32.5 6t27.5 18l76 76q28 28 64 44t76 16v80q-57 0-108.5-22T560-604l-32-32-96 96 88 92v248h-80Zm123.5-563.5Q540-787 540-820t23.5-56.5Q587-900 620-900t56.5 23.5Q700-853 700-820t-23.5 56.5Q653-740 620-740t-56.5-23.5ZM760-80q-83 0-141.5-58.5T560-280q0-83 58.5-141.5T760-480q83 0 141.5 58.5T960-280q0 83-58.5 141.5T760-80Zm85-115q35-35 35-85t-35-85q-35-35-85-35t-85 35q-35 35-35 85t35 85q35 35 85 35t85-35Z"/>
                </svg>
              )}
              {localWorkout.sport === 'LAP_SWIMMING' && (
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 -960 960 960">
                  <path d="M80-120v-80q38 0 57-20t75-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 75 20t57 20v80q-59 0-77.5-20T748-160q-36 0-57 20t-77 20q-56 0-77-20t-57-20q-36 0-57 20t-77 20q-56 0-77-20t-57-20q-36 0-54.5 20T80-120Zm0-180v-80q38 0 57-20t75-20q56 0 77.5 20t56.5 20q36 0 57-20t77-20q56 0 77 20t57 20q36 0 57-20t77-20q56 0 75 20t57 20v80q-59 0-77.5-20T748-340q-36 0-55.5 20T614-300q-57 0-77.5-20T480-340q-38 0-56.5 20T346-300q-59 0-78.5-20T212-340q-36 0-54.5 20T80-300Zm196-204 133-133-40-40q-33-33-70-48t-91-15v-100q75 0 124 16.5t96 63.5l256 256q-17 11-33 17.5t-37 6.5q-36 0-57-20t-77-20q-56 0-77 20t-57 20q-21 0-37-6.5T276-504Zm463-306.5q29 29.5 29 70.5 0 42-29 71t-71 29q-42 0-71-29t-29-71q0-41 29-70.5t71-29.5q42 0 71 29.5Z"/>
                </svg>
              )}
            </div>
            <div className="min-w-0">
              {isEditing ? (
                <input
                  type="text"
                  value={localWorkout.workoutName}
                  onChange={(e) => updateWorkout({ workoutName: e.target.value })}
                  className="w-full font-semibold text-white text-lg bg-transparent border-b border-gray-600 focus:border-blue-500 outline-none truncate"
                />
              ) : (
                <h3 className="font-semibold text-white text-lg truncate">
                  {localWorkout.workoutName}
                </h3>
              )}
              <p className={`text-sm ${sportColor.text}`}>{SPORT_LABELS[localWorkout.sport]}</p>
            </div>
          </div>
          {editable && (
            <button
              type="button"
              onClick={() => setIsEditing(!isEditing)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                isEditing
                  ? 'bg-blue-600 text-white hover:bg-blue-500'
                  : 'bg-gray-800 text-gray-200 border border-gray-600 hover:bg-gray-700'
              }`}
            >
              {isEditing ? 'Terminer' : 'Modifier'}
            </button>
          )}
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
        {(localWorkout.description && localWorkout.description !== 'Created with Enduzo') || isEditing ? (
          <div>
            <h4 className="text-sm font-semibold text-white mb-1">Notes</h4>
            {isEditing ? (
              <textarea
                value={localWorkout.description}
                onChange={(e) => updateWorkout({ description: e.target.value })}
                rows={3}
                className="w-full text-sm bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            ) : (
              <p className="text-sm text-gray-300 whitespace-pre-line">{localWorkout.description}</p>
            )}
          </div>
        ) : null}

        {/* Timeline */}
        <Timeline steps={segment.steps} sport={localWorkout.sport} />

        {/* Steps list */}
        <div className="space-y-3">
          {segment.steps.map((step, idx) =>
            step.type === 'WorkoutRepeatStep' ? (
              <RepeatBlock key={`block-${idx}`} step={step} sport={localWorkout.sport} path={[idx]} editable={isEditing} onUpdate={updateStep} onAdd={handleAdd} onDuplicate={handleDuplicate} onDelete={handleDelete} />
            ) : (
              <StepCard key={`step-${idx}`} step={step} sport={localWorkout.sport} path={[idx]} editable={isEditing} onUpdate={updateStep} onAdd={handleAdd} onDuplicate={handleDuplicate} onDelete={handleDelete} />
            )
          )}
        </div>

        {isEditing && (
          <div className="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              onClick={() => setLocalWorkout(prev => {
                const segments = prev.segments.map((seg, idx) =>
                  idx === 0 ? { ...seg, steps: [...seg.steps, createEmptyStep()] } : seg
                );
                return { ...prev, segments: reorderSegmentSteps(segments) };
              })}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-200 border border-gray-600 hover:bg-gray-700"
            >
              + Étape
            </button>
            <button
              type="button"
              onClick={handleAddRepeat}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-800 text-gray-200 border border-gray-600 hover:bg-gray-700"
            >
              + Répétition
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
