/**
 * Conversion d'un Workout interne vers le format JSON de l'API Garmin Workout v2.
 * Ce module est le miroir frontend de api/garmin/[action].js:convertToGarminFormat.
 * Il doit rester identique au backend pour garantir que la preview = ce qui est envoyé.
 */

import { Workout, WorkoutStep } from './types';

// Types du format Garmin Workout API v2
export type GarminSport = 'RUNNING' | 'CYCLING' | 'LAP_SWIMMING';

export type GarminStepType = 'WorkoutStep' | 'WorkoutRepeatStep';

export type GarminIntensity = 'WARMUP' | 'COOLDOWN' | 'ACTIVE' | 'RECOVERY' | 'REST' | 'INTERVAL';

export type GarminDurationType = 'OPEN' | 'TIME' | 'DISTANCE';

export type GarminTargetType = 'OPEN' | 'PACE' | 'POWER' | 'CADENCE' | 'HEART_RATE' | 'PACE_ZONE' | 'SWIM_INSTRUCTION' | null;

export interface GarminStep {
  type: GarminStepType;
  stepOrder: number;
  intensity?: GarminIntensity | null;
  description?: string | null;
  durationType: GarminDurationType;
  durationValue: number | null;
  durationValueType: 'METER' | null;
  targetType: GarminTargetType;
  targetValue: number | null;
  targetValueLow: number | null;
  targetValueHigh: number | null;
  targetValueType: 'METER' | 'PERCENT' | null;
  secondaryTargetType: GarminTargetType;
  secondaryTargetValue: number | null;
  secondaryTargetValueLow: number | null;
  secondaryTargetValueHigh: number | null;
  secondaryTargetValueType: 'METER' | 'PERCENT' | null;
  strokeType: string | null;
  drillType: string | null;
  equipmentType: string | null;
  exerciseCategory: string | null;
  exerciseName: string | null;
  weightValue: number | null;
  weightDisplayUnit: string | null;
  repeatType?: 'REPEAT_UNTIL_STEPS_CMPLT';
  repeatValue?: number;
  skipLastRestStep?: boolean;
  steps?: GarminStep[];
}

export interface GarminSegment {
  segmentOrder: number;
  sport: GarminSport;
  poolLength: number | null;
  poolLengthUnit: 'METER' | null;
  steps: GarminStep[];
}

export interface GarminWorkout {
  workoutName: string;
  description: string;
  sport: GarminSport;
  workoutProvider: string;
  workoutSourceId: string;
  isSessionTransitionEnabled: boolean;
  poolLength?: number;
  poolLengthUnit?: 'METER';
  segments: GarminSegment[];
}

export interface GarminFormatParams {
  referencePaceMinKm?: number;
  referenceWatts?: number;
  referenceSwimPaceMin100m?: number;
  poolLength?: number;
}

const SPORT_MAP: Record<Workout['sport'], GarminSport> = {
  running: 'RUNNING',
  cycling: 'CYCLING',
  swimming: 'LAP_SWIMMING',
};

const INTENSITY_MAP: Record<WorkoutStep['type'], GarminIntensity> = {
  warmup: 'WARMUP',
  cooldown: 'COOLDOWN',
  active: 'ACTIVE',
  recovery: 'RECOVERY',
  rest: 'REST',
  other: 'INTERVAL',
};

function stepsAreSimilar(a: WorkoutStep, b: WorkoutStep): boolean {
  if (a.type !== b.type) return false;
  if (a.duration?.type !== b.duration?.type) return false;
  if (a.duration?.value !== b.duration?.value) return false;

  if (a.details?.cadence !== b.details?.cadence) return false;
  if (a.details?.powerPercent?.low !== b.details?.powerPercent?.low) return false;
  if (a.details?.powerPercent?.high !== b.details?.powerPercent?.high) return false;
  if (a.details?.watts?.low !== b.details?.watts?.low) return false;
  if (a.details?.watts?.high !== b.details?.watts?.high) return false;

  if (a.details?.swimStroke !== b.details?.swimStroke) return false;
  if (a.details?.swimDrill !== b.details?.swimDrill) return false;
  if (a.details?.swimIntensity !== b.details?.swimIntensity) return false;

  const aEquip = (a.details?.swimEquipment || []).sort().join(',');
  const bEquip = (b.details?.swimEquipment || []).sort().join(',');
  if (aEquip !== bEquip) return false;

  return true;
}

