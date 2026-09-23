/**
 * @jest-environment node
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { buildDedupeKey, isDuplicateNotification } from '../utils/notificationDedupe.js';
import { buildFcmMessage, toQueuePriority } from '../utils/fcmMessageBuilder.js';
import { sanitizeNotificationText } from '../utils/companyIsolation.js';
import { isRetryableError, isNonRetryableFirebaseError } from '../utils/errors.js';

describe('notificationDedupe', () => {
  beforeEach(() => {
    // Memory-only dedupe (no Redis in tests)
  });

  it('builds stable dedupe keys', () => {
    expect(buildDedupeKey('meeting_updated', 'abc123')).toBe('meeting_updated:abc123');
    expect(buildDedupeKey('meeting_updated', 'abc123', 'user1')).toBe(
      'meeting_updated:abc123:user1',
    );
  });

  it('suppresses duplicate within window', async () => {
    const key = `test:${Date.now()}`;
    expect(await isDuplicateNotification(key, 'system')).toBe(false);
    expect(await isDuplicateNotification(key, 'system')).toBe(true);
  });
});

describe('fcmMessageBuilder', () => {
  it('stringifies data payload values', () => {
    const msg = buildFcmMessage({
      token: 'tok',
      title: 'Hello',
      body: 'World',
      data: { type: 'meeting', meetingId: '123', priority: 'high' },
      priority: 'critical',
      channelId: 'test_channel',
      collapseKey: 'meeting_123',
      ttlSeconds: 3600,
    });
    expect(msg.token).toBe('tok');
    expect(msg.data.meetingId).toBe('123');
    expect(msg.android.collapseKey).toBe('meeting_123');
    expect(msg.apns.headers['apns-priority']).toBe('10');
  });

  it('maps priority to queue priority', () => {
    expect(toQueuePriority('critical')).toBe(4);
    expect(toQueuePriority('low')).toBe(1);
  });
});

describe('companyIsolation', () => {
  it('sanitizes control characters from text', () => {
    expect(sanitizeNotificationText('Hello\x00World')).toBe('HelloWorld');
    expect(sanitizeNotificationText('  trim  ')).toBe('trim');
  });
});

describe('errors', () => {
  it('identifies non-retryable Firebase errors', () => {
    expect(
      isNonRetryableFirebaseError({ code: 'messaging/invalid-registration-token' }),
    ).toBe(true);
    expect(isNonRetryableFirebaseError({ code: 'messaging/unavailable' })).toBe(false);
  });

  it('identifies retryable network errors', () => {
    expect(isRetryableError({ message: 'network timeout' })).toBe(true);
    expect(
      isRetryableError({ code: 'messaging/registration-token-not-registered' }),
    ).toBe(false);
  });
});
