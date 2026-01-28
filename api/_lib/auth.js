/**
 * Shared authentication utilities for API endpoints
 */
import { kv } from '@vercel/kv';

const SESSION_COOKIE_NAME = 'enduzo_session';
const SESSION_MAX_AGE = 90 * 24 * 60 * 60; // 90 days in seconds

/**
 * Parse cookies from header string
 */
export function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name] = rest.join('=');
    }
  });
  return cookies;
}

/**
 * Check if running in secure environment (Vercel production/preview)
 */
export function isSecureEnvironment() {
  return process.env.VERCEL_ENV === 'production' || process.env.VERCEL_ENV === 'preview';
}

/**
 * Create session cookie string
 */
export function createSessionCookie(sessionData) {
  const encoded = Buffer.from(JSON.stringify(sessionData)).toString('base64');
  const parts = [
    `${SESSION_COOKIE_NAME}=${encoded}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE}`
  ];
  if (isSecureEnvironment()) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Create cookie string to clear the session
 */
export function clearSessionCookie() {
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    'Max-Age=0'
  ];
  if (isSecureEnvironment()) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Parse session from request cookies
 * @returns {object|null} Session data or null if not found/invalid
 */
export function getSessionFromRequest(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionCookie = cookies[SESSION_COOKIE_NAME];

  if (!sessionCookie) return null;

  try {
    return JSON.parse(Buffer.from(sessionCookie, 'base64').toString());
  } catch {
    return null;
  }
}

/**
 * Create or update user in Vercel KV
 * @param {object} userData - User data to store
 * @returns {Promise<object>} The stored user
 */
export async function createOrUpdateUser(userData) {
  const userKey = `user_${userData.id}`;

  try {
    const existingRaw = await kv.get(userKey);
    const existingUser = typeof existingRaw === 'string' ? JSON.parse(existingRaw) : existingRaw;

    if (existingUser) {
      // Update existing user
      const updated = {
        ...existingUser,
        ...userData,
        lastLoginAt: new Date().toISOString()
      };
      await kv.set(userKey, JSON.stringify(updated));
      return updated;
    }

    // Create new user
    const newUser = {
      ...userData,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };
    await kv.set(userKey, JSON.stringify(newUser));
    return newUser;
  } catch (error) {
    console.error('Error creating/updating user:', error);
    throw error;
  }
}

/**
 * Get user by ID from Vercel KV
 * @param {string} userId - User ID
 * @returns {Promise<object|null>} User data or null
 */
export async function getUserById(userId) {
  try {
    const stored = await kv.get(`user_${userId}`);
    if (!stored) return null;
    return typeof stored === 'string' ? JSON.parse(stored) : stored;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

/**
 * Find user by provider ID (secondary index lookup)
 * @param {string} provider - Provider name ('garmin' or 'strava')
 * @param {string} providerId - Provider-specific user ID
 * @returns {Promise<object|null>} User data or null
 */
export async function findUserByProviderId(provider, providerId) {
  try {
    const lookupKey = `provider_lookup_${provider}_${providerId}`;
    const userId = await kv.get(lookupKey);
    if (!userId) return null;
    return getUserById(userId);
  } catch (error) {
    console.error('Error finding user by provider:', error);
    return null;
  }
}

/**
 * Create provider lookup index (for finding users by provider ID)
 * @param {string} provider - Provider name ('garmin' or 'strava')
 * @param {string} providerId - Provider-specific user ID
 * @param {string} userId - Internal user ID
 */
export async function createProviderLookup(provider, providerId, userId) {
  try {
    const lookupKey = `provider_lookup_${provider}_${providerId}`;
    await kv.set(lookupKey, userId);
  } catch (error) {
    console.error('Error creating provider lookup:', error);
    throw error;
  }
}

/**
 * Link an additional provider to an existing user
 * @param {string} userId - Internal user ID
 * @param {string} provider - Provider to link ('garmin' or 'strava')
 * @param {string} providerId - Provider-specific user ID
 * @returns {Promise<object>} Updated user
 */
export async function linkProviderToUser(userId, provider, providerId) {
  const user = await getUserById(userId);
  if (!user) {
    throw new Error('User not found');
  }

  // Add to linkedProviders if not already present
  const linkedProviders = user.linkedProviders || [user.authProvider];
  if (!linkedProviders.includes(provider)) {
    linkedProviders.push(provider);
  }

  // Update provider-specific ID
  const providerIdField = provider === 'garmin' ? 'garminUserId' : 'stravaAthleteId';

  const updatedUser = await createOrUpdateUser({
    ...user,
    linkedProviders,
    [providerIdField]: providerId
  });

  // Create lookup for the new provider
  await createProviderLookup(provider, providerId, userId);

  return updatedUser;
}