function findRepeatBlock(steps: WorkoutStep[], fromPos = 0) {
  if (steps.length - fromPos < 2) return null;

  let bestResult: {
    startPos: number;
    pattern: WorkoutStep[];
    repetitions: number;
    endPos: number;
    score: number;
  } | null = null;

  for (let startPos = fromPos; startPos < steps.length - 1; startPos++) {
    for (let patternLen = 1; patternLen <= 15; patternLen++) {
      if (startPos + patternLen * 2 > steps.length) continue;

      const pattern = steps.slice(startPos, startPos + patternLen);
      let repetitions = 1;
      let endPos = startPos + patternLen;

      while (endPos + patternLen <= steps.length) {
        const nextBlock = steps.slice(endPos, endPos + patternLen);
        const isMatch = pattern.every((step, idx) => stepsAreSimilar(step, nextBlock[idx]));

        if (isMatch) {
          repetitions++;
          endPos += patternLen;
        } else {
          break;
        }
      }

      if (repetitions >= 2) {
        if (
          !bestResult ||
          startPos < bestResult.startPos ||
          (startPos === bestResult.startPos && repetitions * patternLen > bestResult.score)
        ) {
          bestResult = { startPos, pattern, repetitions, endPos, score: repetitions * patternLen };
        }
      }
    }
  }

  return bestResult;
}

function detectAllRepeatBlocks(steps: WorkoutStep[]) {
  if (steps.length < 2) return null;

  const result: ({ type: 'repeat'; pattern: WorkoutStep[]; repetitions: number } | { type: 'single'; step: WorkoutStep })[] = [];
  let currentPos = 0;

  while (currentPos < steps.length) {
    const block = findRepeatBlock(steps, currentPos);

    if (block && block.startPos === currentPos) {
      result.push({
        type: 'repeat',
        pattern: block.pattern,
        repetitions: block.repetitions,
      });
      currentPos = block.endPos;
    } else if (block) {
      const simpleSteps = steps.slice(currentPos, block.startPos);
      for (const step of simpleSteps) {
        result.push({ type: 'single', step });
      }
      currentPos = block.startPos;
    } else {
      for (let i = currentPos; i < steps.length; i++) {
        result.push({ type: 'single', step: steps[i] });
      }
      break;
    }
  }

  return result.length > 0 ? result : null;
}

