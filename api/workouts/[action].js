/**
 * Workouts API - Consolidated handler
 * Uses dynamic routing: /api/workouts/[action]
 * Actions: list, create, update, delete
 */
import { kv } from '@vercel/kv';
import { getSessionFromRequest } from '../_lib/auth.js';

// ============= LIST WORKOUTS =============

async function handleList(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const workoutsKey = `workouts_${session.userId}`;
    const stored = await kv.get(workoutsKey);

    if (!stored) {
      return res.json({ workouts: [] });
    }

    const workouts = typeof stored === 'string' ? JSON.parse(stored) : stored;
    return res.json({ workouts });
  } catch (error) {
    console.error('Error listing workouts:', error);
    return res.status(500).json({ error: 'Failed to list workouts' });
  }
}

// ============= CREATE WORKOUT =============

async function handleCreate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { workout } = req.body;
  if (!workout) {
    return res.status(400).json({ error: 'Workout data required' });
  }

  try {
    const workoutsKey = `workouts_${session.userId}`;
    const stored = await kv.get(workoutsKey);
    const workouts = stored ? (typeof stored === 'string' ? JSON.parse(stored) : stored) : [];

    // Add to beginning (most recent first)
    workouts.unshift(workout);

    await kv.set(workoutsKey, JSON.stringify(workouts));

    return res.json({ success: true, workout });
  } catch (error) {
    console.error('Error creating workout:', error);
    return res.status(500).json({ error: 'Failed to create workout' });
  }
}

// ============= UPDATE WORKOUT =============

async function handleUpdate(req, res) {
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id, updates } = req.body;
  if (!id || !updates) {
    return res.status(400).json({ error: 'Workout id and updates required' });
  }

  try {
    const workoutsKey = `workouts_${session.userId}`;
    const stored = await kv.get(workoutsKey);

    if (!stored) {
      return res.status(404).json({ error: 'No workouts found' });
    }

    const workouts = typeof stored === 'string' ? JSON.parse(stored) : stored;
    const index = workouts.findIndex(w => w.id === id);

    if (index === -1) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    workouts[index] = { ...workouts[index], ...updates };
    await kv.set(workoutsKey, JSON.stringify(workouts));

    return res.json({ success: true, workout: workouts[index] });
  } catch (error) {
    console.error('Error updating workout:', error);
    return res.status(500).json({ error: 'Failed to update workout' });
  }
}

// ============= DELETE WORKOUT =============

async function handleDelete(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'Workout id required' });
  }

  try {
    const workoutsKey = `workouts_${session.userId}`;
    const stored = await kv.get(workoutsKey);

    if (!stored) {
      return res.status(404).json({ error: 'No workouts found' });
    }

    const workouts = typeof stored === 'string' ? JSON.parse(stored) : stored;
    const filtered = workouts.filter(w => w.id !== id);

    if (filtered.length === workouts.length) {
      return res.status(404).json({ error: 'Workout not found' });
    }

    await kv.set(workoutsKey, JSON.stringify(filtered));

    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting workout:', error);
    return res.status(500).json({ error: 'Failed to delete workout' });
  }
}

// ============= SYNC (bulk replace) =============

async function handleSync(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const session = getSessionFromRequest(req);
  if (!session?.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const { workouts } = req.body;
  if (!Array.isArray(workouts)) {
    return res.status(400).json({ error: 'Workouts array required' });
  }

  try {
    const workoutsKey = `workouts_${session.userId}`;
    await kv.set(workoutsKey, JSON.stringify(workouts));

    return res.json({ success: true, count: workouts.length });
  } catch (error) {
    console.error('Error syncing workouts:', error);
    return res.status(500).json({ error: 'Failed to sync workouts' });
  }
}

// ============= MAIN HANDLER =============

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { action } = req.query;

  switch (action) {
    case 'list':
      return handleList(req, res);
    case 'create':
      return handleCreate(req, res);
    case 'update':
      return handleUpdate(req, res);
    case 'delete':
      return handleDelete(req, res);
    case 'sync':
      return handleSync(req, res);
    default:
      return res.status(404).json({ error: `Unknown action: ${action}` });
  }
}
