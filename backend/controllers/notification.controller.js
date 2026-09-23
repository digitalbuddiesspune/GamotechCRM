import CentralAdminUser from '../models/centralAdmin/centralAdmin_user.js';
import PushNotification from '../models/Notification.js';
import notificationService from '../services/notification.service.js';
import {
  enqueueNotificationJob,
  JOB_TYPES,
  isQueueEnabled,
  scheduleNotificationJob,
} from '../queue/notification.queue.js';
import { PUSH_PLATFORMS } from '../utils/pushNotificationFields.js';
import {
  registerUserDeviceToken,
  collectTokensForUserIds,
  removeInvalidTokens,
} from '../utils/pushTokenStore.js';
import {
  buildNotificationFilter,
  buildNotificationSort,
  buildUnreadFilter,
  getNotificationAnalytics,
} from '../utils/notificationAnalytics.js';
import { paginated, success, error } from '../utils/apiResponse.js';
import { ValidationError } from '../utils/errors.js';
import { checkUserDeviceRegisterRate } from '../utils/notificationRateLimit.js';
import { sanitizeNotificationText } from '../utils/companyIsolation.js';
import { buildDedupeKey } from '../utils/notificationDedupe.js';
import { summarizeMeetingChanges } from '../templates/meetingTemplateHelpers.js';
import {
  summarizeBossTeamChanges,
} from '../templates/meetingBossResponse.js';
import logger from '../utils/logger.js';

// ─────────────────────────────────────────────────────────────────────────────
// Device registration (unchanged API contract)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/device/register
 * Body: { deviceToken, platform }
 */
export const registerDevice = async (req, res) => {
  try {
    const auth = req.auth;
    if (!auth?.sub) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const deviceToken = String(req.body?.deviceToken || '').trim();
    const platformRaw = String(req.body?.platform || 'unknown').trim().toLowerCase();
    const platform = PUSH_PLATFORMS.has(platformRaw) ? platformRaw : 'unknown';

    if (!deviceToken) {
      return res.status(400).json({ message: 'deviceToken is required' });
    }

    const rate = await checkUserDeviceRegisterRate(auth.sub);
    if (!rate.allowed) {
      return res.status(429).json({ message: 'Too many device registration attempts' });
    }

    const user = await registerUserDeviceToken(auth.sub, deviceToken, platform);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const entry = (user.notifications || []).find((n) => n.token === deviceToken);

    return res.status(200).json({
      message: 'Device registered',
      device: {
        token: entry?.token,
        platform: entry?.platform,
        lastSeen: entry?.lastSeen,
      },
    });
  } catch (err) {
    return error(res, err, 'Failed to register device');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Notification history
// ─────────────────────────────────────────────────────────────────────────────

/** GET /api/notifications */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.auth.sub;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = buildNotificationFilter(userId, req.query);
    const sort = buildNotificationSort(req.query.sort);

    const [items, total] = await Promise.all([
      PushNotification.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      PushNotification.countDocuments(filter),
    ]);

    return success(res, paginated(items, { page, limit, total }));
  } catch (err) {
    return error(res, err, 'Failed to fetch notifications');
  }
};

/** GET /api/notifications/unread-count */
export const getUnreadCount = async (req, res) => {
  try {
    const count = await PushNotification.countDocuments(buildUnreadFilter(req.auth.sub));
    return success(res, { count });
  } catch (err) {
    return error(res, err, 'Failed to fetch unread count');
  }
};

/** PATCH /api/notifications/:id/read */
export const markNotificationRead = async (req, res) => {
  try {
    const updated = await notificationService.markRead(req.params.id, req.auth.sub);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return success(res, { notification: updated });
  } catch (err) {
    return error(res, err, 'Failed to mark notification as read');
  }
};

/** PATCH /api/notifications/read-all */
export const markAllRead = async (req, res) => {
  try {
    const result = await PushNotification.updateMany(
      { receiver: req.auth.sub, read: false },
      { read: true, readAt: new Date() },
    );
    return success(res, { modifiedCount: result.modifiedCount });
  } catch (err) {
    return error(res, err, 'Failed to mark all as read');
  }
};

/** DELETE /api/notifications/:id */
export const deleteNotification = async (req, res) => {
  try {
    const deleted = await PushNotification.findOneAndDelete({
      _id: req.params.id,
      receiver: req.auth.sub,
    }).lean();

    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    return success(res, { message: 'Notification deleted' });
  } catch (err) {
    return error(res, err, 'Failed to delete notification');
  }
};

