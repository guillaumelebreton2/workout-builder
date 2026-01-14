/**
 * Vercel Serverless Function - Get Strava activity details
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
  const { id } = req.query;

  try {
    const response = await fetch(`${STRAVA_API_URL}/activities/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token expiré', needsRefresh: true });
      }
      throw new Error(`Strava API error: ${response.status}`);
    }

    const activity = await response.json();
    res.json(activity);
  } catch (err) {
    console.error('Erreur détails activité Strava:', err);
    res.status(500).json({ error: 'Failed to fetch activity details' });
  }
}
