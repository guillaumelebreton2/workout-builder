/**
 * Vercel Serverless Function - Strava OAuth initiation
 */

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_AUTH_URL = 'https://www.strava.com/oauth/authorize';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!STRAVA_CLIENT_ID) {
    return res.status(500).json({ error: 'STRAVA_CLIENT_ID non configuré' });
  }

  // Construire le redirect URI basé sur le host de la requête
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

  console.log('Redirection OAuth Strava:', authUrl);
  res.redirect(authUrl);
}
