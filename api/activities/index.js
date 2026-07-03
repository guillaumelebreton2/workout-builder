/**
 * API unifiée des activités (Strava + Garmin)
 * GET /api/activities      -> retourne les activités unifiées stockées
 * POST /api/activities/sync -> force la synchronisation depuis Strava et Garmin
 */
import { kv } from '../_lib/kv.js';
import { getSessionFromRequest, getUserById } from '../_lib/auth.js';
import {
  normalizeActivities,
  deduplicateActivities,
} from '../_lib/activities.js';

const STRAVA_API_URL = 'https://www.strava.com/api/v3';
const GARMIN_ACTIVITIES_API = 'https://apis.garmin.com/wellness-api/rest/activities'; // ou activitySummary selon scopes

const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes minimum entre deux syncs forcées

async function getValidStravaToken(user) {
  if (!user?.stravaAthleteId) {
    console.log('getValidStravaToken: no stravaAthleteId for user', user?.id);
    return null;
  }

  console.log('getValidStravaToken: looking up token for athlete', user.stravaAthleteId);
  const stored = await kv.get(`strava_tokens_${user.stravaAthleteId}`);
  const tokenData = typeof stored === 'string' ? JSON.parse(stored) : stored;
  if (!tokenData?.access_token) {
    console.log('getValidStravaToken: no access token found in KV');
    return null;
  }

  // Vérifier expiration (expires_at est stocké en millisecondes)
  const isExpired = tokenData.expires_at && Date.now() > tokenData.expires_at - 300 * 1000;
  console.log('getValidStravaToken: expires_at', tokenData.expires_at, 'isExpired', isExpired);
  if (isExpired) {
    // Rafraîchir via l'API Strava
    try {
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/strava/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: tokenData.refresh_token }),
      });

      if (!response.ok) {
        console.warn('Strava token refresh failed');
        return null;
      }

      const newTokens = await response.json();
      const updatedTokenData = {
        ...tokenData,
        access_token: newTokens.access_token,
        refresh_token: newTokens.refresh_token,
        expires_at: newTokens.expires_at * 1000, // Convertir en ms pour cohérence
      };
      await kv.set(`strava_tokens_${user.stravaAthleteId}`, JSON.stringify(updatedTokenData));
      return newTokens.access_token;
    } catch (err) {
      console.error('Error refreshing Strava token:', err);
      return null;
    }
  }

  return tokenData.access_token;
}

async function getValidGarminToken(user) {
  if (!user?.garminUserId) return null;

  const stored = await kv.get(`garmin_tokens_${user.garminUserId}`);
  const tokenData = typeof stored === 'string' ? JSON.parse(stored) : stored;
  if (!tokenData?.access_token) return null;

  if (tokenData.expires_at && Date.now() > tokenData.expires_at) {
    // Rafraîchir via l'API Garmin
    try {
      const baseUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001';
      const response = await fetch(`${baseUrl}/api/garmin/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garminUserId: user.garminUserId }),
      });

      if (!response.ok) {
        console.warn('Garmin token refresh failed');
        return null;
      }

      // Le refresh garmin met à jour KV, on relit
      const refreshed = await kv.get(`garmin_tokens_${user.garminUserId}`);
      const refreshedData = typeof refreshed === 'string' ? JSON.parse(refreshed) : refreshed;
      return refreshedData?.access_token || null;
    } catch (err) {
      console.error('Error refreshing Garmin token:', err);
      return null;
    }
  }

  return tokenData.access_token;
}

async function fetchStravaActivities(accessToken, options = {}) {
  if (!accessToken) return { activities: [], error: 'No Strava token' };

  const params = new URLSearchParams({
    page: '1',
    per_page: '100',
  });

  if (options.after) {
    params.append('after', Math.floor(new Date(options.after).getTime() / 1000).toString());
  }

  try {
    const response = await fetch(`${STRAVA_API_URL}/athlete/activities?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 401) return { activities: [], error: 'Strava token expired' };
      throw new Error(`Strava API error: ${response.status}`);
    }

    const data = await response.json();
    return { activities: normalizeActivities(data, 'strava'), error: null };
  } catch (err) {
    console.error('Error fetching Strava activities:', err);
    return { activities: [], error: err.message || 'Strava fetch failed' };
  }
}

async function fetchGarminActivities(accessToken, options = {}) {
  if (!accessToken) return { activities: [], error: 'No Garmin token' };

  // L'endpoint exact dépend des scopes approuvés. On tente le endpoint summary
  // et on loggue le format reçu pour itérer si nécessaire.
  const url = new URL(`${GARMIN_ACTIVITIES_API}`);
  if (options.after) {
    url.searchParams.append('startTime', Math.floor(new Date(options.after).getTime() / 1000).toString());
  }

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 401) return { activities: [], error: 'Garmin token expired' };
      if (response.status === 403) return { activities: [], error: 'Garmin Health API not authorized' };
      const text = await response.text();
      console.warn('Garmin activities API response:', response.status, text);
      throw new Error(`Garmin API error: ${response.status}`);
    }

    const data = await response.json();
    // Garmin peut retourner un objet ou un tableau selon l'endpoint
    const rawActivities = Array.isArray(data) ? data : data.activities || data.activityList || [];
    return { activities: normalizeActivities(rawActivities, 'garmin'), error: null };
  } catch (err) {
    console.error('Error fetching Garmin activities:', err);
    return { activities: [], error: err.message || 'Garmin fetch failed' };
  }
}

