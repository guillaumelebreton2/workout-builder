// Garmin API - Consolidated handler for all Garmin endpoints
// Uses dynamic routing: /api/garmin/[action]

import crypto from 'crypto';
import { kv } from '@vercel/kv';
import {
  createSessionCookie,
  createOrUpdateUser,
  createProviderLookup,
  findUserByProviderId
} from '../lib/auth.js';

const GARMIN_WORKOUT_API = 'https://apis.garmin.com/workoutportal/workout/v2';
const GARMIN_SCHEDULE_API = 'https://apis.garmin.com/training-api/schedule/';

// URLs pour les différents environnements
const DEV_PREVIEW_URL = 'https://workout-builder-garmin-git-dev-workout-builders-projects.vercel.app';

function getBaseUrl() {
  // Production (main branch on Vercel)
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://enduzo.com';
  }
  // Preview (dev branch on Vercel)
  if (process.env.VERCEL_ENV === 'preview') {
    return DEV_PREVIEW_URL;
  }
  // Local development
  return 'http://localhost:3001';
}

function isSecureEnvironment() {
  // Secure cookies for any Vercel deployment (production or preview)
  return process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';
}

// ============= HELPERS =============

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    cookies[name] = rest.join('=');
  });
  return cookies;
}

function generateCodeVerifier() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const length = 64;
  let verifier = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    verifier += chars[randomBytes[i] % chars.length];
  }
  return verifier;
}

function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

function generateState() {
  return crypto.randomBytes(32).toString('base64url');
}

