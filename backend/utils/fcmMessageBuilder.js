/**
 * Rich FCM message builder — Android/iOS/web options.
 * @module utils/fcmMessageBuilder
 */
import {
  DEFAULT_CLICK_ACTION,
  PRIORITY_TO_ANDROID,
  PRIORITY_TO_APNS,
} from './notificationConstants.js';

/** FCM data payload values must be strings. */
export function stringifyData(data = {}) {
  return Object.entries(data).reduce((acc, [key, value]) => {
    if (value === undefined || value === null) return acc;
    acc[String(key)] = typeof value === 'string' ? value : JSON.stringify(value);
    return acc;
  }, {});
}

/**
 * Build a Firebase Admin message with rich notification support.
 * @param {object} options
 */
export function buildFcmMessage({
  token,
  topic,
  title,
  body,
  data,
  image,
  icon,
  badge,
  channelId,
  sound,
  clickAction,
  color,
  priority = 'normal',
  collapseKey,
  ttlSeconds,
}) {
  const notification = {};
  if (title) notification.title = String(title);
  if (body) notification.body = String(body);
  if (image) notification.imageUrl = String(image);

  const androidPriority = PRIORITY_TO_ANDROID[priority] || 'default';
  const apnsPriority = PRIORITY_TO_APNS[priority] || '5';

  const message = {
    notification: Object.keys(notification).length ? notification : undefined,
    data: data ? stringifyData(data) : undefined,
    android: {
      priority: androidPriority === 'high' ? 'high' : 'normal',
      ttl: ttlSeconds ? `${ttlSeconds}s` : undefined,
      collapseKey: collapseKey || undefined,
      notification: {
        channelId: channelId || 'meeting_app_high_importance',
        icon: icon || undefined,
        color: color || undefined,
        sound: sound || 'default',
        clickAction: clickAction || DEFAULT_CLICK_ACTION,
        imageUrl: image || undefined,
      },
    },
    apns: {
      headers: {
        'apns-priority': apnsPriority,
      },
      payload: {
        aps: {
          alert: title ? { title: String(title), body: String(body || '') } : undefined,
          badge: badge != null ? Number(badge) : undefined,
          sound: sound || 'default',
          category: clickAction || DEFAULT_CLICK_ACTION,
          'mutable-content': image ? 1 : undefined,
        },
      },
      fcmOptions: image ? { imageUrl: String(image) } : undefined,
    },
    webpush: image
      ? {
          notification: { icon: icon || undefined, image: String(image) },
        }
      : undefined,
  };

  if (token) message.token = String(token);
  if (topic) message.topic = String(topic);

  return message;
}

/**
 * Map internal priority to BullMQ job priority (higher number = higher priority).
 * @param {string} priority
 * @returns {number}
 */
export function toQueuePriority(priority) {
  const map = { low: 1, normal: 2, high: 3, critical: 4 };
  return map[priority] || 2;
}