function buildGarminStep(step: WorkoutStep, stepOrder: number, sport: GarminSport): GarminStep {
  const intensity = INTENSITY_MAP[step.type] || 'ACTIVE';

  if (step.steps && step.steps.length > 0) {
    const nestedSteps = step.steps.map((s, i) => buildGarminStep(s, i + 1, sport));
    return {
      type: 'WorkoutRepeatStep',
      stepOrder,
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
      repeatValue: step.repetitions || 1,
      skipLastRestStep: false,
      steps: nestedSteps,
    };
  }

  let durationType: GarminDurationType = 'OPEN';
  let durationValue: number | null = null;
  let durationValueType: 'METER' | null = null;

  if (step.duration) {
    switch (step.duration.type) {
      case 'time':
        durationType = 'TIME';
        durationValue = step.duration.value ?? null;
        break;
      case 'distance':
        durationType = 'DISTANCE';
        durationValue = step.duration.value ?? null;
        durationValueType = 'METER';
        break;
      case 'open':
      default:
        durationType = 'OPEN';
        break;
    }
  }

  let targetType: GarminTargetType = 'OPEN';
  let targetValue: number | null = null;
  let targetValueLow: number | null = null;
  let targetValueHigh: number | null = null;
  let targetValueType: 'METER' | 'PERCENT' | null = null;

  const details = step.details || {};

  if (sport === 'RUNNING') {
    if (details.paceMinKm) {
      targetType = 'PACE';
      if (details.paceMinKm.low) {
        targetValueHigh = 1000 / (details.paceMinKm.low * 60);
      }
      if (details.paceMinKm.high) {
        targetValueLow = 1000 / (details.paceMinKm.high * 60);
      }
    }
  } else if (sport === 'CYCLING') {
    if (details.watts) {
      targetType = 'POWER';
      targetValueLow = details.watts.low;
      targetValueHigh = details.watts.high;
    } else if (details.powerPercent) {
      targetType = 'POWER';
      targetValueType = 'PERCENT';
      targetValueLow = details.powerPercent.low;
      targetValueHigh = details.powerPercent.high;
    } else if (details.cadence) {
      targetType = 'CADENCE';
      targetValueLow = details.cadence - 5;
      targetValueHigh = details.cadence + 5;
    }
  }

  const garminStep: GarminStep = {
    type: 'WorkoutStep',
    stepOrder,
    intensity,
    description: step.notes || (step.type === 'other' ? step.name : null),
    durationType,
    durationValue,
    durationValueType,
    targetType: targetType === 'OPEN' ? 'OPEN' : targetType,
    targetValue,
    targetValueLow,
    targetValueHigh,
    targetValueType,
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

  if (sport === 'CYCLING' && details.cadence && (details.watts || details.powerPercent)) {
    garminStep.secondaryTargetType = 'CADENCE';
    garminStep.secondaryTargetValueLow = details.cadence - 5;
    garminStep.secondaryTargetValueHigh = details.cadence + 5;
  }

  if (sport === 'LAP_SWIMMING') {
    garminStep.targetType = null;

    if (details.swimStroke) {
      const strokeMap: Record<string, string> = {
        free: 'FREESTYLE',
        backstroke: 'BACKSTROKE',
        breaststroke: 'BREASTSTROKE',
        butterfly: 'BUTTERFLY',
        fly: 'BUTTERFLY',
        im: 'IM',
        choice: 'CHOICE',
        mixed: 'MIXED',
      };
      garminStep.strokeType = strokeMap[details.swimStroke] || 'FREESTYLE';

      const exerciseNameMap: Record<string, string> = {
        free: 'SWIMMING_FREESTYLE',
        backstroke: 'SWIMMING_BACKSTROKE',
        breaststroke: 'SWIMMING_BREASTSTROKE',
        butterfly: 'SWIMMING_BUTTERFLY',
        fly: 'SWIMMING_BUTTERFLY',
        im: 'SWIMMING_IM',
        mixed: 'SWIMMING_MIXED',
      };
      const exerciseName = exerciseNameMap[details.swimStroke];
      if (exerciseName && details.swimStroke !== 'free') {
        garminStep.exerciseName = exerciseName;
      }
    }

    if (details.swimDrill) {
      const drillMap: Record<string, string> = {
        kick: 'KICK',
        pull: 'PULL',
        drill: 'DRILL',
      };
      garminStep.drillType = drillMap[details.swimDrill] || null;
    }

    if (details.swimEquipment && details.swimEquipment.length > 0) {
      const equipMap: Record<string, string> = {
        fins: 'SWIM_FINS',
        kickboard: 'SWIM_KICKBOARD',
        paddles: 'SWIM_PADDLES',
        pull_buoy: 'SWIM_PULL_BUOY',
        pullBuoy: 'SWIM_PULL_BUOY',
        snorkel: 'SWIM_SNORKEL',
      };
      const equipment = equipMap[details.swimEquipment[0]];
      if (equipment) {
        garminStep.equipmentType = equipment;
      }
    }

    if (details.swimIntensity) {
      const intensityMap: Record<string, number> = {
        recovery: 1,
        easy: 3,
        moderate: 4,
        hard: 5,
        very_hard: 6,
        maximum: 7,
      };
      const instructionTypeId = intensityMap[details.swimIntensity];
      if (instructionTypeId) {
        garminStep.secondaryTargetType = 'SWIM_INSTRUCTION';
        garminStep.secondaryTargetValueLow = instructionTypeId;
      }
    }

    if (details.swimPaceMin100m) {
      garminStep.secondaryTargetType = 'PACE_ZONE';
      if (details.swimPaceMin100m.low) {
        garminStep.secondaryTargetValueHigh = 100 / (details.swimPaceMin100m.low * 60);
      }
      if (details.swimPaceMin100m.high) {
        garminStep.secondaryTargetValueLow = 100 / (details.swimPaceMin100m.high * 60);
      }
    }

    if (details.swimNotes) {
      garminStep.description = garminStep.description
        ? `${garminStep.description} | ${details.swimNotes}`
        : details.swimNotes;
    }

    if (garminStep.intensity === 'RECOVERY') {
      garminStep.intensity = 'COOLDOWN';
    }

    if (garminStep.intensity === 'REST' && durationType === 'TIME') {
      garminStep.durationType = 'FIXED_REST' as GarminDurationType;
    }
  }

  return garminStep;
}

export function convertToGarminFormat(workout: Workout, _params?: GarminFormatParams): GarminWorkout {
  const sport = SPORT_MAP[workout.sport] || 'RUNNING';

  const warmupSteps: WorkoutStep[] = [];
  const mainSteps: WorkoutStep[] = [];
  const cooldownSteps: WorkoutStep[] = [];

  let phase: 'warmup' | 'main' | 'cooldown' = 'warmup';
  for (const step of workout.steps) {
    if (step.type === 'warmup') {
      warmupSteps.push(step);
      phase = 'warmup';
    } else if (step.type === 'cooldown') {
      cooldownSteps.push(step);
      phase = 'cooldown';
    } else {
      if (phase === 'cooldown') {
        cooldownSteps.push(step);
      } else {
        mainSteps.push(step);
        phase = 'main';
      }
    }
  }

  let stepOrder = 0;
  const steps: GarminStep[] = [];

  for (const step of warmupSteps) {
    stepOrder++;
    const garminStep = buildGarminStep(step, stepOrder, sport);
    steps.push(garminStep);
  }

  const blocks = detectAllRepeatBlocks(mainSteps);

  if (blocks) {
    for (const block of blocks) {
      if (block.type === 'repeat') {
        const repeatSteps = block.pattern
          .map((patternStep, idx) => buildGarminStep(patternStep, idx + 1, sport));

        stepOrder++;
        steps.push({
          type: 'WorkoutRepeatStep',
          stepOrder,
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
          repeatValue: block.repetitions,
          skipLastRestStep: false,
          steps: repeatSteps,
        });
      } else {
        stepOrder++;
        const garminStep = buildGarminStep(block.step, stepOrder, sport);
        steps.push(garminStep);
      }
    }
  } else {
    for (const step of mainSteps) {
      stepOrder++;
      const garminStep = buildGarminStep(step, stepOrder, sport);
      steps.push(garminStep);
    }
  }

  for (const step of cooldownSteps) {
    stepOrder++;
    const garminStep = buildGarminStep(step, stepOrder, sport);
    steps.push(garminStep);
  }

  const garminWorkout: GarminWorkout = {
    workoutName: workout.name || 'Enduzo Workout',
    description: workout.description || 'Created with Enduzo',
    sport,
    workoutProvider: 'Enduzo',
    workoutSourceId: 'Enduzo',
    isSessionTransitionEnabled: false,
    segments: [{
      segmentOrder: 1,
      sport,
      poolLength: sport === 'LAP_SWIMMING' ? (_params?.poolLength || 25) : null,
      poolLengthUnit: sport === 'LAP_SWIMMING' ? 'METER' : null,
      steps,
    }],
  };

  if (sport === 'LAP_SWIMMING') {
    garminWorkout.poolLength = _params?.poolLength || 25;
    garminWorkout.poolLengthUnit = 'METER';
  }

  return garminWorkout;
}
