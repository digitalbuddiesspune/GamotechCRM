/**
 * Meeting pending coordinator approval push template.
 */
import {
  buildContextLine,
  commonMeetingData,
  formatOrganizer,
  resolvePriority,
} from './meetingTemplateHelpers.js';

export function meetingPendingApprovalTemplate({ meeting }) {
  const title = String(meeting?.title || '').trim() || 'Meeting request';
  const organizer = formatOrganizer(meeting);
  const context = buildContextLine(meeting, { includeBoss: true });

  const lines = [
    organizer
      ? `"${title}" needs your approval (from ${organizer}).`
      : `"${title}" needs your approval.`,
  ];
  if (context) lines.push(context + '.');
  lines.push('Tap to approve or reject.');

  return {
    title: 'Approval needed',
    body: lines.join(' '),
    data: commonMeetingData(meeting, {
      notificationKind: 'meeting_pending',
      action: 'open_meeting',
    }),
    image: '',
    priority: resolvePriority(meeting, 'high'),
  };
}
