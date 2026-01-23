// Garmin OAuth2 - Connection Status
// Returns whether the user is connected to Garmin and token validity

import { kv } from '@vercel/kv';

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    cookies[name] = rest.join('=');
  });
  return cookies;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session from cookie
    const cookies = parseCookies(req.headers.cookie);
    const sessionCookie = cookies.garmin_session;

    if (!sessionCookie) {
      return res.json({
        connected: false,
        reason: 'no_session'
      });
    }

    // Decode session
    let session;
    try {
      session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString());
    } catch (e) {
      return res.json({
        connected: false,
        reason: 'invalid_session'
      });
    }

    const { garminUserId } = session;

    if (!garminUserId) {
      return res.json({
        connected: false,
        reason: 'no_user_id'
      });
    }

    // Check if we have valid tokens
    let tokenData;
    try {
      const stored = await kv.get(`garmin_tokens_${garminUserId}`);
      tokenData = typeof stored === 'string' ? JSON.parse(stored) : stored;
    } catch (kvError) {
      console.warn('KV not available:', kvError.message);
      // If KV is not available, trust the session cookie
      return res.json({
        connected: true,
        garminUserId: garminUserId,
        connectedAt: session.connectedAt,
        warning: 'Token storage not available'
      });
    }

    if (!tokenData) {
      return res.json({
        connected: false,
        reason: 'tokens_not_found'
      });
    }

    // Check token validity
    const now = Date.now();
    const accessTokenValid = tokenData.expires_at && now < tokenData.expires_at;
    const refreshTokenValid = tokenData.refresh_token_expires_at && now < tokenData.refresh_token_expires_at;

    if (!refreshTokenValid) {
      // Refresh token expired - need to reconnect
      return res.json({
        connected: false,
        reason: 'refresh_token_expired',
        message: 'Please reconnect to Garmin'
      });
    }

    res.json({
      connected: true,
      garminUserId: garminUserId,
      connectedAt: session.connectedAt,
      accessTokenValid: accessTokenValid,
      needsRefresh: !accessTokenValid,
      permissions: tokenData.scope ? tokenData.scope.split(' ') : []
    });

  } catch (error) {
    console.error('Garmin status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
