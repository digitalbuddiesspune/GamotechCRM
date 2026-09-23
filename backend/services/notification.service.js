import { getMessaging } from '../config/firebase.js';
import PushNotification from '../models/Notification.js';
import CentralAdminUser from '../models/centralAdmin/centralAdmin_user.js';
import { meetingAssignedTemplate } from '../templates/meetingAssigned.js';
import { meetingReminderTemplate } from '../templates/meetingReminder.js';
import { meetingCancelledTemplate } from '../templates/meetingCancelled.js';
import { meetingUpdatedTemplate } from '../templates/meetingUpdated.js';
import { meetingPendingApprovalTemplate } from '../templates/meetingPendingApproval.js';
import { meetingBossResponseTemplate } from '../templates/meetingBossResponse.js';
import { systemNotificationTemplate } from '../templates/systemNotification.js';
import {
  collectTokensForUserIds,
  removeInvalidTokens,
} from '../utils/pushTokenStore.js';
import {
  DEFAULT_CLICK_ACTION,
  INVALID_TOKEN_ERROR_CODES,
  MULTICAST_BATCH_SIZE,
} from '../utils/notificationConstants.js';
import { buildFcmMessage } from '../utils/fcmMessageBuilder.js';
import { FirebaseError, isRetryableError } from '../utils/errors.js';
import pipeline from './notificationPipeline.service.js';
import logger from '../utils/logger.js';

/**
 * Production FCM notification service (singleton).
 * Persists history, supports templates, preferences, and structured responses.
 */
class NotificationService {
  _messaging() {
    const messaging = getMessaging();
    if (!messaging) {
      throw new FirebaseError('Firebase Admin SDK is not initialized');
    }
    return messaging;
  }

  _buildMessage(payload) {
    return buildFcmMessage({
      clickAction: DEFAULT_CLICK_ACTION,
      channelId: 'meeting_app_high_importance',
      ...payload,
    });
  }

  _extractInvalidTokensFromSendError(error, token) {
    const code = error?.code || error?.errorInfo?.code;
    if (code && INVALID_TOKEN_ERROR_CODES.has(code)) return [token];
    return [];
  }

  _extractInvalidTokensFromBatchResponse(tokens, response) {
    const invalid = [];
    response?.responses?.forEach((item, index) => {
      if (item.success) return;
      const code = item.error?.code;
      if (code && INVALID_TOKEN_ERROR_CODES.has(code)) {
        invalid.push(tokens[index]);
        logger.warn('InvalidToken', 'Invalid FCM token', { code, token: tokens[index]?.slice(0, 12) });
      } else if (item.error) {
        logger.notificationFailed({ code: item.error.code, message: item.error.message });
      }
    });
    return invalid;
  }

  /**
   * Persist notification record before/after send.
   * @param {object} doc
   */
  async saveNotification(doc) {
    return PushNotification.create(doc);
  }

  /**
   * Mark a notification as read for a user.
   * @param {string} notificationId
   * @param {string} userId
   */
  async markRead(notificationId, userId) {
    return PushNotification.findOneAndUpdate(
      { _id: notificationId, receiver: userId },
      { read: true, readAt: new Date() },
      { new: true },
    ).lean();
  }

  /**
   * Remove invalid tokens from user documents.
   * @param {string[]} invalidTokens
   * @param {Map<string,string>} tokenOwnerMap
   */
  async removeInvalidToken(invalidTokens, tokenOwnerMap) {
    await removeInvalidTokens(invalidTokens, tokenOwnerMap);
    return { removed: invalidTokens.length };
  }

  /**
   * Send to a single device token.
   * @returns {Promise<{ success: boolean, messageId?: string, invalidTokens: string[], retryable?: boolean, error?: Error }>}
   */
  async sendToDevice(token, payload = {}) {
    if (!token?.trim()) {
      return { success: false, invalidTokens: [], error: new Error('Device token is required') };
    }

    try {
      const messaging = this._messaging();
      const message = this._buildMessage({ token: token.trim(), ...payload });
      const messageId = await messaging.send(message);
      logger.notificationSent({ token: token.slice(0, 12), messageId });
      return { success: true, messageId, invalidTokens: [] };
    } catch (error) {
      const invalidTokens = this._extractInvalidTokensFromSendError(error, token.trim());
      if (invalidTokens.length) logger.tokenRemoved({ token: token.slice(0, 12) });
      else logger.notificationFailed({ error: error?.message });
      return {
        success: false,
        error,
        invalidTokens,
        retryable: isRetryableError(error),
      };
    }
  }

