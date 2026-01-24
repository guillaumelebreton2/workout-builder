// Garmin Training API V2 - Sync Workout
// Creates a workout and optionally schedules it for a specific date

import { kv } from '@vercel/kv';

const GARMIN_WORKOUT_API = 'https://apis.garmin.com/workoutportal/workout/v2';
const GARMIN_SCHEDULE_API = 'https://apis.garmin.com/training-api/schedule/';

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    cookies[name] = rest.join('=');
  });
  return cookies;
}

// Get valid access token (refresh if needed)
async function getValidAccessToken(garminUserId) {
  const stored = await kv.get(`garmin_tokens_${garminUserId}`);
  const tokenData = typeof stored === 'string' ? JSON.parse(stored) : stored;

  if (!tokenData) {
    throw new Error('No tokens found. Please reconnect to Garmin.');
  }

  // Check if access token is still valid
  if (tokenData.expires_at && Date.now() < tokenData.expires_at) {
    return tokenData.access_token;
  }

  // Need to refresh
  const clientId = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;

  const tokenResponse = await fetch('https://diauth.garmin.com/di-oauth2-service/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokenData.refresh_token
    }).toString()
  });

  if (!tokenResponse.ok) {
    throw new Error('Token refresh failed. Please reconnect to Garmin.');
  }

  const newTokens = await tokenResponse.json();

  // Update stored tokens
  const updatedTokenData = {
    access_token: newTokens.access_token,
    refresh_token: newTokens.refresh_token,
    expires_at: Date.now() + (newTokens.expires_in - 600) * 1000,
    refresh_token_expires_at: Date.now() + (newTokens.refresh_token_expires_in - 600) * 1000,
    scope: newTokens.scope
  };

  await kv.set(`garmin_tokens_${garminUserId}`, JSON.stringify(updatedTokenData), {
    ex: newTokens.refresh_token_expires_in
  });

  return newTokens.access_token;
}

// Convert internal workout format to Garmin Training API V2 format
function convertToGarminFormat(workout) {
  const sportMap = {
    'running': 'RUNNING',
    'cycling': 'CYCLING',
    'swimming': 'LAP_SWIMMING'
  };

  const sport = sportMap[workout.sport] || 'RUNNING';

  // Build steps
  let stepOrder = 0;
  const steps = [];

  for (const step of workout.steps) {
    stepOrder++;
    const garminStep = buildGarminStep(step, stepOrder, sport, workout);

    if (garminStep) {
      if (garminStep.type === 'WorkoutRepeatStep') {
        // Update stepOrder for nested steps
        garminStep.steps.forEach((s, i) => {
          s.stepOrder = stepOrder + i + 1;
        });
        stepOrder += garminStep.steps.length;
      }
      steps.push(garminStep);
    }
  }

  const garminWorkout = {
    workoutName: workout.name || 'Enduzo Workout',
    description: workout.description || 'Created with Enduzo',
    sport: sport,
    workoutProvider: 'Enduzo',
    workoutSourceId: 'Enduzo',
    isSessionTransitionEnabled: false,
    segments: [{
      segmentOrder: 1,
      sport: sport,
      poolLength: sport === 'LAP_SWIMMING' ? (workout.poolLength || 25) : null,
      poolLengthUnit: sport === 'LAP_SWIMMING' ? 'METER' : null,
      steps: steps
    }]
  };

  // Add pool info at workout level for swimming
  if (sport === 'LAP_SWIMMING') {
    garminWorkout.poolLength = workout.poolLength || 25;
    garminWorkout.poolLengthUnit = 'METER';
  }

  return garminWorkout;
}

