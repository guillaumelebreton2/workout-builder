/**
 * Public share endpoint
 * Reads a shared workout by token without authentication
 */
import { kv } from './_lib/kv.js';

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }

  try {
    const shareKey = `share_${token}`;
    const stored = await kv.get(shareKey);

    if (!stored) {
      return res.status(404).json({ error: 'Share not found' });
    }

    const shareData = typeof stored === 'string' ? JSON.parse(stored) : stored;

    if (shareData.expiresAt && new Date(shareData.expiresAt).getTime() < Date.now()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    return res.json({
      token: shareData.token,
      workout: shareData.workout,
      createdAt: shareData.createdAt,
      expiresAt: shareData.expiresAt
    });
  } catch (error) {
    console.error('Error reading share:', error);
    return res.status(500).json({ error: 'Failed to read share' });
  }
}
