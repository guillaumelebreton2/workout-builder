/**
 * Strava API - Consolidated catch-all handler
 * Replaces all individual /api/strava/* serverless functions to stay under Vercel Hobby limits.
 *
 * Handles:
 *   /api/strava/auth
 *   /api/strava/callback
 *   /api/strava/refresh
 *   /api/strava/activities
 *   /api/strava/activities/:id
 *   /api/strava/activities/:id/streams
 *   /api/strava/activities/:id/laps
 *   /api/strava/athlete
 *   /api/strava/athlete/zones
 */
import { kv } from '../_lib/kv.js';
import {
  createSessionCookie,
  createOrUpdateUser,
  createProviderLookup,
  findUserByProviderId,
  getSessionFromRequest,
  getUserById,
  clearSessionCookie
} from '../_lib/auth.js';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_API_URL = 'https://www.strava.com/api/v3';

function getBaseUrl() {
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://enduzo.com';
  }
  if (process.env.VERCEL_ENV === 'preview') {
    return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://enduzo.com';
  }
  return 'http://localhost:5173';
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function getAccessToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.split(' ')[1];
}

// ============= AUTH =============

async function handleAuth(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!STRAVA_CLIENT_ID) return res.status(500).json({ error: 'STRAVA_CLIENT_ID not configured' });

  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${protocol}://${host}/api/strava/callback`;

  const authUrl = `${STRAVA_AUTH_URL}?` + new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'activity:read_all,profile:read_all',
    approval_prompt: 'auto',
  });

  res.redirect(authUrl);
}

async function handleCallback(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { code, error } = req.query;
  const baseUrl = getBaseUrl();

  if (error) {
    console.error('Strava OAuth error:', error);
    return res.redirect(`${baseUrl}/?strava_error=${error}`);
  }
  if (!code) return res.redirect(`${baseUrl}/?strava_error=no_code`);

  try {
    const tokenResponse = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Strava token exchange failed:', errorText);
      return res.redirect(`${baseUrl}/?strava_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const stravaAthleteId = tokenData.athlete?.id?.toString();
    const athleteName = `${tokenData.athlete?.firstname || ''} ${tokenData.athlete?.lastname || ''}`.trim() || 'Athlete';

    if (!stravaAthleteId) {
      return res.redirect(`${baseUrl}/?strava_error=no_athlete_id`);
    }

    // Store tokens in KV (ms for consistency)
    const stravaTokenData = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at * 1000,
      athlete_id: stravaAthleteId,
      athlete_name: athleteName
    };
    try {
      await kv.set(`strava_tokens_${stravaAthleteId}`, JSON.stringify(stravaTokenData), {
        ex: 180 * 24 * 60 * 60
      });
    } catch (kvError) {
      console.error('Failed to store Strava tokens in KV:', kvError);
    }

    // Create or update user
    let existingUser = null;
    try {
      existingUser = await findUserByProviderId('strava', stravaAthleteId);
    } catch (e) {
      console.warn('Could not check for existing user:', e);
    }

    const userId = existingUser?.id || `strava_${stravaAthleteId}`;
    let user;
    try {
      if (existingUser) {
        user = await createOrUpdateUser({ ...existingUser, name: athleteName || existingUser.name });
      } else {
        user = await createOrUpdateUser({
          id: userId,
          authProvider: 'strava',
          linkedProviders: ['strava'],
          stravaAthleteId,
          garminUserId: null,
          name: athleteName,
          email: null
        });
        await createProviderLookup('strava', stravaAthleteId, userId);
      }
    } catch (userError) {
      console.error('Failed to create/update user:', userError);
      return res.redirect(`${baseUrl}/?strava_error=account_creation_failed`);
    }

    res.setHeader('Set-Cookie', createSessionCookie({
      userId: user.id,
      authProvider: 'strava',
      name: user.name,
      stravaAthleteId,
      createdAt: Date.now()
    }));

    res.redirect(`${baseUrl}/?strava_connected=true`);
  } catch (err) {
    console.error('Strava callback error:', err);
    res.redirect(`${baseUrl}/?strava_error=server_error`);
  }
}

async function handleDisconnect(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const session = getSessionFromRequest(req);
  if (!session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  const stravaAthleteId = user.stravaAthleteId;

  // Delete stored Strava tokens
  if (stravaAthleteId) {
    try {
      await kv.del(`strava_tokens_${stravaAthleteId}`);
    } catch (err) {
      console.error('Failed to delete Strava tokens:', err);
    }
  }

  // Update user: remove strava from linkedProviders and clear stravaAthleteId
  const linkedProviders = (user.linkedProviders || [user.authProvider]).filter(p => p !== 'strava');
  const updatedUser = await createOrUpdateUser({
    ...user,
    linkedProviders,
    stravaAthleteId: null,
    authProvider: linkedProviders.length > 0 ? linkedProviders[0] : user.authProvider
  });

  // If no providers left, clear session. Otherwise update session.
  if (linkedProviders.length === 0) {
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.json({ success: true, message: 'Disconnected from Strava and logged out', loggedOut: true });
  }

  res.setHeader('Set-Cookie', createSessionCookie({
    userId: updatedUser.id,
    authProvider: updatedUser.authProvider,
    name: updatedUser.name,
    garminUserId: updatedUser.garminUserId || undefined,
    createdAt: Date.now()
  }));

  return res.json({ success: true, message: 'Disconnected from Strava' });
}

async function handleRefresh(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { refresh_token } = req.body;
  if (!refresh_token) return res.status(400).json({ error: 'refresh_token required' });

  try {
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Strava refresh error:', errorText);
      return res.status(response.status).json({ error: 'Token refresh failed' });
    }

    const data = await response.json();
    res.json({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
    });
  } catch (err) {
    console.error('Strava refresh error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// ============= ACTIVITIES =============

async function proxyToStrava(req, res, url, options = {}) {
  const accessToken = getAccessToken(req);
  if (!accessToken) return res.status(401).json({ error: 'Token requis' });

  try {
    const response = await fetch(url, {
      ...options,
      headers: { Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token expiré', needsRefresh: true });
      }
      if (response.status === 404 && options.emptyOn404) {
        return res.json({});
      }
      throw new Error(`Strava API error: ${response.status}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Strava proxy error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch from Strava' });
  }
}

async function handleActivities(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { page = 1, per_page = 30, after, before } = req.query;
  const params = new URLSearchParams({ page: page.toString(), per_page: per_page.toString() });
  if (after) params.append('after', after);
  if (before) params.append('before', before);

  await proxyToStrava(req, res, `${STRAVA_API_URL}/athlete/activities?${params}`);
}

async function handleActivityDetails(req, res, id) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  await proxyToStrava(req, res, `${STRAVA_API_URL}/activities/${id}`);
}

