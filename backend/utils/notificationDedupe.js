/**
 * Notification deduplication — prevents burst duplicates (e.g. rapid meeting updates).
 * Uses Redis when available; in-memory fallback for development.
 * @module utils/notificationDedupe
 */
import { getRedisConnection } from '../queue/notification.queue.js';
import { DEDUPE_WINDOWS_MS } from './notificationConstants.js';
import logger from './logger.js';

/** @type {Map<string, number>} */
const memoryCache = new Map();

/**
 * Build a dedupe key for a notification event.
 * @param {string} type
 * @param {string} entityId
 * @param {string} [receiverId]
 */
export function buildDedupeKey(type, entityId, receiverId = '') {
  return receiverId
    ? `${type}:${entityId}:${receiverId}`
    : `${type}:${entityId}`;
}

/**
 * Returns true if this notification was recently sent (should be skipped).
 * @param {string} dedupeKey
 * @param {string} [type] - notification type for window lookup
 */
export async function isDuplicateNotification(dedupeKey, type = 'default') {
  const windowMs = DEDUPE_WINDOWS_MS[type] || DEDUPE_WINDOWS_MS.default;
  const redis = getRedisConnection();

  if (redis) {
    try {
      const redisKey = `notif:dedupe:${dedupeKey}`;
      const exists = await redis.set(redisKey, '1', 'PX', windowMs, 'NX');
      if (exists === null) {
        logger.debug('DedupeSkip', 'Duplicate notification suppressed', { dedupeKey });
        return true;
      }
      return false;
    } catch (error) {
      logger.warn('DedupeFallback', 'Redis dedupe failed — using memory', { error: error?.message });
    }
  }

  const now = Date.now();
  const expiresAt = memoryCache.get(dedupeKey);
  if (expiresAt && expiresAt > now) {
    logger.debug('DedupeSkip', 'Duplicate notification suppressed (memory)', { dedupeKey });
    return true;
  }

  memoryCache.set(dedupeKey, now + windowMs);
  pruneMemoryCache(now);
  return false;
}

function pruneMemoryCache(now) {
  if (memoryCache.size < 5000) return;
  for (const [key, expiresAt] of memoryCache.entries()) {
    if (expiresAt <= now) memoryCache.delete(key);
  }
}
