/**
 * Shared Vercel KV client wrapper.
 *
 * @vercel/kv v3 expects KV_REST_API_URL / KV_REST_API_TOKEN.
 * We also support:
 * - legacy Upstash names (UPSTASH_REDIS_REST_*)
 * - Vercel auto-prefixed names (e.g. enduzo_KV_REST_API_*)
 */
import { createClient } from '@vercel/kv';

function findEnv(name) {
  if (process.env[name]) return { value: process.env[name], key: name };

  // Vercel sometimes prefixes KV env vars with the project name, e.g. enduzo_KV_REST_API_URL
  const prefixedKey = Object.keys(process.env).find(
    (key) => key.endsWith(`_${name}`) && process.env[key]
  );
  if (prefixedKey) return { value: process.env[prefixedKey], key: prefixedKey };

  return null;
}

const urlEntry =
  findEnv('KV_REST_API_URL') || findEnv('UPSTASH_REDIS_REST_URL');
const tokenEntry =
  findEnv('KV_REST_API_TOKEN') || findEnv('UPSTASH_REDIS_REST_TOKEN');

const url = urlEntry?.value;
const token = tokenEntry?.value;

export const kvConfig = {
  urlKey: urlEntry?.key || null,
  tokenKey: tokenEntry?.key || null,
  urlHost: url ? new URL(url).host : null
};

function createKvStub() {
  const err = new Error('KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN environment variables.');
  const reject = () => Promise.reject(err);
  return {
    get: reject,
    set: reject,
    del: reject,
    hget: reject,
    hset: reject,
    hdel: reject,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    multi: () => ({ exec: reject }),
  };
}

let kv;

if (!url || !token) {
  console.error(
    'KV: Missing environment variables. Expected KV_REST_API_URL + KV_REST_API_TOKEN ' +
    '(or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, or project-prefixed variants).'
  );
  kv = createKvStub();
} else {
  try {
    kv = createClient({ url, token });
    console.log('KV: Client configured using', urlEntry.key, 'and', tokenEntry.key, '→', kvConfig.urlHost);
  } catch (clientError) {
    console.error('KV: Failed to create KV client:', clientError.message);
    kv = createKvStub();
  }
}

export { kv };
