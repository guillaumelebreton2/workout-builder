/**
 * Strava OAuth API - Consolidated handler
 * Uses dynamic routing: /api/strava/[action]
 * Actions: auth, callback, refresh
 */
import { kv } from '@vercel/kv';
import {
  createSessionCookie,
  createOrUpdateUser,
  createProviderLookup,
  findUserByProviderId
} from '../_lib/auth.js';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

function getBaseUrl() {
  if (process.env.VERCEL_ENV === 'production') {
    return 'https://enduzo.com';
  }
  if (process.env.VERCEL_ENV === 'preview') {
    return process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://enduzo.com';
  }
  return 'http://localhost:5173';
}

// ============= AUTH =============

async function handleAuth(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!STRAVA_CLIENT_ID) {
    return res.status(500).json({ error: 'STRAVA_CLIENT_ID not configured' });
  }

  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const redirectUri = `${protocol}://${host}/api/strava/callback`;

  const scope = 'activity:read_all,profile:read_all';

  const authUrl = `${STRAVA_AUTH_URL}?` + new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scope,
    approval_prompt: 'auto',
  });

  console.log('Strava OAuth redirect:', authUrl);
  res.redirect(authUrl);
}

// ============= CALLBACK =============

async function handleCallback(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error } = req.query;
  const baseUrl = getBaseUrl();

  if (error) {
    console.error('Strava OAuth error:', error);
    return res.redirect(`${baseUrl}/?strava_error=${error}`);
  }

  if (!code) {
    return res.redirect(`${baseUrl}/?strava_error=no_code`);
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        code: code,
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
      console.error('No athlete ID in Strava response');
      return res.redirect(`${baseUrl}/?strava_error=no_athlete_id`);
    }

    console.log('Strava token received for:', athleteName, '(ID:', stravaAthleteId, ')');

    // Store Strava tokens in KV (secure, server-side)
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
      console.log('Strava tokens stored in KV for athlete:', stravaAthleteId);
    } catch (kvError) {
      console.error('Failed to store Strava tokens in KV:', kvError);
    }

    // Check if this Strava account is already linked to a user
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
        user = await createOrUpdateUser({
          ...existingUser,
          name: athleteName || existingUser.name
        });
        console.log('Updated existing user:', user.id);
      } else {
        user = await createOrUpdateUser({
          id: userId,
          authProvider: 'strava',
          linkedProviders: ['strava'],
          stravaAthleteId: stravaAthleteId,
          garminUserId: null,
          name: athleteName,
          email: null
        });
        console.log('Created new user:', user.id);
        await createProviderLookup('strava', stravaAthleteId, userId);
      }
    } catch (userError) {
      console.error('Failed to create/update user:', userError);
      user = { id: userId, name: athleteName, authProvider: 'strava' };
    }

    // Create session cookie
    const sessionData = {
      userId: user.id,
      authProvider: 'strava',
      name: user.name,
      stravaAthleteId: stravaAthleteId,
      createdAt: Date.now()
    };

    const sessionCookie = createSessionCookie(sessionData);
    res.setHeader('Set-Cookie', sessionCookie);

    res.redirect(`${baseUrl}/?strava_connected=true`);

  } catch (err) {
    console.error('Strava callback error:', err);
    res.redirect(`${baseUrl}/?strava_error=server_error`);
  }
}

// ============= REFRESH =============

async function handleRefresh(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { refresh_token } = req.body;

  if (!refresh_token) {
    return res.status(400).json({ error: 'refresh_token required' });
  }

  try {
    const response = await fetch(STRAVA_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: STRAVA_CLIENT_ID,
        client_secret: STRAVA_CLIENT_SECRET,
        refresh_token: refresh_token,
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

// ============= MAIN HANDLER =============

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  switch (action) {
    case 'auth':
      return handleAuth(req, res);
    case 'callback':
      return handleCallback(req, res);
    case 'refresh':
      return handleRefresh(req, res);
    default:
      return res.status(404).json({ error: `Unknown action: ${action}` });
  }
}