  /**
   * Send to multiple devices using batched sendEachForMulticast.
   * @returns {Promise<{ successCount: number, failureCount: number, invalidTokens: string[] }>}
   */
  async sendToMultipleDevices(tokens = [], payload = {}) {
    const uniqueTokens = [...new Set(tokens.map((t) => String(t || '').trim()).filter(Boolean))];
    if (!uniqueTokens.length) {
      return { successCount: 0, failureCount: 0, invalidTokens: [] };
    }

    const messaging = this._messaging();
    const invalidTokens = [];
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < uniqueTokens.length; i += MULTICAST_BATCH_SIZE) {
      const batch = uniqueTokens.slice(i, i + MULTICAST_BATCH_SIZE);
      const message = this._buildMessage({ ...payload });
      delete message.token;
      delete message.topic;

      try {
        const response = await messaging.sendEachForMulticast({ ...message, tokens: batch });
        successCount += response.successCount;
        failureCount += response.failureCount;
        invalidTokens.push(...this._extractInvalidTokensFromBatchResponse(batch, response));
        logger.notificationSent({
          batch: batch.length,
          success: response.successCount,
          failed: response.failureCount,
        });
      } catch (error) {
        failureCount += batch.length;
        logger.notificationFailed({
          error: error?.message || String(error),
          code: error?.code || error?.errorInfo?.code,
          batch: batch.length,
        });
      }
    }