async function getValidAccessToken(garminUserId) {
  const stored = await kv.get(`garmin_tokens_${garminUserId}`);
  const tokenData = typeof stored === 'string' ? JSON.parse(stored) : stored;

  if (!tokenData) {
    throw new Error('No tokens found. Please reconnect to Garmin.');
  }

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

// ============= WORKOUT CONVERSION =============

function convertToGarminFormat(workout) {
  const sportMap = {
    'running': 'RUNNING',
    'cycling': 'CYCLING',
    'swimming': 'LAP_SWIMMING'
  };

  const sport = sportMap[workout.sport] || 'RUNNING';

  let stepOrder = 0;
  const steps = [];

  for (const step of workout.steps) {
    stepOrder++;
    const garminStep = buildGarminStep(step, stepOrder, sport, workout);

    if (garminStep) {
      if (garminStep.type === 'WorkoutRepeatStep') {
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

  let durationType = 'OPEN';
  let durationValue = null;
  let durationValueType = null;

  if (step.duration) {
    switch (step.duration.type) {
      case 'time':
        durationType = 'TIME';
        durationValue = step.duration.value;
        break;
      case 'distance':
        durationType = 'DISTANCE';
        durationValue = step.duration.value;
        durationValueType = 'METER';
        break;
      case 'lapButton':
      case 'open':
        durationType = 'OPEN';
        break;
    }
  }

  let targetType = 'OPEN';
  let targetValue = null;
  let targetValueLow = null;
  let targetValueHigh = null;
  let targetValueType = null;

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
    }
  }

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

  if (sport === 'LAP_SWIMMING') {
    garminStep.targetType = null;

    // Stroke type - valeurs acceptées: FREESTYLE, BACKSTROKE, BREASTSTROKE, BUTTERFLY, IM, MIXED, CHOICE, DRILL
    if (details.swimStroke) {
      const strokeMap = {
        'freestyle': 'FREESTYLE',
        'free': 'FREESTYLE',
        'backstroke': 'BACKSTROKE',
        'breaststroke': 'BREASTSTROKE',
        'butterfly': 'BUTTERFLY',
        'fly': 'BUTTERFLY',
        'im': 'IM',
        'choice': 'CHOICE',
        'mixed': 'MIXED'
      };
      garminStep.strokeType = strokeMap[details.swimStroke] || 'FREESTYLE';

      // Ajouter exerciseName pour les nages non-crawl (brasse, dos, papillon, etc.)
      const exerciseNameMap = {
        'freestyle': 'SWIMMING_FREESTYLE',
        'free': 'SWIMMING_FREESTYLE',
        'backstroke': 'SWIMMING_BACKSTROKE',
        'breaststroke': 'SWIMMING_BREASTSTROKE',
        'butterfly': 'SWIMMING_BUTTERFLY',
        'fly': 'SWIMMING_BUTTERFLY',
        'im': 'SWIMMING_IM',
        'mixed': 'SWIMMING_MIXED'
      };
      const exerciseName = exerciseNameMap[details.swimStroke];
      if (exerciseName && details.swimStroke !== 'freestyle' && details.swimStroke !== 'free') {
        garminStep.exerciseName = exerciseName;
      }
    }

    // Drill type - API V2 utilise des strings simples
    if (details.swimDrill) {
      const drillMap = {
        'kick': 'KICK',
        'pull': 'PULL',
        'drill': 'DRILL'
      };
      garminStep.drillType = drillMap[details.swimDrill] || null;
    }

    // Équipement - valeurs acceptées: SWIM_FINS, SWIM_KICKBOARD, SWIM_PADDLES, SWIM_PULL_BUOY, SWIM_SNORKEL, NONE
    if (details.swimEquipment && details.swimEquipment.length > 0) {
      const equipMap = {
        'fins': 'SWIM_FINS',
        'kickboard': 'SWIM_KICKBOARD',
        'paddles': 'SWIM_PADDLES',
        'pull_buoy': 'SWIM_PULL_BUOY',
        'pullBuoy': 'SWIM_PULL_BUOY',
        'snorkel': 'SWIM_SNORKEL'
      };
      const equipment = equipMap[details.swimEquipment[0]];
      if (equipment) {
        garminStep.equipmentType = equipment;
      }
    }

    // Intensité natation - SWIM_INSTRUCTION en secondaryTarget
    if (details.swimIntensity) {
      const intensityMap = {
        'recovery': 1,
        'easy': 3,
        'moderate': 4,
        'hard': 5,
        'very_hard': 6,
        'maximum': 7
      };
      const instructionTypeId = intensityMap[details.swimIntensity];
      if (instructionTypeId) {
        garminStep.secondaryTargetType = 'SWIM_INSTRUCTION';
        garminStep.secondaryTargetValueLow = instructionTypeId;
      }
    }

    // Allure natation - PACE_ZONE en secondaryTarget (écrase SWIM_INSTRUCTION si les deux sont présents)
    if (details.swimPaceMin100m) {
      garminStep.secondaryTargetType = 'PACE_ZONE';
      if (details.swimPaceMin100m.low) {
        garminStep.secondaryTargetValueHigh = 100 / (details.swimPaceMin100m.low * 60);
      }
      if (details.swimPaceMin100m.high) {
        garminStep.secondaryTargetValueLow = 100 / (details.swimPaceMin100m.high * 60);
      }
    }

    // Notes additionnelles natation (swimNotes)
    if (details.swimNotes) {
      garminStep.description = garminStep.description
        ? `${garminStep.description} | ${details.swimNotes}`
        : details.swimNotes;
    }

    // Pour natation, RECOVERY → COOLDOWN (récupération active)
    if (garminStep.intensity === 'RECOVERY') {
      garminStep.intensity = 'COOLDOWN';
    }

    if (garminStep.intensity === 'REST' && durationType === 'TIME') {
      garminStep.durationType = 'FIXED_REST';
    }
  }

  return garminStep;
}

// ============= ACTION HANDLERS =============

async function handleAuth(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = process.env.GARMIN_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GARMIN_CLIENT_ID not configured' });
  }

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/garmin/callback`;

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const cookieOptions = [
    `garmin_code_verifier=${codeVerifier}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=600',
    isSecureEnvironment() ? 'Secure' : ''
  ].filter(Boolean).join('; ');

  const stateCookieOptions = [
    `garmin_oauth_state=${state}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=600',
    isSecureEnvironment() ? 'Secure' : ''
  ].filter(Boolean).join('; ');

  res.setHeader('Set-Cookie', [cookieOptions, stateCookieOptions]);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    state: state
  });

  const authUrl = `https://connect.garmin.com/oauth2Confirm?${params.toString()}`;
  res.redirect(302, authUrl);
}

async function handleCallback(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('Garmin OAuth error:', error, error_description);
    return res.redirect('/?garmin_error=' + encodeURIComponent(error_description || error));
  }

  if (!code) {
    return res.redirect('/?garmin_error=' + encodeURIComponent('No authorization code received'));
  }

  const cookies = parseCookies(req.headers.cookie);
  const codeVerifier = cookies.garmin_code_verifier;
  const storedState = cookies.garmin_oauth_state;

  if (!codeVerifier) {
    return res.redirect('/?garmin_error=' + encodeURIComponent('Session expired. Please try again.'));
  }

  if (state !== storedState) {
    return res.redirect('/?garmin_error=' + encodeURIComponent('Invalid state. Please try again.'));
  }

  const clientId = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect('/?garmin_error=' + encodeURIComponent('Server configuration error'));
  }

  const baseUrl = getBaseUrl();
  const redirectUri = `${baseUrl}/api/garmin/callback`;

  try {
    const tokenResponse = await fetch('https://diauth.garmin.com/di-oauth2-service/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return res.redirect('/?garmin_error=' + encodeURIComponent('Failed to exchange token'));
    }

    const tokens = await tokenResponse.json();
    console.log('Garmin tokens received:', {
      hasAccessToken: !!tokens.access_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope
    });

    const userResponse = await fetch('https://apis.garmin.com/wellness-api/rest/user/id', {
      headers: { 'Authorization': `Bearer ${tokens.access_token}` }
    });

    let garminUserId = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      garminUserId = userData.userId;
      console.log('Garmin user ID:', garminUserId);
    }

    if (garminUserId && kv) {
      const tokenData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in - 600) * 1000,
        refresh_token_expires_at: Date.now() + (tokens.refresh_token_expires_in - 600) * 1000,
        scope: tokens.scope
      };

      try {
        await kv.set(`garmin_tokens_${garminUserId}`, JSON.stringify(tokenData), {
          ex: tokens.refresh_token_expires_in
        });
      } catch (kvError) {
        console.warn('KV storage not available:', kvError.message);
      }
    }

    // Create or update user in KV
    const userId = `garmin_${garminUserId}`;
    let user;

    try {
      // Check if this Garmin account is already linked to a user
      const existingUser = await findUserByProviderId('garmin', garminUserId);

      if (existingUser) {
        // Update existing user
        user = await createOrUpdateUser({
          ...existingUser
        });
        console.log('Updated existing user:', user.id);
      } else {
        // Create new user
        user = await createOrUpdateUser({
          id: userId,
          authProvider: 'garmin',
          linkedProviders: ['garmin'],
          garminUserId: garminUserId,
          stravaAthleteId: null,
          name: 'Athlete', // Garmin doesn't provide name in basic API
          email: null
        });
        console.log('Created new user:', user.id);

        // Create lookup for future logins
        await createProviderLookup('garmin', garminUserId, userId);
      }
    } catch (userError) {
      console.error('Failed to create/update user:', userError);
      // Create minimal user object for session
      user = {
        id: userId,
        name: 'Athlete',
        authProvider: 'garmin'
      };
    }

    const clearCookieOptions = 'HttpOnly; SameSite=Lax; Path=/; Max-Age=0';

    // Legacy garmin_session cookie (for backward compatibility)
    const garminSessionData = {
      garminUserId: garminUserId,
      connectedAt: Date.now()
    };

    const garminSessionCookie = [
      `garmin_session=${Buffer.from(JSON.stringify(garminSessionData)).toString('base64')}`,
      'HttpOnly',
      'SameSite=Lax',
      'Path=/',
      `Max-Age=${tokens.refresh_token_expires_in}`,
      isSecureEnvironment() ? 'Secure' : ''
    ].filter(Boolean).join('; ');

    // New unified enduzo_session cookie
    const unifiedSessionData = {
      userId: user.id,
      authProvider: 'garmin',
      name: user.name,
      garminUserId: garminUserId,
      createdAt: Date.now()
    };

    const unifiedSessionCookie = createSessionCookie(unifiedSessionData);

    res.setHeader('Set-Cookie', [
      `garmin_code_verifier=; ${clearCookieOptions}`,
      `garmin_oauth_state=; ${clearCookieOptions}`,
      garminSessionCookie,
      unifiedSessionCookie
    ]);

    res.redirect('/?garmin_connected=true');

  } catch (error) {
    console.error('Garmin callback error:', error);
    return res.redirect('/?garmin_error=' + encodeURIComponent('Connection failed. Please try again.'));
  }
}