async function getStoredActivities(userId) {
  try {
    const stored = await kv.get(`activities_${userId}`);
    if (!stored) return null;
    return typeof stored === 'string' ? JSON.parse(stored) : stored;
  } catch (err) {
    console.error('Error reading stored activities:', err);
    return null;
  }
}

async function storeActivities(userId, data) {
  try {
    await kv.set(`activities_${userId}`, JSON.stringify(data));
  } catch (err) {
    console.error('Error storing activities:', err);
    throw err;
  }
}

async function syncActivities(user) {
  console.log('syncActivities: starting sync for user', user.id, 'stravaAthleteId', user.stravaAthleteId, 'garminUserId', user.garminUserId);
  const errors = [];
  const sources = [];

  // Date de début par défaut : 6 mois en arrière
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

  // Récupérer les tokens
  const [stravaToken, garminToken] = await Promise.all([
    getValidStravaToken(user),
    getValidGarminToken(user),
  ]);

  // Récupérer les activités en parallèle
  const [stravaResult, garminResult] = await Promise.all([
    stravaToken ? fetchStravaActivities(stravaToken, { after: sixMonthsAgo }) : { activities: [], error: 'Strava not connected' },
    garminToken ? fetchGarminActivities(garminToken, { after: sixMonthsAgo }) : { activities: [], error: 'Garmin not connected' },
  ]);

  console.log('syncActivities: stravaResult', stravaResult.activities.length, 'activities, error', stravaResult.error);
  console.log('syncActivities: garminResult', garminResult.activities.length, 'activities, error', garminResult.error);

  if (stravaResult.error) errors.push(stravaResult.error);
  else if (stravaResult.activities.length > 0) sources.push('strava');

  if (garminResult.error) errors.push(garminResult.error);
  else if (garminResult.activities.length > 0) sources.push('garmin');

  // Fusionner et dédupliquer
  const allActivities = [...stravaResult.activities, ...garminResult.activities];
  const deduplicated = deduplicateActivities(allActivities, { preferredSource: 'strava' });

  const result = {
    activities: deduplicated,
    meta: {
      total: deduplicated.length,
      sources,
      lastSyncedAt: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    },
  };

  console.log('syncActivities: final result', result.meta);

  // Persister
  await storeActivities(user.id, result);
  return result;
}

async function handleGetActivities(req, res, user) {
  try {
    const forceSync = req.query.sync === 'true';
    const stored = await getStoredActivities(user.id);

    // Si pas de données stockées, forcer une sync
    if (!stored || !stored.activities || stored.activities.length === 0) {
      const result = await syncActivities(user);
      return res.json(result);
    }

    // Si sync forcée, vérifier le cooldown
    if (forceSync) {
      const lastSynced = stored.meta?.lastSyncedAt ? new Date(stored.meta.lastSyncedAt).getTime() : 0;
      const now = Date.now();
      if (now - lastSynced < SYNC_COOLDOWN_MS) {
        return res.json({
          ...stored,
          meta: {
            ...stored.meta,
            message: 'Sync trop récente, données en cache servies',
          },
        });
      }
      const result = await syncActivities(user);
      return res.json(result);
    }

    return res.json(stored);
  } catch (err) {
    console.error('Error in handleGetActivities:', err);
    return res.status(500).json({ error: 'Failed to fetch activities', message: err.message });
  }
}

async function handleSync(req, res, user) {
  try {
    const stored = await getStoredActivities(user.id);
    if (stored?.meta?.lastSyncedAt) {
      const lastSynced = new Date(stored.meta.lastSyncedAt).getTime();
      if (Date.now() - lastSynced < SYNC_COOLDOWN_MS) {
        return res.status(429).json({
          error: 'Sync trop fréquente',
          message: 'Veuillez attendre quelques minutes avant de synchroniser à nouveau.',
          cached: stored,
        });
      }
    }

    const result = await syncActivities(user);
    return res.json({ success: true, ...result });
  } catch (err) {
    console.error('Error in handleSync:', err);
    return res.status(500).json({ error: 'Sync failed', message: err.message });
  }
}

export default async function handler(req, res) {
  console.log('/api/activities', req.method, 'forceSync', req.query.sync);

  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  console.log('/api/activities: session', session ? { userId: session.userId, authProvider: session.authProvider } : null);
  if (!session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const user = await getUserById(session.userId);
  console.log('/api/activities: user', user ? { id: user.id, stravaAthleteId: user.stravaAthleteId, garminUserId: user.garminUserId, linkedProviders: user.linkedProviders } : null);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  if (req.method === 'GET') {
    return handleGetActivities(req, res, user);
  }

  return handleSync(req, res, user);
}
