/**
 * Vercel Serverless Function - Get Strava activity streams
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
    const streamTypes = [
      'time', 'distance', 'latlng', 'altitude', 'velocity_smooth',
      'heartrate', 'cadence', 'watts', 'temp', 'moving', 'grade_smooth'
    ].join(',');

    const response = await fetch(
      `${STRAVA_API_URL}/activities/${id}/streams?keys=${streamTypes}&key_by_type=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!response.ok) {
      if (response.status === 401) {
        return res.status(401).json({ error: 'Token expiré', needsRefresh: true });
      }
      // 404 = pas de streams (activité manuelle)
      if (response.status === 404) {
        return res.json({});
      }
      throw new Error(`Strava API error: ${response.status}`);
    }

    const streams = await response.json();
    res.json(streams);
  } catch (err) {
    console.error('Erreur streams Strava:', err);
    res.status(500).json({ error: 'Failed to fetch activity streams' });
  }
}
