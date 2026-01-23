// Garmin OAuth2 - Disconnect
// Removes user's Garmin connection and cleans up tokens

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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session from cookie
    const cookies = parseCookies(req.headers.cookie);
    const sessionCookie = cookies.garmin_session;

    if (!sessionCookie) {
      return res.json({ success: true, message: 'Already disconnected' });
    }

    // Decode session
    let session;
    try {
      session = JSON.parse(Buffer.from(sessionCookie, 'base64').toString());
    } catch (e) {
      // Invalid session, just clear it
    }

    const garminUserId = session?.garminUserId;

    // If we have a user ID, try to call Garmin's delete registration endpoint
    // and clean up our stored tokens
    if (garminUserId) {
      try {
        const stored = await kv.get(`garmin_tokens_${garminUserId}`);
        const tokenData = typeof stored === 'string' ? JSON.parse(stored) : stored;

        if (tokenData?.access_token) {
          // Call Garmin's delete registration endpoint (required by their terms)
          try {
            await fetch('https://apis.garmin.com/wellness-api/rest/user/registration', {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
              }
            });
          } catch (deleteError) {
            console.warn('Failed to delete Garmin registration:', deleteError.message);
          }
        }

        // Delete tokens from KV
        await kv.del(`garmin_tokens_${garminUserId}`);
      } catch (kvError) {
        console.warn('KV cleanup error:', kvError.message);
      }
    }

    // Clear the session cookie
    const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
    const clearCookieOptions = [
      'garmin_session=',
      'HttpOnly',
      'SameSite=Lax',
      'Path=/',
      'Max-Age=0',
      isProduction ? 'Secure' : ''
    ].filter(Boolean).join('; ');

    res.setHeader('Set-Cookie', clearCookieOptions);

    res.json({
      success: true,
      message: 'Disconnected from Garmin'
    });

  } catch (error) {
    console.error('Garmin disconnect error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
