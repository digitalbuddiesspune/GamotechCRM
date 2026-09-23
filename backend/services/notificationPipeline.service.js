/**
 * Notification delivery pipeline — orchestrates dedupe, rate limit, realtime, FCM, audit.
 * @module services/notificationPipeline.service
 */
import notificationService from './notification.service.js';
import realtimeNotification from './realtimeNotification.service.js';
import NotificationAuditLog from '../models/NotificationAuditLog.js';
import { isDuplicateNotification, buildDedupeKey } from '../utils/notificationDedupe.js';
import { checkCompanySendRate, checkSenderRate } from '../utils/notificationRateLimit.js';
import {
  assertCompanyAccessForUsers,
  filterUsersByCompanyAccess,
} from '../utils/companyIsolation.js';
import { collectTokensForUserIds } from '../utils/pushTokenStore.js';
import logger from '../utils/logger.js';

/**
 * Run pre-send guards. Returns null if send should proceed, or skip reason object.
 */
export async function runPreSendGuards({
  type,
  entityId,
  userIds,
  companyId,
  senderId,
  dedupeScope = 'entity',
}) {
  const dedupeKey =
    dedupeScope === 'global'
      ? buildDedupeKey(type, entityId)
      : buildDedupeKey(type, entityId, userIds.join(','));

  if (await isDuplicateNotification(dedupeKey, type)) {
    await logAudit({ event: 'deduped', type, meetingId: entityId, companyId, createdBy: senderId });
    return { skip: true, reason: 'deduplicated' };
  }

  if (companyId) {
    await assertCompanyAccessForUsers(companyId, userIds);
    const companyRate = await checkCompanySendRate(companyId);
    if (!companyRate.allowed) return { skip: true, reason: 'company_rate_limit' };
  }

  if (senderId) {
    const senderRate = await checkSenderRate(senderId);
    if (!senderRate.allowed) return { skip: true, reason: 'sender_rate_limit' };
  }

  return { skip: false, dedupeKey };
}

/**
 * Deliver to online users via Socket.IO; returns offline user ids for FCM.
 * @param {string[]} userIds
 * @param {object} payload
 */
export function deliverRealtime(userIds, payload) {
  const { online, offline } = realtimeNotification.partitionByOnlineStatus(userIds);

  for (const userId of online) {
    realtimeNotification.emitToUser(userId, payload);
    logAudit({
      event: 'delivered',
      receiverId: userId,
      channel: 'socket',
      type: payload.type,
      meetingId: payload.data?.meetingId,
      companyId: payload.data?.companyId,
    }).catch(() => {});
  }

  return { online, offline };
}

/**
 * Filter user ids by company access before send.
 */
export async function resolveEligibleRecipients(userIds, companyId) {
  if (!companyId) return userIds;
  return filterUsersByCompanyAccess(companyId, userIds);
}

/**
 * Collect FCM tokens only for offline users when realtime is enabled.
 */
export async function collectOfflineTokens(userIds, notificationType, forceAll = false) {
  if (!realtimeNotification.isRealtimeEnabled() || forceAll) {
    return collectTokensForUserIds(userIds, notificationType);
  }

  const { offline } = realtimeNotification.partitionByOnlineStatus(userIds);
  return collectTokensForUserIds(offline, notificationType);
}

/**
 * Write audit log entry (fire-and-forget safe).
 */
export async function logAudit(entry) {
  try {
    await NotificationAuditLog.create(entry);
  } catch (error) {
    logger.warn('AuditLog', 'Failed to write audit log', { error: error?.message });
  }
}

export default {
  runPreSendGuards,
  deliverRealtime,
  resolveEligibleRecipients,
  collectOfflineTokens,
  logAudit,
};