async function handleActivityStreams(req, res, id) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const streamTypes = [
    'time', 'distance', 'latlng', 'altitude', 'velocity_smooth',
    'heartrate', 'cadence', 'watts', 'temp', 'moving', 'grade_smooth'
  ].join(',');

  await proxyToStrava(req, res,
    `${STRAVA_API_URL}/activities/${id}/streams?keys=${streamTypes}&key_by_type=true`,
    { emptyOn404: true }
  );
}

async function handleActivityLaps(req, res, id) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  await proxyToStrava(req, res, `${STRAVA_API_URL}/activities/${id}/laps`);
}

// ============= ATHLETE =============

async function handleAthlete(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  await proxyToStrava(req, res, `${STRAVA_API_URL}/athlete`);
}

async function handleAthleteZones(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const accessToken = getAccessToken(req);
  if (!accessToken) return res.status(401).json({ error: 'Token requis' });

  try {
    const response = await fetch(`${STRAVA_API_URL}/athlete/zones`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Strava zones API error: ${response.status}`, errorText);
      if (response.status === 401) return res.status(401).json({ error: 'Token expiré', needsRefresh: true });
      if (response.status === 403) return res.status(403).json({ error: 'Accès refusé. Re-connecte-toi à Strava pour autoriser l\'accès aux zones.' });
      return res.status(response.status).json({ error: `Erreur Strava: ${response.status}` });
    }

    const zones = await response.json();
    res.json(zones);
  } catch (err) {
    console.error('Erreur zones Strava:', err);
    res.status(500).json({ error: 'Failed to fetch athlete zones' });
  }
}

// ============= MAIN HANDLER =============

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Vercel passes `path` as a string when there is one segment, and as an array for multiple.
  const rawPath = req.query.path || [];
  const path = Array.isArray(rawPath) ? rawPath : [rawPath];

  // Root /api/strava - not valid
  if (path.length === 0) {
    return res.status(404).json({ error: 'Not found' });
  }

  const [first, second, third] = path;

  // Auth routes
  if (path.length === 1) {
    if (first === 'auth') return handleAuth(req, res);
    if (first === 'callback') return handleCallback(req, res);
    if (first === 'refresh') return handleRefresh(req, res);
    if (first === 'disconnect') return handleDisconnect(req, res);
    if (first === 'activities') return handleActivities(req, res);
    if (first === 'athlete') return handleAthlete(req, res);
  }

  // Activity details / streams / laps
  if (path.length === 2 && first === 'activities') {
    return handleActivityDetails(req, res, second);
  }
  if (path.length === 3 && first === 'activities') {
    if (third === 'streams') return handleActivityStreams(req, res, second);
    if (third === 'laps') return handleActivityLaps(req, res, second);
  }

  // Athlete zones
  if (path.length === 2 && first === 'athlete' && second === 'zones') {
    return handleAthleteZones(req, res);
  }

  return res.status(404).json({ error: `Unknown Strava endpoint: /${path.join('/')}` });
}
