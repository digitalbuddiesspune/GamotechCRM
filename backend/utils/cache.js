import { getRedisClient } from '../config/redis.js';

const DEFAULT_TTL_SECONDS = 120;
const KEY_PREFIX = 'crm:cache';

const stableStringify = (value) => {
  if (value == null) return '';
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${k}:${stableStringify(value[k])}`).join(',')}}`;
};

/** Build a tenant-scoped cache key. */
export const cacheKey = (tenantId, resource, parts = {}) => {
  const tenant = String(tenantId || 'unknown').trim() || 'unknown';
  const res = String(resource || 'data').trim() || 'data';
  const suffix = stableStringify(parts);
  return suffix
    ? `${KEY_PREFIX}:${tenant}:${res}:${suffix}`
    : `${KEY_PREFIX}:${tenant}:${res}`;
};

export async function cacheGet(key) {
  const client = getRedisClient();
  if (!client) return null;
  try {
    const raw = await client.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.warn('[cache] get failed:', err?.message || err);
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const client = getRedisClient();
  if (!client) return false;
  try {
    const payload = JSON.stringify(value);
    const ttl = Math.max(1, Number(ttlSeconds) || DEFAULT_TTL_SECONDS);
    await client.set(key, payload, { EX: ttl });
    return true;
  } catch (err) {
    console.warn('[cache] set failed:', err?.message || err);
    return false;
  }
}

export async function cacheDel(...keys) {
  const client = getRedisClient();
  if (!client) return 0;
  const list = keys.flat().filter(Boolean);
  if (!list.length) return 0;
  try {
    return await client.del(list);
  } catch (err) {
    console.warn('[cache] del failed:', err?.message || err);
    return 0;
  }
}

/** Delete all keys matching a prefix (SCAN + DEL). */
export async function cacheDelByPrefix(prefix) {
  const client = getRedisClient();
  if (!client || !prefix) return 0;
  let deleted = 0;
  try {
    let cursor = '0';
    do {
      // node-redis expects cursor as string
      const result = await client.scan(cursor, {
        MATCH: `${prefix}*`,
        COUNT: 100,
      });
      cursor = String(result.cursor);
      const keys = result.keys || [];
      if (keys.length) {
        deleted += await client.del(keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    console.warn('[cache] delByPrefix failed:', err?.message || err);
  }
  return deleted;
}

/** Invalidate one or more resources for a tenant (all query variants). */
export async function invalidateTenantCache(tenantId, ...resources) {
  const tenant = String(tenantId || '').trim();
  if (!tenant) return 0;
  let total = 0;
  for (const resource of resources.flat().filter(Boolean)) {
    total += await cacheDelByPrefix(`${KEY_PREFIX}:${tenant}:${resource}`);
  }
  return total;
}

/**
 * Cache-aside helper.
 * @param {string} key
 * @param {number} ttlSeconds
 * @param {() => Promise<any>} loader
 */
export async function withCache(key, ttlSeconds, loader) {
  const cached = await cacheGet(key);
  if (cached !== null && cached !== undefined) {
    return { data: cached, cacheHit: true };
  }
  const data = await loader();
  await cacheSet(key, data, ttlSeconds);
  return { data, cacheHit: false };
}

export const CACHE_TTL = {
  designations: 900, // 15 min
  company: 1800, // 30 min
  employees: 180, // 3 min
  clients: 180,
  projects: 180,
  announcements: 120,
  dashboard: 60,
  tasks: 60, // my-tasks / task lists change often
};
