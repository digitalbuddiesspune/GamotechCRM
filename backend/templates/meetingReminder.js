/**
 * Meeting reminder push template (~15 minutes before start).
 */
import {
  commonMeetingData,
  formatWhen,
  formatWhere,
  formatCompany,
} from './meetingTemplateHelpers.js';

export function meetingReminderTemplate({ meeting }) {
  const title = String(meeting?.title || '').trim() || 'Your meeting';
  const when = formatWhen(meeting);
  const where = formatWhere(meeting);
  const company = formatCompany(meeting);

  const lines = [`"${title}" starts in 15 minutes.`];
  if (when) lines.push(when + '.');
  if (where) lines.push(`Place: ${where}.`);
  if (company) lines.push(company + '.');
  lines.push('Tap to open.');

  return {
    title: 'Meeting starting soon',
    body: lines.join(' '),
    data: commonMeetingData(meeting, { notificationKind: 'meeting_reminder' }),
    image: '',
    priority: 'high',
  };
}
