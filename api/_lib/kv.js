/**
 * Shared Vercel KV client wrapper.
 *
 * @vercel/kv v3 expects KV_REST_API_URL / KV_REST_API_TOKEN.
 * We also support the legacy Upstash names (UPSTASH_REDIS_REST_*)
 * so existing environments keep working.
 */
import { createClient } from '@vercel/kv';

const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

export const kv = createClient({ url, token });
