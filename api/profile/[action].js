/**
 * Profile API - Consolidated handler
 * Uses dynamic routing: /api/profile/[action]
 * Actions: get, save
 */
import { kv } from '@vercel/kv';
import { getSessionFromRequest } from '../_lib/auth.js';

// ============= GET PROFILE =============

async function handleGet(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const profileKey = `profile_${session.userId}`;
    const stored = await kv.get(profileKey);

    if (!stored) {
      // Return null to indicate no profile exists yet
      return res.json({ profile: null });
    }

    const profile = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return res.json({ profile });
  } catch (error) {
    console.error('Error getting profile:', error);
    return res.status(500).json({ error: 'Failed to get profile' });
  }
}

// ============= SAVE PROFILE =============

async function handleSave(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { profile } = req.body;
  if (!profile) {
    return res.status(400).json({ error: 'Profile data required' });
  }

  try {
    const profileKey = `profile_${session.userId}`;

    // Add metadata
    const profileToSave = {
      ...profile,
      userId: session.userId,
      lastUpdated: new Date().toISOString()
    };

    await kv.set(profileKey, JSON.stringify(profileToSave));

    return res.json({ success: true, profile: profileToSave });
  } catch (error) {
    console.error('Error saving profile:', error);
    return res.status(500).json({ error: 'Failed to save profile' });
  }
}

// ============= MAIN HANDLER =============

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  switch (action) {
    case 'get':
      return handleGet(req, res);
    case 'save':
      return handleSave(req, res);
    default:
      return res.status(404).json({ error: `Unknown action: ${action}` });
  }
}
