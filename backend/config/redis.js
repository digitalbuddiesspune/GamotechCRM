import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

/** Set REDIS_ENABLED=false in .env to skip Redis without removing integration code. */
export function isRedisEnabled() {
  const flag = String(process.env.REDIS_ENABLED ?? 'true').trim().toLowerCase();
  return !['false', '0', 'no', 'off'].includes(flag);
}

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT || 6379);
const redisPassword = process.env.REDIS_PASSWORD || undefined;

/** Shared node-redis client (caching / general use). BullMQ still uses ioredis via queue/notification.queue.js. */
const redis = createClient({
  socket: {
    host: redisHost,
    port: redisPort,
  },
  ...(redisPassword ? { password: redisPassword } : {}),
});

redis.on('connect', () => {
  console.log('✅ Redis Connected', `${redisHost}:${redisPort}`);
});

redis.on('error', (err) => {
  console.error('❌ Redis Error:', err?.message || err);
});

let connectPromise = null;

/** Connect once; safe to call repeatedly. Returns null if disabled or unreachable. */
export async function connectRedis() {
  if (!isRedisEnabled()) {
    console.log('ℹ️ Redis disabled (REDIS_ENABLED=false)');
    return null;
  }
  if (redis.isOpen) return redis;
  if (connectPromise) return connectPromise;

  connectPromise = redis
    .connect()
    .then(() => redis)
    .catch((err) => {
      console.error('❌ Redis connect failed:', err?.message || err);
      connectPromise = null;
      return null;
    });

  return connectPromise;
}

export function getRedisClient() {
  if (!isRedisEnabled()) return null;
  return redis.isOpen ? redis : null;
}

export default redis;
