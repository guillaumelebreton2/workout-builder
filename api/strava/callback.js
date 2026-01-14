/**
 * Vercel Serverless Function - Strava OAuth callback
 */

const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID;
const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET;
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const FRONTEND_URL = process.env.VITE_APP_URL || 'https://enduzo.com';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, error } = req.query;

  if (error) {
    console.error('Erreur OAuth Strava:', error);
    return res.redirect(`${FRONTEND_URL}/coach?strava_error=${error}`);
  }

  if (!code) {
    return res.redirect(`${FRONTEND_URL}/coach?strava_error=no_code`);
  }

  try {
    // Échanger le code contre un token
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
      console.error('Erreur token Strava:', errorText);
      return res.redirect(`${FRONTEND_URL}/coach?strava_error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    console.log('Token Strava reçu pour:', tokenData.athlete?.firstname);

    // Rediriger vers le frontend avec les tokens encodés
    const params = new URLSearchParams({
      strava_connected: 'true',
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete_id: tokenData.athlete?.id,
      athlete_name: `${tokenData.athlete?.firstname || ''} ${tokenData.athlete?.lastname || ''}`.trim(),
    });

    res.redirect(`${FRONTEND_URL}/coach?${params}`);
  } catch (err) {
    console.error('Erreur callback Strava:', err);
    res.redirect(`${FRONTEND_URL}/coach?strava_error=server_error`);
  }
}
