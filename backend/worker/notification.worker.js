import { Worker } from 'bullmq';
import notificationService from '../services/notification.service.js';
import CentralAdminUser from '../models/centralAdmin/centralAdmin_user.js';
import CentralMeeting from '../models/centralAdmin/centralAdmin_meeting.js';
import {
  getRedisConnection,
  isQueueEnabled,
  JOB_TYPES,
  QUEUE_NAME,
} from '../queue/notification.queue.js';
import { isNonRetryableFirebaseError } from '../utils/errors.js';
import logger from '../utils/logger.js';

/**
 * Process a notification queue job.
 * @param {import('bullmq').Job} job
 */
async function processJob(job) {
  const { name, data } = job;

  switch (name) {
    case JOB_TYPES.SEND_DEVICE: {
      const result = await notificationService.sendToDevice(data.token, data.payload);
      if (!result.success && result.retryable !== false) throw result.error;
      return result;
    }

    case JOB_TYPES.SEND_MULTICAST: {
      const result = await notificationService.sendToMultipleDevices(data.tokens, data.payload);
      if (result.failureCount > 0 && result.successCount === 0) {
        throw new Error('All multicast deliveries failed');
      }
      if (data.tokenOwnerMap && result.invalidTokens?.length) {
        const map = new Map(Object.entries(data.tokenOwnerMap));
        await notificationService.removeInvalidToken(result.invalidTokens, map);
      }
      return result;
    }

    case JOB_TYPES.SEND_TOPIC: {
      const result = await notificationService.sendToTopic(data.topic, data.payload);
      if (!result.success) throw result.error;
      return result;
    }

    case JOB_TYPES.MEETING_ASSIGNED: {
      const meeting = data.meetingId
        ? await CentralMeeting.findById(data.meetingId).lean()
        : data.meeting;
      return notificationService.sendMeetingAssigned(meeting, data.senderId);
    }

    case JOB_TYPES.MEETING_REMINDER: {
      const meeting = await CentralMeeting.findById(data.meetingId).lean();
      return notificationService.sendMeetingReminder(meeting);
    }

    case JOB_TYPES.MEETING_UPDATED: {
      const meeting = await CentralMeeting.findById(data.meetingId).lean();
      return notificationService.sendMeetingUpdated(
        meeting,
        data.senderId,
        data.changes || [],
      );
    }

    case JOB_TYPES.MEETING_CANCELLED: {
      const meeting = await CentralMeeting.findById(data.meetingId).lean();
      return notificationService.sendMeetingCancelled(meeting, data.senderId);
    }

    case JOB_TYPES.MEETING_BOSS_RESPONSE: {
      const meeting = await CentralMeeting.findById(data.meetingId).lean();
      return notificationService.sendMeetingBossResponse(
        meeting,
        data.senderId,
        data.highlights || [],
        data.recipientUserIds || [],
      );
    }

    case JOB_TYPES.MEETING_PENDING: {
      const meeting = await CentralMeeting.findById(data.meetingId).lean();
      const coordinators = await CentralAdminUser.find({
        role: 'Meeting Coordinator',
        status: 'Active',
      })
        .select('_id')
        .lean();
      const userIds = coordinators.map((c) => String(c._id));
      return notificationService.sendMeetingPendingApproval(meeting, userIds);
    }

    case JOB_TYPES.SYSTEM: {
      return notificationService.sendSystemNotification(data);
    }

    default:
      throw new Error(`Unknown job type: ${name}`);
  }
}

/** @type {Worker | null} */
let worker = null;

/**
 * Start BullMQ worker (only when Redis is configured).
 * @returns {Worker | null}
 */
export function startNotificationWorker() {
  if (worker) return worker;
  if (!isQueueEnabled()) {
    logger.warn('WorkerInit', 'Redis not configured — notification worker disabled (set REDIS_URL or REDIS_HOST)');
    return null;
  }

  const connection = getRedisConnection();
  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      try {
        const result = await processJob(job);
        logger.queueSuccess({ jobId: job.id, name: job.name });
        return result;
      } catch (error) {
        logger.queueFailure({ jobId: job.id, name: job.name, error: error?.message });
        if (isNonRetryableFirebaseError(error)) {
          // BullMQ won't retry if we don't throw — mark complete with failure logged.
          return { success: false, nonRetryable: true };
        }
        throw error;
      }
    },
    {
      connection,
      concurrency: Number(process.env.NOTIFICATION_WORKER_CONCURRENCY || 5),
    },
  );

  worker.on('failed', (job, error) => {
    logger.queueFailure({ jobId: job?.id, name: job?.name, error: error?.message });
  });

  logger.info('WorkerInit', 'Notification worker started');
  return worker;
}

export async function stopNotificationWorker() {
  if (worker) {
    await worker.close();
    worker = null;
  }
}

export default startNotificationWorker;
