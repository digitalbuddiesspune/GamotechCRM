/**
 * Rate limiting for notification endpoints and send pipeline.
 * @module utils/notificationRateLimit
 */
import { getRedisConnection } from '../queue/notification.queue.js';
import { RATE_LIMITS } from './notificationConstants.js';
import logger from './logger.js';

/** @type {Map<string, { count: number, resetAt: number }>} */
const memoryBuckets = new Map();

/**
 * Check and increment rate limit bucket.
 * @param {string} bucketKey
 * @param {number} maxPerWindow
 * @param {number} windowMs
 * @returns {Promise<{ allowed: boolean, remaining: number, resetAt: number }>}
 */
export async function checkRateLimit(bucketKey, maxPerWindow, windowMs) {
  const redis = getRedisConnection();

  if (redis) {
    try {
      const key = `notif:ratelimit:${bucketKey}`;
      const count = await redis.incr(key);
      if (count === 1) {
        await redis.pexpire(key, windowMs);
      }
      const ttl = await redis.pttl(key);
      const allowed = count <= maxPerWindow;
      if (!allowed) {
        logger.warn('RateLimit', 'Rate limit exceeded', { bucketKey, count });
      }
      return {
        allowed,
        remaining: Math.max(0, maxPerWindow - count),
        resetAt: Date.now() + Math.max(ttl, 0),
      };
    } catch (error) {
      logger.warn('RateLimitFallback', 'Redis rate limit failed — using memory', {
        error: error?.message,
      });
    }
  }

  const now = Date.now();
  let bucket = memoryBuckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
  }
  bucket.count += 1;
  memoryBuckets.set(bucketKey, bucket);

  const allowed = bucket.count <= maxPerWindow;
  if (!allowed) {
    logger.warn('RateLimit', 'Rate limit exceeded (memory)', { bucketKey, count: bucket.count });
  }

  return {
    allowed,
    remaining: Math.max(0, maxPerWindow - bucket.count),
    resetAt: bucket.resetAt,
  };
}

/** Rate limit for outbound sends per company. */
export async function checkCompanySendRate(companyId) {
  const limits = RATE_LIMITS.company;
  return checkRateLimit(`company:${companyId || 'global'}`, limits.max, limits.windowMs);
}

/** Rate limit for sends initiated by a user. */
export async function checkSenderRate(senderId) {
  const limits = RATE_LIMITS.sender;
  return checkRateLimit(`sender:${senderId}`, limits.max, limits.windowMs);
}

/** Rate limit for device registration per user. */
export async function checkUserDeviceRegisterRate(userId) {
  const limits = RATE_LIMITS.deviceRegister;
  return checkRateLimit(`device:${userId}`, limits.max, limits.windowMs);
}

/** Express middleware factory for API rate limiting. */
export function createRateLimitMiddleware(getBucketKey, limitConfig) {
  return async (req, res, next) => {
    try {
      const key = getBucketKey(req);
      const result = await checkRateLimit(key, limitConfig.max, limitConfig.windowMs);
      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', String(result.resetAt));
      if (!result.allowed) {
        return res.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
        });
      }
      return next();
    } catch (error) {
      return next();
    }
  };
}
