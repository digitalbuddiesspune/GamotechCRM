/**
 * Custom errors for the push-notification subsystem.
 * @module utils/errors
 */

export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

export class NotificationError extends AppError {
  constructor(message, statusCode = 500) {
    super(message, statusCode, 'NOTIFICATION_ERROR');
  }
}

export class FirebaseError extends AppError {
  constructor(message, statusCode = 503) {
    super(message, statusCode, 'FIREBASE_ERROR');
  }
}

export class QueueError extends AppError {
  constructor(message, statusCode = 503) {
    super(message, statusCode, 'QUEUE_ERROR');
  }
}

export class ValidationError extends AppError {
  constructor(message, statusCode = 400) {
    super(message, statusCode, 'VALIDATION_ERROR');
  }
}

/** @returns {boolean} True when the Firebase error must not be retried. */
export function isNonRetryableFirebaseError(error) {
  const code = error?.code || error?.errorInfo?.code || '';
  return [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
  ].includes(code);
}

/** @returns {boolean} True when a failed send should be retried. */
export function isRetryableError(error) {
  if (isNonRetryableFirebaseError(error)) return false;
  const code = error?.code || error?.errorInfo?.code || '';
  if (code.startsWith('messaging/')) return true;
  const message = String(error?.message || '').toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('unavailable') ||
    message.includes('internal')
  );
}
