// Garmin OAuth2 PKCE - Step 2: Callback & Token Exchange
// Exchanges authorization code for access/refresh tokens

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

  const { code, state, error, error_description } = req.query;

  // Handle user denial
  if (error) {
    console.error('Garmin OAuth error:', error, error_description);
    return res.redirect('/?garmin_error=' + encodeURIComponent(error_description || error));
  }

  if (!code) {
    return res.redirect('/?garmin_error=' + encodeURIComponent('No authorization code received'));
  }

  // Get code_verifier and state from cookies
  const cookies = parseCookies(req.headers.cookie);
  const codeVerifier = cookies.garmin_code_verifier;
  const storedState = cookies.garmin_oauth_state;

  if (!codeVerifier) {
    return res.redirect('/?garmin_error=' + encodeURIComponent('Session expired. Please try again.'));
  }

  // Verify state to prevent CSRF
  if (state !== storedState) {
    return res.redirect('/?garmin_error=' + encodeURIComponent('Invalid state. Please try again.'));
  }

  const clientId = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.redirect('/?garmin_error=' + encodeURIComponent('Server configuration error'));
  }

  // Determine redirect URI (must match the one used in auth)
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const baseUrl = isProduction ? 'https://enduzo.com' : 'http://localhost:3001';
  const redirectUri = `${baseUrl}/api/garmin/callback`;

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch('https://diauth.garmin.com/di-oauth2-service/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        code_verifier: codeVerifier,
        redirect_uri: redirectUri
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return res.redirect('/?garmin_error=' + encodeURIComponent('Failed to exchange token'));
    }

    const tokens = await tokenResponse.json();
    console.log('Garmin tokens received:', {
      hasAccessToken: !!tokens.access_token,
      expiresIn: tokens.expires_in,
      scope: tokens.scope
    });

    // Fetch Garmin user ID
    const userResponse = await fetch('https://apis.garmin.com/wellness-api/rest/user/id', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`
      }
    });

    let garminUserId = null;
    if (userResponse.ok) {
      const userData = await userResponse.json();
      garminUserId = userData.userId;
      console.log('Garmin user ID:', garminUserId);
    }

    // Store tokens in KV (Redis) with user ID as key
    // In production, you'd associate this with your app's user account
    if (garminUserId && kv) {
      const tokenData = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + (tokens.expires_in - 600) * 1000, // Subtract 10 min buffer
        refresh_token_expires_at: Date.now() + (tokens.refresh_token_expires_in - 600) * 1000,
        scope: tokens.scope
      };

      try {
        await kv.set(`garmin_tokens_${garminUserId}`, JSON.stringify(tokenData), {
          ex: tokens.refresh_token_expires_in // Expire when refresh token expires
        });
      } catch (kvError) {
        console.warn('KV storage not available:', kvError.message);
      }
    }

    // Clear the PKCE cookies
    const clearCookieOptions = 'HttpOnly; SameSite=Lax; Path=/; Max-Age=0';
    res.setHeader('Set-Cookie', [
      `garmin_code_verifier=; ${clearCookieOptions}`,
      `garmin_oauth_state=; ${clearCookieOptions}`
    ]);

    // Set a session cookie with minimal info for the frontend
    // The actual tokens stay server-side
    const sessionData = {
      garminUserId: garminUserId,
      connectedAt: Date.now()
    };

    const sessionCookie = [
      `garmin_session=${Buffer.from(JSON.stringify(sessionData)).toString('base64')}`,
      'HttpOnly',
      'SameSite=Lax',
      'Path=/',
      `Max-Age=${tokens.refresh_token_expires_in}`,
      isProduction ? 'Secure' : ''
    ].filter(Boolean).join('; ');

    res.setHeader('Set-Cookie', [
      `garmin_code_verifier=; ${clearCookieOptions}`,
      `garmin_oauth_state=; ${clearCookieOptions}`,
      sessionCookie
    ]);

    // Redirect back to app with success
    res.redirect('/?garmin_connected=true');

  } catch (error) {
    console.error('Garmin callback error:', error);
    return res.redirect('/?garmin_error=' + encodeURIComponent('Connection failed. Please try again.'));
  }
}
