// Garmin OAuth2 - Refresh Token
// Refreshes expired access tokens using the refresh token

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { garminUserId } = req.body;

  if (!garminUserId) {
    return res.status(400).json({ error: 'garminUserId is required' });
  }

  const clientId = process.env.GARMIN_CLIENT_ID;
  const clientSecret = process.env.GARMIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Garmin credentials not configured' });
  }

  try {
    // Get stored tokens from KV
    let tokenData;
    try {
      const stored = await kv.get(`garmin_tokens_${garminUserId}`);
      tokenData = typeof stored === 'string' ? JSON.parse(stored) : stored;
    } catch (kvError) {
      return res.status(404).json({ error: 'No tokens found for user' });
    }

    if (!tokenData || !tokenData.refresh_token) {
      return res.status(404).json({ error: 'No refresh token available' });
    }

    // Check if refresh token itself has expired
    if (tokenData.refresh_token_expires_at && Date.now() > tokenData.refresh_token_expires_at) {
      // Clean up expired tokens
      try {
        await kv.del(`garmin_tokens_${garminUserId}`);
      } catch (e) {}
      return res.status(401).json({ error: 'Refresh token expired. Please reconnect to Garmin.' });
    }

    // Refresh the access token
    const tokenResponse = await fetch('https://diauth.garmin.com/di-oauth2-service/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokenData.refresh_token
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token refresh failed:', tokenResponse.status, errorText);

      // If refresh fails, tokens might be revoked
      if (tokenResponse.status === 400 || tokenResponse.status === 401) {
        try {
          await kv.del(`garmin_tokens_${garminUserId}`);
        } catch (e) {}
        return res.status(401).json({ error: 'Token refresh failed. Please reconnect to Garmin.' });
      }

      return res.status(500).json({ error: 'Failed to refresh token' });
    }

    const newTokens = await tokenResponse.json();

    // Update stored tokens
    const updatedTokenData = {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token, // New refresh token
      expires_at: Date.now() + (newTokens.expires_in - 600) * 1000,
      refresh_token_expires_at: Date.now() + (newTokens.refresh_token_expires_in - 600) * 1000,
      scope: newTokens.scope
    };

    try {
      await kv.set(`garmin_tokens_${garminUserId}`, JSON.stringify(updatedTokenData), {
        ex: newTokens.refresh_token_expires_in
      });
    } catch (kvError) {
      console.warn('Failed to store refreshed tokens:', kvError.message);
    }

    res.json({
      success: true,
      expires_at: updatedTokenData.expires_at
    });

  } catch (error) {
    console.error('Garmin refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
