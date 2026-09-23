/**
 * Structured logger for the push-notification subsystem.
 * @module utils/logger
 */

const LEVELS = ['debug', 'info', 'warn', 'error'];

function formatMeta(meta) {
  if (!meta || !Object.keys(meta).length) return '';
  try {
    return ` ${JSON.stringify(meta)}`;
  } catch {
    return '';
  }
}

function log(level, event, message, meta = {}) {
  if (!LEVELS.includes(level)) level = 'info';
  const ts = new Date().toISOString();
  const line = `[${ts}] [${level.toUpperCase()}] [${event}] ${message}${formatMeta(meta)}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

/** @type {Record<string, Function>} */
export const logger = {
  debug: (event, message, meta) => log('debug', event, message, meta),
  info: (event, message, meta) => log('info', event, message, meta),
  warn: (event, message, meta) => log('warn', event, message, meta),
  error: (event, message, meta) => log('error', event, message, meta),

  notificationSent: (meta) => log('info', 'NotificationSent', 'Notification sent', meta),
  notificationFailed: (meta) => log('error', 'NotificationFailed', 'Notification failed', meta),
  retry: (meta) => log('warn', 'Retry', 'Retrying notification', meta),
  tokenRemoved: (meta) => log('warn', 'TokenRemoved', 'Invalid token removed', meta),
  queueSuccess: (meta) => log('info', 'QueueSuccess', 'Queue job completed', meta),
  queueFailure: (meta) => log('error', 'QueueFailure', 'Queue job failed', meta),
  reminderSent: (meta) => log('info', 'ReminderSent', 'Meeting reminder sent', meta),
};

export default logger;