    return {
      successCount,
      failureCount,
      invalidTokens: [...new Set(invalidTokens)],
    };
  }

  /**
   * Send to an FCM topic.
   * @returns {Promise<{ success: boolean, messageId?: string, error?: Error }>}
   */
  async sendToTopic(topic, payload = {}) {
    if (!topic?.trim()) {
      return { success: false, error: new Error('Topic is required') };
    }

    try {
      const messaging = this._messaging();
      const message = this._buildMessage({ topic: topic.trim(), ...payload });
      const messageId = await messaging.send(message);
      logger.notificationSent({ topic, messageId });
      return { success: true, messageId };
    } catch (error) {
      logger.notificationFailed({ topic, error: error?.message });
      return { success: false, error, retryable: isRetryableError(error) };
    }
  }

  async subscribeToTopic(tokens = [], topic) {
    const uniqueTokens = [...new Set(tokens.map((t) => String(t || '').trim()).filter(Boolean))];
    if (!uniqueTokens.length || !topic?.trim()) {
      return { success: false, error: new Error('Tokens and topic are required') };
    }

    try {
      const messaging = this._messaging();
      const response = await messaging.subscribeToTopic(uniqueTokens, topic.trim());
      return { success: true, response };
    } catch (error) {
      logger.notificationFailed({ action: 'subscribe', topic, error: error?.message });
      return { success: false, error };
    }
  }

  async unsubscribeFromTopic(tokens = [], topic) {
    const uniqueTokens = [...new Set(tokens.map((t) => String(t || '').trim()).filter(Boolean))];
    if (!uniqueTokens.length || !topic?.trim()) {
      return { success: false, error: new Error('Tokens and topic are required') };
    }

    try {
      const messaging = this._messaging();
      const response = await messaging.unsubscribeFromTopic(uniqueTokens, topic.trim());
      return { success: true, response };
    } catch (error) {
      logger.notificationFailed({ action: 'unsubscribe', topic, error: error?.message });
      return { success: false, error };
    }
  }

  /**
   * Send templated push to multiple receivers and persist history.
   * @private
   */
  async _sendToUsers({
    userIds,
    type,
    template,
    senderId = null,
    meeting = null,
    clickAction = DEFAULT_CLICK_ACTION,
    expiresAt = null,
    excludeSenderTokens = false,
  }) {
    const companyId = String(meeting?.companyId || '');
    const entityId = String(meeting?._id || meeting?.id || type);

    let eligibleUserIds = [...new Set(userIds.map(String).filter(Boolean))];
    // Never deliver boss-response style alerts back to the actor/Boss.
    if (type === 'meeting_boss_response') {
      const bossId = String(meeting?.bossId || '');
      const sender = String(senderId || '');
      eligibleUserIds = eligibleUserIds.filter(
        (id) => id && id !== bossId && id !== sender,
      );
    }

    eligibleUserIds = await pipeline.resolveEligibleRecipients(eligibleUserIds, companyId);

    const guard = await pipeline.runPreSendGuards({
      type,
      entityId,
      userIds: eligibleUserIds,
      companyId,
      senderId,
    });

    if (guard.skip) {
      return { sent: false, reason: guard.reason };
    }

    if (!eligibleUserIds.length) {
      return { sent: false, reason: 'no_recipients' };
    }

    const tpl = template({ meeting });
    const priority = tpl.priority || 'normal';

    // In-app realtime toast/event (does not replace FCM).
    const socketPayload = {
      title: tpl.title,
      body: tpl.body,
      type,
      data: tpl.data,
      priority,
    };
    pipeline.deliverRealtime(eligibleUserIds, socketPayload);

    // Always attempt FCM for every eligible user that has a device token.
    // Socket "online" only means the app process is connected — the user may
    // still need a system tray push (background / screen off / other tab).
    let { tokens, tokenOwnerMap } = await collectTokensForUserIds(
      eligibleUserIds,
      type,
    );

    // Same phone used by Boss + staff: drop tokens still attached to sender.
    if (excludeSenderTokens && senderId && tokens.length) {
      const senderUser = await CentralAdminUser.findById(senderId)
        .select('notifications')
        .lean();
      const senderTokenSet = new Set(
        (senderUser?.notifications || [])
          .map((n) => String(n?.token || '').trim())
          .filter(Boolean),
      );
      if (senderTokenSet.size) {
        tokens = tokens.filter((t) => !senderTokenSet.has(t));
        for (const t of senderTokenSet) tokenOwnerMap.delete(t);
      }
    }

    const reminderExpiry =
      type === 'meeting_reminder' && meeting?.endAt
        ? new Date(meeting.endAt)
        : expiresAt;

    const records = eligibleUserIds.map((receiverId) => ({
      receiver: receiverId,
      sender: senderId,
      title: tpl.title,
      body: tpl.body,
      type,
      meetingId: tpl.data?.meetingId || '',
      companyId: tpl.data?.companyId || companyId,
      priority,
      status: tokens.length ? 'queued' : 'failed',
      data: tpl.data,
      image: tpl.image || '',
      dedupeKey: guard.dedupeKey || '',
      expiresAt: reminderExpiry,
      deliveryChannel: tokens.length ? 'both' : 'socket',
      error: tokens.length ? '' : 'No device tokens',
    }));

    const saved = records.length ? await PushNotification.insertMany(records) : [];

    await Promise.all(
      saved.map((doc) =>
        pipeline.logAudit({
          event: 'created',
          notificationId: doc._id,
          createdBy: senderId,
          receiverId: doc.receiver,
          companyId,
          type,
          meetingId: doc.meetingId,
          channel: doc.deliveryChannel,
        }),
      ),
    );

    if (!tokens.length) {
      return {
        sent: false,
        reason: 'no_tokens',
        notifications: saved,
      };
    }

    const result = await this.sendToMultipleDevices(tokens, {
      title: tpl.title,
      body: tpl.body,
      data: tpl.data,
      image: tpl.image,
      clickAction,
      priority,
      collapseKey: `${type}_${entityId}`,
      ttlSeconds: priority === 'critical' ? 86400 : 3600,
    });

    if (result.invalidTokens?.length) {
      await this.removeInvalidToken(result.invalidTokens, tokenOwnerMap);
    }

    const status = result.successCount > 0 ? 'sent' : 'failed';
    if (saved.length) {
      await PushNotification.updateMany(
        { _id: { $in: saved.map((n) => n._id) } },
        {
          $set: {
            status,
            deliveredAt: status === 'sent' ? new Date() : null,
            error: status === 'failed' ? 'FCM delivery failed' : '',
            deliveryChannel: status === 'sent' ? 'both' : 'socket',
          },
        },
      );
    }

    return { sent: result.successCount > 0, ...result, notifications: saved };
  }

  /** @param {object} meeting */
  async sendMeetingAssigned(meeting, senderId = null) {
    if (!meeting) return { sent: false };
    const approval =
      meeting.coordinatorApproval == null ? 'approved' : meeting.coordinatorApproval;
    if (approval !== 'approved') return { sent: false, reason: 'not_approved' };

    const userIds = [meeting.bossId, meeting.organizerId].filter(Boolean);
    return this._sendToUsers({
      userIds,
      type: 'meeting_assigned',
      template: (ctx) => meetingAssignedTemplate(ctx),
      senderId,
      meeting,
    });
  }

  /** Backward-compatible alias used by existing meeting hooks. */
  async sendMeetingAssignedNotification(meeting, deps) {
    if (deps?.collectTokens && deps?.removeInvalidTokens) {
      return this.sendMeetingAssigned(meeting);
    }
    return this.sendMeetingAssigned(meeting);
  }

  /** @param {object} meeting */
  async sendMeetingReminder(meeting) {
    if (!meeting) return { sent: false };
    const userIds = [meeting.bossId, meeting.organizerId].filter(Boolean);
    return this._sendToUsers({
      userIds,
      type: 'meeting_reminder',
      template: (ctx) => meetingReminderTemplate(ctx),
      meeting,
    });
  }

  /** @param {object} meeting */
  async sendMeetingCancelled(meeting, senderId = null) {
    const userIds = [meeting.bossId, meeting.organizerId].filter(Boolean);
    return this._sendToUsers({
      userIds,
      type: 'meeting_cancelled',
      template: (ctx) => meetingCancelledTemplate(ctx),
      senderId,
      meeting,
    });
  }

  /** @param {object} meeting */
  async sendMeetingUpdated(meeting, senderId = null, changes = []) {
    const userIds = [meeting.bossId, meeting.organizerId].filter(Boolean);
    return this._sendToUsers({
      userIds,
      type: 'meeting_updated',
      template: (ctx) => meetingUpdatedTemplate({ ...ctx, changes }),
      senderId,
      meeting,
    });
  }

  /**
   * Boss "Confirm for your team" updates → organizer + coordinators only.
   * Strips any FCM tokens that still belong to the Boss/sender device.
   */
  async sendMeetingBossResponse(
    meeting,
    senderId = null,
    highlights = [],
    recipientUserIds = [],
  ) {
    const bossId = String(meeting?.bossId || '');
    const sender = String(senderId || bossId || '');
    const userIds = [
      ...new Set(
        recipientUserIds
          .map(String)
          .filter(Boolean)
          .filter((id) => id !== bossId && id !== sender),
      ),
    ];
    if (!userIds.length) return { sent: false, reason: 'no_recipients' };

    // Ensure meeting creator is always included when present.
    const organizerId = String(meeting?.organizerId || '');
    if (organizerId && organizerId !== bossId && organizerId !== sender) {
      if (!userIds.includes(organizerId)) userIds.unshift(organizerId);
    }

    return this._sendToUsers({
      userIds,
      type: 'meeting_boss_response',
      template: (ctx) =>
        meetingBossResponseTemplate({ ...ctx, highlights }),
      senderId: sender || null,
      meeting,
      excludeSenderTokens: true,
    });
  }

  /** @param {string[]} userIds */
  async sendSystemNotification({ userIds, title, body, extraData = {}, senderId = null }) {
    return this._sendToUsers({
      userIds,
      type: 'system',
      template: () => systemNotificationTemplate({ title, body, extraData }),
      senderId,
    });
  }

  /**
   * Notify coordinators about pending approval.
   * Uses the same delivery path as other meeting pushes (FCM + socket + history).
   * @param {object} meeting
   * @param {string[]} coordinatorUserIds
   */
  async sendMeetingPendingApproval(meeting, coordinatorUserIds) {
    return this._sendToUsers({
      userIds: coordinatorUserIds,
      type: 'meeting_pending',
      template: (ctx) => meetingPendingApprovalTemplate(ctx),
      meeting,
    });
  }
}

const notificationService = new NotificationService();
export default notificationService;