/** GET /api/notifications/analytics */
export const getAnalytics = async (req, res) => {
  try {
    const period = req.query.period || 'daily';
    if (!['daily', 'weekly', 'monthly'].includes(period)) {
      throw new ValidationError('Invalid period. Use daily, weekly, or monthly.');
    }
    const stats = await getNotificationAnalytics(req.auth.sub, period);
    return success(res, { analytics: stats });
  } catch (err) {
    return error(res, err, 'Failed to fetch analytics');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Admin broadcast
// ─────────────────────────────────────────────────────────────────────────────

/** POST /api/notifications/broadcast */
export const broadcastNotification = async (req, res) => {
  try {
    const { title, body, userIds, data = {} } = req.body;

    let targetUserIds = userIds;
    if (!targetUserIds?.length) {
      const users = await CentralAdminUser.find({ status: 'Active' }).select('_id').lean();
      targetUserIds = users.map((u) => String(u._id));
    }

    const jobData = {
      userIds: targetUserIds,
      title,
      body,
      extraData: { ...data, type: 'broadcast' },
      senderId: req.auth.sub,
    };

    if (isQueueEnabled()) {
      const result = await enqueueNotificationJob(JOB_TYPES.SYSTEM, jobData);
      return success(res, result, 202);
    }

    const result = await notificationService.sendSystemNotification(jobData);
    return success(res, result, 200);
  } catch (err) {
    return error(res, err, 'Broadcast failed');
  }
};

/** POST /api/notifications/topic */
export const sendTopicNotification = async (req, res) => {
  try {
    const { topic, title, body, data = {}, image } = req.body;

    const payload = {
      title,
      body,
      data: {
        type: 'system',
        screen: 'notifications',
        meetingId: '',
        companyId: String(data.companyId || ''),
        priority: String(data.priority || 'normal'),
        action: 'open_notifications',
        ...data,
      },
      image,
    };

    if (isQueueEnabled()) {
      const result = await enqueueNotificationJob(JOB_TYPES.SEND_TOPIC, { topic, payload });
      return success(res, result, 202);
    }

    const result = await notificationService.sendToTopic(topic, payload);
    return success(res, result, result.success ? 200 : 502);
  } catch (err) {
    return error(res, err, 'Topic notification failed');
  }
};

/** POST /api/notifications/user */
export const sendUserNotification = async (req, res) => {
  try {
    const { userId, title, body, data = {} } = req.body;

    const jobData = {
      userIds: [userId],
      title,
      body,
      extraData: data,
      senderId: req.auth.sub,
    };

    if (isQueueEnabled()) {
      const result = await enqueueNotificationJob(JOB_TYPES.SYSTEM, jobData);
      return success(res, result, 202);
    }

    const result = await notificationService.sendSystemNotification(jobData);
    return success(res, result, 200);
  } catch (err) {
    return error(res, err, 'User notification failed');
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Meeting hooks (preserved — now queue-aware)
// ─────────────────────────────────────────────────────────────────────────────

async function dispatchMeetingJob(type, meeting, senderId = null, extras = {}) {
  const meetingId = String(meeting._id);
  const companyId = String(meeting.companyId || '');
  // Boss response actions can fire back-to-back (attend, then note) — keep keys distinct.
  const dedupeSuffix =
    type === JOB_TYPES.MEETING_BOSS_RESPONSE
      ? String((extras.highlights || []).join('|')).slice(0, 80)
      : '';
  const dedupeKey = buildDedupeKey(
    type,
    dedupeSuffix ? `${meetingId}:${dedupeSuffix}` : meetingId,
  );

  const jobData = { meetingId, senderId, companyId, dedupeKey, ...extras };

  const inlineHandlers = {
    [JOB_TYPES.MEETING_ASSIGNED]: () => notificationService.sendMeetingAssigned(meeting, senderId),
    [JOB_TYPES.MEETING_PENDING]: async () => {
      const coordinators = await CentralAdminUser.find({
        role: 'Meeting Coordinator',
        status: 'Active',
      })
        .select('_id')
        .lean();
      return notificationService.sendMeetingPendingApproval(
        meeting,
        coordinators.map((c) => String(c._id)),
      );
    },
    [JOB_TYPES.MEETING_UPDATED]: () =>
      notificationService.sendMeetingUpdated(meeting, senderId, extras.changes || []),
    [JOB_TYPES.MEETING_CANCELLED]: () => notificationService.sendMeetingCancelled(meeting, senderId),
    [JOB_TYPES.MEETING_BOSS_RESPONSE]: () =>
      notificationService.sendMeetingBossResponse(
        meeting,
        senderId,
        extras.highlights || [],
        extras.recipientUserIds || [],
      ),
  };

  try {
    await enqueueNotificationJob(type, jobData, inlineHandlers[type]);
  } catch (err) {
    logger.notificationFailed({ type, meetingId, error: err?.message });
  }
}

/** Notify assigned users when a meeting is approved / assigned. */
export async function notifyMeetingAssigned(meeting, senderId = null) {
  if (!meeting) return;
  const approval =
    meeting.coordinatorApproval == null ? 'approved' : meeting.coordinatorApproval;
  if (approval !== 'approved') return;
  await dispatchMeetingJob(JOB_TYPES.MEETING_ASSIGNED, meeting, senderId);
}

/** Notify coordinators when a meeting needs approval. */
export async function notifyMeetingPendingApproval(meeting) {
  if (!meeting || meeting.coordinatorApproval !== 'pending') return;
  await dispatchMeetingJob(JOB_TYPES.MEETING_PENDING, meeting);
}

/** Notify when meeting is updated. */
export async function notifyMeetingUpdated(meeting, senderId = null, previous = null) {
  if (!meeting) return;
  const changes = summarizeMeetingChanges(previous, meeting);
  await dispatchMeetingJob(JOB_TYPES.MEETING_UPDATED, meeting, senderId, { changes });
}

/** Notify when meeting is cancelled. */
export async function notifyMeetingCancelled(meeting, senderId = null) {
  if (!meeting) return;
  await dispatchMeetingJob(JOB_TYPES.MEETING_CANCELLED, meeting, senderId);
}

/**
 * Notify organizer (+ Meeting Coordinators) when Boss uses
 * "Confirm for your team" (attend / decline / reschedule / note / important).
 * Never notifies the Boss / sender device.
 */
export async function notifyMeetingBossResponse(
  meeting,
  senderId = null,
  previous = null,
) {
  if (!meeting) return;

  const highlights = summarizeBossTeamChanges(previous, meeting);
  if (!highlights.length) return;

  const bossId = String(meeting.bossId || '');
  const sender = String(senderId || bossId || '');
  const organizerId = String(meeting.organizerId || '');

  const coordinators = await CentralAdminUser.find({
    role: 'Meeting Coordinator',
    status: 'Active',
  })
    .select('_id')
    .lean();

  // Meeting creator first, then coordinators — never Boss/sender.
  const recipientUserIds = [
    organizerId,
    String(meeting.approvedById || ''),
    ...coordinators.map((c) => String(c._id)),
  ].filter((id) => id && id !== bossId && id !== sender);

  const uniqueRecipients = [...new Set(recipientUserIds)];
  if (!uniqueRecipients.length) {
    logger.warn('BossResponseNotify', 'No recipients for boss response', {
      meetingId: String(meeting._id),
      organizerId,
    });
    return;
  }

  await dispatchMeetingJob(
    JOB_TYPES.MEETING_BOSS_RESPONSE,
    meeting,
    sender || null,
    { highlights, recipientUserIds: uniqueRecipients },
  );
}

/** POST /api/notifications/schedule — admin scheduled notification */
export const scheduleNotification = async (req, res) => {
  try {
    const { title, body, userIds, sendAt, data = {}, priority = 'normal' } = req.body;
    const scheduledAt = new Date(sendAt);
    if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
      throw new ValidationError('sendAt must be a future ISO date');
    }

    const delayMs = scheduledAt.getTime() - Date.now();
    const jobData = {
      userIds,
      title: sanitizeNotificationText(title, 200),
      body: sanitizeNotificationText(body, 1000),
      extraData: data,
      senderId: req.auth.sub,
      scheduledFor: scheduledAt.toISOString(),
    };

    if (!isQueueEnabled()) {
      throw new ValidationError('Scheduled notifications require Redis (set REDIS_URL or REDIS_HOST)');
    }

    const result = await scheduleNotificationJob(JOB_TYPES.SYSTEM, jobData, delayMs, priority);
    return success(res, result, 202);
  } catch (err) {
    return error(res, err, 'Schedule failed');
  }
};

// Re-export token helpers for backward compatibility
export { collectTokensForUserIds, removeInvalidTokens };
