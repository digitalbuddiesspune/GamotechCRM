import cron from 'node-cron';
import CentralMeeting from '../models/centralAdmin/centralAdmin_meeting.js';
import PushNotification from '../models/Notification.js';
import notificationService from '../services/notification.service.js';
import {
  enqueueNotificationJob,
  JOB_TYPES,
  isQueueEnabled,
} from '../queue/notification.queue.js';
import logger from '../utils/logger.js';

const REMINDER_MINUTES = Number(process.env.MEETING_REMINDER_MINUTES || 15);
const REMINDER_WINDOW_MS = 60 * 1000; // 1-minute cron window

/**
 * Find meetings starting in ~15 minutes and enqueue reminder notifications.
 * Skips meetings that already received a reminder (dedup via PushNotification).
 */
async function processMeetingReminders() {
  const now = Date.now();
  const windowStart = new Date(now + (REMINDER_MINUTES * 60 * 1000) - REMINDER_WINDOW_MS / 2);
  const windowEnd = new Date(now + (REMINDER_MINUTES * 60 * 1000) + REMINDER_WINDOW_MS / 2);

  const meetings = await CentralMeeting.find({
    status: { $in: ['scheduled', 'rescheduled'] },
    startAt: { $gte: windowStart, $lte: windowEnd },
    // Only remind for meetings already on the Boss schedule
    $or: [
      { coordinatorApproval: 'approved' },
      { coordinatorApproval: null },
      { coordinatorApproval: { $exists: false } },
    ],
  }).lean();

  if (!meetings.length) return;

  await Promise.all(
    meetings.map(async (meeting) => {
      const meetingId = String(meeting._id);
      const userIds = [meeting.bossId, meeting.organizerId].filter(Boolean);

      const existing = await PushNotification.findOne({
        meetingId,
        type: 'meeting_reminder',
        receiver: { $in: userIds },
        createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) },
      }).lean();

      if (existing) return;

      const jobData = { meetingId };

      if (isQueueEnabled()) {
        await enqueueNotificationJob(JOB_TYPES.MEETING_REMINDER, jobData);
      } else {
        await notificationService.sendMeetingReminder(meeting);
      }

      logger.reminderSent({ meetingId, title: meeting.title });
    }),
  );
}

/**
 * Schedule meeting reminder cron — runs every minute.
 * @returns {cron.ScheduledTask | null}
 */
export function startMeetingReminderJob() {
  if (process.env.DISABLE_MEETING_REMINDER_CRON === 'true') {
    logger.warn('ReminderCron', 'Meeting reminder cron disabled via env');
    return null;
  }

  const task = cron.schedule('* * * * *', async () => {
    try {
      await processMeetingReminders();
    } catch (error) {
      logger.error('ReminderCron', 'Meeting reminder job failed', { error: error?.message });
    }
  });

  logger.info('ReminderCron', 'Meeting reminder cron started (every minute)');
  return task;
}

export default startMeetingReminderJob;
