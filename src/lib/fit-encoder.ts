/**
 * FIT File Encoder pour fichiers workout Garmin
 * Utilise le SDK officiel @garmin/fitsdk
 */

import { Workout, Sport, StepType } from './types';

// Import dynamique du SDK Garmin (ESM)
// @ts-ignore
import { Encoder } from '@garmin/fitsdk/src/index.js';

// Sport types selon FIT Profile
const FIT_SPORT: Record<Sport, number> = {
  running: 1,
  cycling: 2,
  swimming: 5,
};

// Sub-sport types
const FIT_SUB_SPORT: Record<Sport, number> = {
  running: 0,
  cycling: 0,
  swimming: 17, // lap_swimming
};

// Intensity selon FIT Profile
const FIT_INTENSITY: Record<StepType, number> = {
  active: 0,
  rest: 1,
  warmup: 2,
  cooldown: 3,
  recovery: 4,
  other: 0, // Traité comme active dans FIT
};

export function encodeWorkout(workout: Workout): Uint8Array {
  const encoder = new Encoder();

  // FIT epoch: 1989-12-31 00:00:00 UTC
  const fitEpoch = new Date('1989-12-31T00:00:00Z').getTime();
  const timestamp = Math.floor((workout.date.getTime() - fitEpoch) / 1000);

  // File ID message (mesg 0)
  encoder.onMesg(0, {
    type: 5, // workout file
    manufacturer: 1, // Garmin
    product: 1,
    serialNumber: 12345,
    timeCreated: timestamp,
  });

  // Workout message (mesg 26)
  encoder.onMesg(26, {
    sport: FIT_SPORT[workout.sport],
    subSport: FIT_SUB_SPORT[workout.sport],
    numValidSteps: workout.steps.length,
    wktName: workout.name.substring(0, 20),
  });

  // Workout steps (mesg 27)
  workout.steps.forEach((step, index) => {
    const stepData: Record<string, unknown> = {
      messageIndex: index,
      wktStepName: step.name.substring(0, 20),
      intensity: FIT_INTENSITY[step.type],
      targetType: 0, // open
      targetValue: 0,
    };

    // Duration
    if (step.duration.type === 'time' && step.duration.value) {
      stepData.durationType = 0; // time
      stepData.durationValue = step.duration.value * 1000; // ms
    } else if (step.duration.type === 'distance' && step.duration.value) {
      stepData.durationType = 1; // distance
      stepData.durationValue = step.duration.value * 100; // cm
    } else {
      stepData.durationType = 5; // open (lap button)
      stepData.durationValue = 0;
    }

    encoder.onMesg(27, stepData);
  });

  return encoder.close();
}

export function downloadFitFile(workout: Workout): void {
  const data = encodeWorkout(workout);
  // Créer un nouveau Uint8Array pour éviter les problèmes de type SharedArrayBuffer
  const blob = new Blob([new Uint8Array(data)], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${workout.name.replace(/[^a-zA-Z0-9]/g, '_')}.fit`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
