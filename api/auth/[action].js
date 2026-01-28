/**
 * Auth API - Consolidated handler for all auth endpoints
 * Uses dynamic routing: /api/auth/[action]
 */
import { getSessionFromRequest, getUserById, clearSessionCookie } from '../_lib/auth.js';

// ============= ACTION HANDLERS =============

async function handleMe(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);

  if (!session || !session.userId) {
    return res.status(401).json({
      authenticated: false,
      error: 'Not authenticated'
    });
  }

  try {
    const user = await getUserById(session.userId);

    if (!user) {
      return res.status(401).json({
        authenticated: false,
        error: 'User not found'
      });
    }

    return res.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        authProvider: user.authProvider,
        linkedProviders: user.linkedProviders || [user.authProvider],
        garminConnected: (user.linkedProviders || [user.authProvider]).includes('garmin'),
        stravaConnected: (user.linkedProviders || [user.authProvider]).includes('strava'),
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleLogout(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Clear the session cookie
  res.setHeader('Set-Cookie', clearSessionCookie());

  return res.json({ success: true, message: 'Logged out' });
}

// ============= MAIN HANDLER =============

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  switch (action) {
    case 'me':
      return handleMe(req, res);
    case 'logout':
      return handleLogout(req, res);
    default:
      return res.status(404).json({ error: `Unknown action: ${action}` });
  }
}
