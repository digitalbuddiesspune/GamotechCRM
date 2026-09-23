/**
 * Meeting updated push template — shows what changed + current details.
 */
import {
  buildContextLine,
  commonMeetingData,
  resolvePriority,
} from './meetingTemplateHelpers.js';

/**
 * @param {{ meeting: object, changes?: string[] }} params
 */
export function meetingUpdatedTemplate({ meeting, changes = [] }) {
  const title = String(meeting?.title || '').trim() || 'Meeting';
  const context = buildContextLine(meeting, { includeOrganizer: true });
  const changeList = Array.isArray(changes)
    ? changes.map((c) => String(c || '').trim()).filter(Boolean)
    : [];

  const lines = [];

  if (changeList.length) {
    lines.push(`"${title}" — ${changeList.join('; ')}.`);
  } else if (context) {
    lines.push(`"${title}" — ${context}.`);
  } else {
    lines.push(`"${title}" details are now available.`);
  }

  lines.push('Tap to open.');

  return {
    title: 'Meeting updated',
    body: lines.join(' '),
    data: commonMeetingData(meeting, {
      notificationKind: 'meeting_updated',
      changes: changeList.join(' | '),
    }),
    image: '',
    priority: resolvePriority(meeting, 'high'),
  };
}
