/**
 * Shared constants for FCM push notifications.
 * @module utils/notificationConstants
 */

export const NOTIFICATION_TYPES = [
  'meeting_assigned',
  'meeting_reminder',
  'meeting_updated',
  'meeting_cancelled',
  'meeting_pending',
  'meeting_boss_response',
  'system',
  'marketing',
  'broadcast',
];

export const NOTIFICATION_STATUS = ['queued', 'sent', 'delivered', 'failed'];

export const NOTIFICATION_PRIORITY = ['low', 'normal', 'high', 'critical'];

export const PRIORITY_TO_ANDROID = {
  low: 'normal',
  normal: 'normal',
  high: 'high',
  critical: 'high',
};

export const PRIORITY_TO_APNS = {
  low: '5',
  normal: '5',
  high: '10',
  critical: '10',
};

/** Dedupe windows per notification type (milliseconds). */
export const DEDUPE_WINDOWS_MS = {
  default: 30_000,
  meeting_updated: 10_000,
  meeting_assigned: 60_000,
  meeting_reminder: 300_000,
  meeting_cancelled: 30_000,
  meeting_pending: 60_000,
  meeting_boss_response: 8_000,
  system: 5_000,
  broadcast: 60_000,
};

/** Rate limits: max events per windowMs. */
export const RATE_LIMITS = {
  company: { max: 120, windowMs: 60_000 },
  sender: { max: 60, windowMs: 60_000 },
  user: { max: 30, windowMs: 60_000 },
  deviceRegister: { max: 10, windowMs: 60_000 },
  api: { max: 100, windowMs: 60_000 },
};

export const PREFERENCE_KEYS = {
  meeting_assigned: 'meetingAssignments',
  meeting_reminder: 'meetingReminders',
  meeting_updated: 'meetingUpdates',
  meeting_cancelled: 'meetingCancelled',
  meeting_pending: 'meetingAssignments',
  meeting_boss_response: 'meetingUpdates',
  system: 'systemNotifications',
  marketing: 'marketingNotifications',
  broadcast: 'systemNotifications',
};

export const INVALID_TOKEN_ERROR_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export const MULTICAST_BATCH_SIZE = 500;

export const DEFAULT_CLICK_ACTION = 'FLUTTER_NOTIFICATION_CLICK';

export const DEEP_LINK_SCREEN = {
  meeting: 'meeting_details',
  system: 'notifications',
};