async function handleStatus(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cookies = parseCookies(req.headers.cookie);
    const sessionCookie = cookies.garmin_session;

    if (!sessionCookie) {
      return res.json({ connected: false, reason: 'no_session' });
    }

    let session;
    try {
      session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString());
    } catch (e) {
      return res.json({ connected: false, reason: 'invalid_session' });
    }

    const { garminUserId } = session;

    if (!garminUserId) {
      return res.json({ connected: false, reason: 'no_user_id' });
    }

    let tokenData;
    try {
      const stored = await kv.get(`garmin_tokens_${garminUserId}`);
      tokenData = typeof stored === 'string' ? JSON.parse(stored) : stored;
    } catch (kvError) {
      console.warn('KV not available:', kvError.message);
      return res.json({
        connected: true,
        garminUserId: garminUserId,
        connectedAt: session.connectedAt,
        warning: 'Token storage not available'
      });
    }

    if (!tokenData) {
      return res.json({ connected: false, reason: 'tokens_not_found' });
    }

    const now = Date.now();
    const accessTokenValid = tokenData.expires_at && now < tokenData.expires_at;
    const refreshTokenValid = tokenData.refresh_token_expires_at && now < tokenData.refresh_token_expires_at;

    if (!refreshTokenValid) {
      return res.json({
        connected: false,
        reason: 'refresh_token_expired',
        message: 'Please reconnect to Garmin'
      });
    }

    res.json({
      connected: true,
      garminUserId: garminUserId,
      connectedAt: session.connectedAt,
      accessTokenValid: accessTokenValid,
      needsRefresh: !accessTokenValid,
      permissions: tokenData.scope ? tokenData.scope.split(' ') : []
    });

  } catch (error) {
    console.error('Garmin status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleSyncWorkout(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { workout, scheduleDate } = req.body;

  if (!workout) {
    return res.status(400).json({ error: 'Workout data is required' });
  }

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
    const accessToken = await getValidAccessToken(garminUserId);
    const garminWorkout = convertToGarminFormat(workout);

    console.log('Creating Garmin workout:', JSON.stringify(garminWorkout, null, 2));

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

    if (scheduleDate && createdWorkout.workoutId) {
      const scheduleResponse = await fetch(GARMIN_SCHEDULE_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          workoutId: createdWorkout.workoutId,
          date: scheduleDate
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

async function handleDisconnect(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const cookies = parseCookies(req.headers.cookie);
    const sessionCookie = cookies.garmin_session;

    if (!sessionCookie) {
      return res.json({ success: true, message: 'Already disconnected' });
    }

    let session;
    try {
      session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString());
    } catch (e) {
      // Invalid session, just clear it
    }

    const garminUserId = session?.garminUserId;

    if (garminUserId) {
      try {
        const stored = await kv.get(`garmin_tokens_${garminUserId}`);
        const tokenData = typeof stored === 'string' ? JSON.parse(stored) : stored;

        if (tokenData?.access_token) {
          try {
            await fetch('https://apis.garmin.com/wellness-api/rest/user/registration', {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
            });
          } catch (deleteError) {
            console.warn('Failed to delete Garmin registration:', deleteError.message);
          }
        }

        await kv.del(`garmin_tokens_${garminUserId}`);
      } catch (kvError) {
        console.warn('KV cleanup error:', kvError.message);
      }
    }

    const clearCookieOptions = [
      'garmin_session=',
      'HttpOnly',
      'SameSite=Lax',
      'Path=/',
      'Max-Age=0',
      isSecureEnvironment() ? 'Secure' : ''
    ].filter(Boolean).join('; ');

    res.setHeader('Set-Cookie', clearCookieOptions);

    res.json({ success: true, message: 'Disconnected from Garmin' });

  } catch (error) {
    console.error('Garmin disconnect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleRefresh(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { garminUserId } = req.body;

  if (!garminUserId) {
    return res.status(400).json({ error: 'garminUserId is required' });
  }

  const clientId = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Garmin credentials not configured' });
  }

  try {
    let tokenData;
    try {
      const stored = await kv.get(`garmin_tokens_${garminUserId}`);
      tokenData = typeof stored === 'string' ? JSON.parse(stored) : stored;
    } catch (kvError) {
      return res.status(404).json({ error: 'No tokens found for user' });
    }

    if (!tokenData || !tokenData.refresh_token) {
      return res.status(404).json({ error: 'No refresh token available' });
    }

    if (tokenData.refresh_token_expires_at && Date.now() > tokenData.refresh_token_expires_at) {
      try {
        await kv.del(`garmin_tokens_${garminUserId}`);
      } catch (e) {}
      return res.status(401).json({ error: 'Refresh token expired. Please reconnect to Garmin.' });
    }

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
      const errorText = await tokenResponse.text();
      console.error('Token refresh failed:', tokenResponse.status, errorText);

      if (tokenResponse.status === 400 || tokenResponse.status === 401) {
        try {
          await kv.del(`garmin_tokens_${garminUserId}`);
        } catch (e) {}
        return res.status(401).json({ error: 'Token refresh failed. Please reconnect to Garmin.' });
      }

      return res.status(500).json({ error: 'Failed to refresh token' });
    }

    const newTokens = await tokenResponse.json();

    const updatedTokenData = {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: Date.now() + (newTokens.expires_in - 600) * 1000,
      refresh_token_expires_at: Date.now() + (newTokens.refresh_token_expires_in - 600) * 1000,
      scope: newTokens.scope
    };

    try {
      await kv.set(`garmin_tokens_${garminUserId}`, JSON.stringify(updatedTokenData), {
        ex: newTokens.refresh_token_expires_in
      });
    } catch (kvError) {
      console.warn('Failed to store refreshed tokens:', kvError.message);
    }

    res.json({ success: true, expires_at: updatedTokenData.expires_at });

  } catch (error) {
    console.error('Garmin refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ============= MAIN HANDLER =============

export default async function handler(req, res) {
  const { action } = req.query;

  switch (action) {
    case 'auth':
      return handleAuth(req, res);
    case 'callback':
      return handleCallback(req, res);
    case 'status':
      return handleStatus(req, res);
    case 'sync-workout':
      return handleSyncWorkout(req, res);
    case 'disconnect':
      return handleDisconnect(req, res);
    case 'refresh':
      return handleRefresh(req, res);
    default:
      return res.status(404).json({ error: `Unknown action: ${action}` });
  }
}
