/**
 * Meeting cancelled push template.
 */
import {
  commonMeetingData,
  formatWhen,
  formatWhere,
  formatCompany,
} from './meetingTemplateHelpers.js';

export function meetingCancelledTemplate({ meeting }) {
  const title = String(meeting?.title || '').trim() || 'Meeting';
  const when = formatWhen(meeting);
  const where = formatWhere(meeting);
  const company = formatCompany(meeting);

  const lines = [`"${title}" is cancelled.`];
  if (when) lines.push(`It was planned for ${when}.`);
  if (where) lines.push(`Place was ${where}.`);
  if (company) lines.push(company + '.');
  lines.push('You do not need to attend.');

  return {
    title: 'Meeting cancelled',
    body: lines.join(' '),
    data: commonMeetingData(meeting, { notificationKind: 'meeting_cancelled' }),
    image: '',
    priority: 'high',
  };
}