function buildGarminStep(step, stepOrder, sport, workout) {
  const intensityMap = {
    'warmup': 'WARMUP',
    'cooldown': 'COOLDOWN',
    'active': 'ACTIVE',
    'recovery': 'RECOVERY',
    'rest': 'REST',
    'interval': 'INTERVAL'
  };

  const intensity = intensityMap[step.type] || 'ACTIVE';

  // Handle repeat steps
  if (step.steps && step.steps.length > 0) {
    const nestedSteps = step.steps.map((s, i) => buildGarminStep(s, i + 1, sport, workout));
    return {
      type: 'WorkoutRepeatStep',
      stepOrder: stepOrder,
      repeatType: 'REPEAT_UNTIL_STEPS_CMPLT',
      repeatValue: step.repetitions || 1,
      steps: nestedSteps.filter(Boolean)
    };
  }

  // Build duration
  let durationType = 'OPEN';
  let durationValue = null;
  let durationValueType = null;

  if (step.duration) {
    switch (step.duration.type) {
      case 'time':
        durationType = 'TIME';
        durationValue = step.duration.value; // seconds
        break;
      case 'distance':
        durationType = 'DISTANCE';
        durationValue = step.duration.value; // meters
        durationValueType = 'METER';
        break;
      case 'lapButton':
      case 'open':
        durationType = 'OPEN';
        break;
    }
  }

  // Build target based on sport
  let targetType = 'OPEN';
  let targetValue = null;
  let targetValueLow = null;
  let targetValueHigh = null;
  let targetValueType = null;

  const details = step.details || {};

  if (sport === 'RUNNING') {
    // Pace target (convert min/km to m/s)
    if (details.paceMinKm) {
      targetType = 'PACE';
      // min/km to m/s: 1000m / (pace * 60s)
      if (details.paceMinKm.low) {
        targetValueHigh = 1000 / (details.paceMinKm.low * 60); // faster pace = higher speed
      }
      if (details.paceMinKm.high) {
        targetValueLow = 1000 / (details.paceMinKm.high * 60); // slower pace = lower speed
      }
    }
  } else if (sport === 'CYCLING') {
    // Power target
    if (details.watts) {
      targetType = 'POWER';
      targetValueLow = details.watts.low;
      targetValueHigh = details.watts.high;
    } else if (details.powerPercent) {
      targetType = 'POWER';
      targetValueType = 'PERCENT';
      targetValueLow = details.powerPercent.low;
      targetValueHigh = details.powerPercent.high;
    }
  }

  // Build the step
  const garminStep = {
    type: 'WorkoutStep',
    stepOrder: stepOrder,
    intensity: intensity,
    description: step.notes || null,
    durationType: durationType,
    durationValue: durationValue,
    durationValueType: durationValueType,
    targetType: targetType === 'OPEN' ? 'OPEN' : targetType,
    targetValue: targetValue,
    targetValueLow: targetValueLow,
    targetValueHigh: targetValueHigh,
    targetValueType: targetValueType,
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
    weightDisplayUnit: null
  };

  // Swimming-specific fields
  if (sport === 'LAP_SWIMMING') {
    garminStep.targetType = null; // Swim doesn't support primary target

    if (details.swimStroke) {
      const strokeMap = {
        'freestyle': 'FREESTYLE',
        'backstroke': 'BACKSTROKE',
        'breaststroke': 'BREASTSTROKE',
        'butterfly': 'BUTTERFLY',
        'im': 'IM',
        'choice': 'CHOICE',
        'mixed': 'MIXED'
      };
      garminStep.strokeType = strokeMap[details.swimStroke] || 'FREESTYLE';
    }

    if (details.swimDrill) {
      const drillMap = {
        'kick': 'KICK',
        'pull': 'PULL',
        'drill': 'BUTTERFLY'
      };
      garminStep.drillType = drillMap[details.swimDrill] || null;
    }

    if (details.swimEquipment) {
      const equipMap = {
        'fins': 'SWIM_FINS',
        'paddles': 'SWIM_PADDLES',
        'pullBuoy': 'SWIM_PULL_BUOY',
        'kickboard': 'SWIM_KICKBOARD',
        'snorkel': 'SWIM_SNORKEL'
      };
      garminStep.equipmentType = equipMap[details.swimEquipment[0]] || 'NONE';
    }

    // Swim intensity as secondary target
    if (details.swimIntensity) {
      const intensityValueMap = {
        'recovery': 1,
        'easy': 3,
        'moderate': 4,
        'hard': 5,
        'veryHard': 6,
        'allOut': 7
      };
      garminStep.secondaryTargetType = 'SWIM_INSTRUCTION';
      garminStep.secondaryTargetValueLow = intensityValueMap[details.swimIntensity] || 4;
    }

    // Swim pace as secondary target (min/100m to m/s)
    if (details.swimPaceMin100m) {
      garminStep.secondaryTargetType = 'PACE_ZONE';
      // min/100m to m/s: 100m / (pace * 60s)
      if (details.swimPaceMin100m.low) {
        garminStep.secondaryTargetValueHigh = 100 / (details.swimPaceMin100m.low * 60);
      }
      if (details.swimPaceMin100m.high) {
        garminStep.secondaryTargetValueLow = 100 / (details.swimPaceMin100m.high * 60);
      }
    }

    // Use FIXED_REST for swim rest steps
    if (intensity === 'REST' && durationType === 'TIME') {
      garminStep.durationType = 'FIXED_REST';
    }
  }

  return garminStep;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { workout, scheduleDate } = req.body;

  if (!workout) {
    return res.status(400).json({ error: 'Workout data is required' });
  }

  // Get garminUserId from session cookie
  const cookies = parseCookies(req.headers.cookie);
  const sessionCookie = cookies.garmin_session;

  if (!sessionCookie) {
    return res.status(401).json({ error: 'Not connected to Garmin. Please connect first.' });
  }

  let session;
  try {
    session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString());
  } catch (e) {
    return res.status(401).json({ error: 'Invalid session. Please reconnect to Garmin.' });
  }

  const { garminUserId } = session;
  if (!garminUserId) {
    return res.status(401).json({ error: 'No Garmin user ID. Please reconnect.' });
  }

  try {
    // Get valid access token
    const accessToken = await getValidAccessToken(garminUserId);

    // Convert workout to Garmin format
    const garminWorkout = convertToGarminFormat(workout);

    console.log('Creating Garmin workout:', JSON.stringify(garminWorkout, null, 2));

    // Create the workout
    const createResponse = await fetch(GARMIN_WORKOUT_API, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(garminWorkout)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Garmin create workout failed:', createResponse.status, errorText);

      if (createResponse.status === 401) {
        return res.status(401).json({ error: 'Session expired. Please reconnect to Garmin.' });
      }
      if (createResponse.status === 412) {
        return res.status(403).json({ error: 'Permission denied. Please grant workout import permission in Garmin Connect.' });
      }
      if (createResponse.status === 429) {
        return res.status(429).json({ error: 'Rate limit exceeded. Please try again later.' });
      }

      return res.status(500).json({ error: 'Failed to create workout', details: errorText });
    }

    const createdWorkout = await createResponse.json();
    console.log('Workout created:', createdWorkout.workoutId);

    let scheduleResult = null;

    // Schedule the workout if a date is provided
    if (scheduleDate && createdWorkout.workoutId) {
      const scheduleResponse = await fetch(GARMIN_SCHEDULE_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workoutId: createdWorkout.workoutId,
          date: scheduleDate // Format: YYYY-MM-DD
        })
      });

      if (scheduleResponse.ok) {
        scheduleResult = await scheduleResponse.json();
        console.log('Workout scheduled:', scheduleResult);
      } else {
        console.warn('Failed to schedule workout:', await scheduleResponse.text());
      }
    }

    res.json({
      success: true,
      message: scheduleResult
        ? 'Workout created and scheduled in Garmin Connect'
        : 'Workout created in Garmin Connect',
      workoutId: createdWorkout.workoutId,
      scheduled: !!scheduleResult,
      scheduleId: scheduleResult?.scheduleId
    });

  } catch (error) {
    console.error('Garmin sync error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
