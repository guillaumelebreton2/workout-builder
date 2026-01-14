/**
 * Vercel Serverless Function - Get Strava athlete zones
 */

const STRAVA_API_URL = 'https://www.strava.com/api/v3';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requis' });
  }

  const accessToken = authHeader.split(' ')[1];

  try {
    const response = await fetch(`${STRAVA_API_URL}/athlete/zones`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Strava zones API error: ${response.status}`, errorText);

      if (response.status === 401) {
        return res.status(401).json({ error: 'Token expiré', needsRefresh: true });
      }
      if (response.status === 403) {
        return res.status(403).json({ error: 'Accès refusé. Re-connecte Strava pour autoriser l\'accès aux zones.' });
      }
      return res.status(response.status).json({ error: `Erreur Strava: ${response.status}` });
    }

    const zones = await response.json();
    res.json(zones);
  } catch (err) {
    console.error('Erreur zones Strava:', err);
    res.status(500).json({ error: 'Failed to fetch athlete zones' });
  }
}
