// Garmin OAuth2 PKCE - Step 1: Authorization Request
// Generates code_verifier/challenge and redirects to Garmin

import crypto from 'crypto';

// Generate a cryptographically random code verifier (43-128 chars)
function generateCodeVerifier() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const length = 64;
  let verifier = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    verifier += chars[randomBytes[i] % chars.length];
  }
  return verifier;
}

// Generate code challenge from verifier (SHA-256 + base64url)
function generateCodeChallenge(verifier) {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return hash.toString('base64url');
}

// Generate random state for CSRF protection
function generateState() {
  return crypto.randomBytes(32).toString('base64url');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const clientId = process.env.GARMIN_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ error: 'GARMIN_CLIENT_ID not configured' });
  }

  // Determine redirect URI based on environment
  const isProduction = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';
  const baseUrl = isProduction ? 'https://enduzo.com' : 'http://localhost:3001';
  const redirectUri = `${baseUrl}/api/garmin/callback`;

  // Generate PKCE values
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  // Store code_verifier in a cookie (needed for token exchange)
  // Using httpOnly cookie for security
  const cookieOptions = [
    `garmin_code_verifier=${codeVerifier}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=600', // 10 minutes
    isProduction ? 'Secure' : ''
  ].filter(Boolean).join('; ');

  const stateCookieOptions = [
    `garmin_oauth_state=${state}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=600',
    isProduction ? 'Secure' : ''
  ].filter(Boolean).join('; ');

  res.setHeader('Set-Cookie', [cookieOptions, stateCookieOptions]);

  // Build Garmin authorization URL
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    redirect_uri: redirectUri,
    state: state
  });

  const authUrl = `https://connect.garmin.com/oauth2Confirm?${params.toString()}`;

  // Redirect to Garmin
  res.redirect(302, authUrl);
}
