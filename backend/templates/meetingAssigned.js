/**
 * Meeting assigned / approved push template.
 * Sent to Boss + organizer when a meeting is ready on the schedule.
 */
import {
  buildContextLine,
  commonMeetingData,
  resolvePriority,
} from './meetingTemplateHelpers.js';

export function meetingAssignedTemplate({ meeting }) {
  const title = String(meeting?.title || '').trim() || 'New meeting';
  const context = buildContextLine(meeting, { includeOrganizer: true });

  const lines = [`"${title}" is on your schedule.`];
  if (context) lines.push(context + '.');
  lines.push('Tap to open details.');

  return {
    title: 'New meeting scheduled',
    body: lines.join(' '),
    data: commonMeetingData(meeting, { notificationKind: 'meeting_assigned' }),
    image: '',
    priority: resolvePriority(meeting, 'normal'),
  };
}
