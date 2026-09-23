import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { QueueError } from '../utils/errors.js';
import { toQueuePriority } from '../utils/fcmMessageBuilder.js';
import logger from '../utils/logger.js';

/** @type {Queue | null} */
let notificationQueue = null;
/** @type {IORedis | null} */
let redisConnection = null;

export const QUEUE_NAME = 'push-notifications';

export const JOB_TYPES = {
  SEND_DEVICE: 'send_device',
  SEND_MULTICAST: 'send_multicast',
  SEND_TOPIC: 'send_topic',
  MEETING_ASSIGNED: 'meeting_assigned',
  MEETING_REMINDER: 'meeting_reminder',
  MEETING_UPDATED: 'meeting_updated',
  MEETING_CANCELLED: 'meeting_cancelled',
  MEETING_PENDING: 'meeting_pending',
  MEETING_BOSS_RESPONSE: 'meeting_boss_response',
  SYSTEM: 'system_notification',
};

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 200,
};

/**
 * Resolve Redis URL from REDIS_URL or REDIS_HOST + REDIS_PORT.
 * @returns {string | null}
 */
export function getRedisUrl() {
  const fromUrl = String(process.env.REDIS_URL || '').trim();
  if (fromUrl) return fromUrl;

  const host = String(process.env.REDIS_HOST || '').trim();
  if (!host) return null;

  const port = Number(process.env.REDIS_PORT || 6379);
  const password = String(process.env.REDIS_PASSWORD || '').trim();
  if (password) {
    return `redis://:${encodeURIComponent(password)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

/**
 * Create Redis connection for BullMQ (ioredis).
 * @returns {IORedis | null}
 */
export function getRedisConnection() {
  if (redisConnection) return redisConnection;

  const redisUrl = getRedisUrl();
  if (!redisUrl) return null;

  redisConnection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });

  return redisConnection;
}

/** @returns {boolean} */
export function isQueueEnabled() {
  return Boolean(getRedisUrl());
}

/**
 * Get or create the notification queue singleton.
 * @returns {Queue | null}
 */
export function getNotificationQueue() {
  if (notificationQueue) return notificationQueue;

  const connection = getRedisConnection();
  if (!connection) return null;

  notificationQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  logger.info('QueueInit', 'Notification queue initialized', { name: QUEUE_NAME });
  return notificationQueue;
}

/**
 * Enqueue a notification job. Falls back to inline handler when Redis is unavailable.
 * @param {string} name
 * @param {object} data
 * @param {Function} [inlineHandler]
 * @param {string} [priority='normal']
 */
export async function enqueueNotificationJob(name, data, inlineHandler, priority = 'normal') {
  const queue = getNotificationQueue();

  if (!queue) {
    if (inlineHandler) {
      logger.warn('QueueFallback', 'Redis unavailable — processing inline', { name });
      return inlineHandler(data);
    }
    throw new QueueError('Notification queue unavailable and no inline handler provided');
  }

  const job = await queue.add(name, data, {
    ...DEFAULT_JOB_OPTIONS,
    priority: toQueuePriority(priority),
  });
  logger.info('QueueEnqueued', 'Notification job enqueued', { name, jobId: job.id, priority });
  return { queued: true, jobId: job.id };
}

/**
 * Schedule a notification job for future delivery.
 * @param {string} name
 * @param {object} data
 * @param {number} delayMs
 * @param {string} [priority='normal']
 */
export async function scheduleNotificationJob(name, data, delayMs, priority = 'normal') {
  const queue = getNotificationQueue();
  if (!queue) {
    throw new QueueError('Scheduled notifications require Redis (set REDIS_URL or REDIS_HOST)');
  }

  const job = await queue.add(name, data, {
    ...DEFAULT_JOB_OPTIONS,
    delay: delayMs,
    priority: toQueuePriority(priority),
  });

  logger.info('QueueScheduled', 'Notification job scheduled', {
    name,
    jobId: job.id,
    delayMs,
    priority,
  });

  return { queued: true, jobId: job.id, scheduledFor: data.scheduledFor };
}

export async function closeNotificationQueue() {
  if (notificationQueue) {
    await notificationQueue.close();
    notificationQueue = null;
  }
  if (redisConnection) {
    await redisConnection.quit();
    redisConnection = null;
  }
}
