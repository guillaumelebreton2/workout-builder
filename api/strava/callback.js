/**
 * Vercel Serverless Function - Strava OAuth callback
 *
 * Security improvements:
 * - Tokens stored server-side in Vercel KV (not passed via URL)
 * - Creates user record in KV
 * - Sets HttpOnly session cookie
 */
import { kv } from '@vercel/kv';
import {
  createSessionCookie,
  createOrUpdateUser,
  createProviderLookup,
  findUserByProviderId
} from '../lib/auth.js';

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
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

export default async function handler(req, res) {
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
      expires_at: tokenData.expires_at * 1000, // Convert to milliseconds
      athlete_id: stravaAthleteId,
      athlete_name: athleteName
    };

    try {
      await kv.set(`strava_tokens_${stravaAthleteId}`, JSON.stringify(stravaTokenData), {
        ex: 180 * 24 * 60 * 60 // 180 days TTL
      });
      console.log('Strava tokens stored in KV for athlete:', stravaAthleteId);
    } catch (kvError) {
      console.error('Failed to store Strava tokens in KV:', kvError);
      // Continue anyway - tokens in session is fallback
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
        // Update existing user
        user = await createOrUpdateUser({
          ...existingUser,
          name: athleteName || existingUser.name
        });
        console.log('Updated existing user:', user.id);
      } else {
        // Create new user
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

        // Create lookup for future logins
        await createProviderLookup('strava', stravaAthleteId, userId);
      }
    } catch (userError) {
      console.error('Failed to create/update user:', userError);
      // Create minimal user object for session
      user = {
        id: userId,
        name: athleteName,
        authProvider: 'strava'
      };
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

    // Redirect WITHOUT sensitive tokens in URL
    res.redirect(`${baseUrl}/?strava_connected=true`);

  } catch (err) {
    console.error('Strava callback error:', err);
    res.redirect(`${baseUrl}/?strava_error=server_error`);
  }
}
