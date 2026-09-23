/**
 * Boss "Confirm for your team" response push template.
 * Sent to meeting organizer + Meeting Coordinators (never Boss).
 */
import {
  buildContextLine,
  commonMeetingData,
  formatWhen,
  resolvePriority,
} from './meetingTemplateHelpers.js';

/**
 * @param {{ meeting: object, highlights?: string[] }} params
 */
export function meetingBossResponseTemplate({ meeting, highlights = [] }) {
  const title = String(meeting?.title || '').trim() || 'Meeting';
  const bossName = String(meeting?.bossName || '').trim() || 'Boss';
  const context = buildContextLine(meeting);
  const lines = Array.isArray(highlights)
    ? highlights.map((h) => String(h || '').trim()).filter(Boolean)
    : [];

  const response = String(meeting?.bossResponse || 'pending').toLowerCase();
  let notifTitle = 'Boss response';
  if (response === 'accepted') notifTitle = 'Boss will attend';
  if (response === 'declined') notifTitle = 'Boss cannot attend';
  if (Boolean(meeting?.rescheduleRequested) && lines.some((l) => l.includes('reschedule'))) {
    notifTitle = 'Boss requested reschedule';
  }

  let headline;
  if (lines.length) {
    headline = `${bossName}: ${lines.join('; ')}.`;
  } else if (response === 'declined') {
    headline = `${bossName} cannot attend "${title}".`;
  } else if (response === 'accepted') {
    headline = `${bossName} will attend "${title}".`;
  } else {
    headline = `${bossName} updated the response for "${title}".`;
  }

  const bodyParts = [headline];
  if (context) bodyParts.push(`Meeting: "${title}" · ${context}.`);
  else bodyParts.push(`Meeting: "${title}".`);
  bodyParts.push('Open the meeting to take action.');

  return {
    title: notifTitle,
    body: bodyParts.join(' '),
    data: commonMeetingData(meeting, {
      notificationKind: 'meeting_boss_response',
      bossResponse: String(meeting?.bossResponse || 'pending'),
      highlights: lines.join(' | '),
      forOrganizer: 'true',
    }),
    image: '',
    priority: resolvePriority(meeting, 'high'),
  };
}

/**
 * Build human-readable highlights from Boss team-confirm field changes.
 * @returns {string[]}
 */
export function summarizeBossTeamChanges(previous, meeting) {
  if (!previous || !meeting) return [];

  const highlights = [];
  const meetingTitle = String(meeting.title || '').trim() || 'Meeting';

  const prevResponse = String(previous.bossResponse || 'pending');
  const nextResponse = String(meeting.bossResponse || 'pending');
  if (prevResponse !== nextResponse) {
    if (nextResponse === 'accepted') {
      highlights.push(`will attend "${meetingTitle}"`);
    } else if (nextResponse === 'declined') {
      highlights.push(`cannot attend "${meetingTitle}"`);
    } else {
      highlights.push(`set reply to pending for "${meetingTitle}"`);
    }
  }

  const prevReschedule = Boolean(previous.rescheduleRequested);
  const nextReschedule = Boolean(meeting.rescheduleRequested);
  if (!prevReschedule && nextReschedule) {
    const when = formatWhen({
      startAt: meeting.reschedulePreferredStartAt,
      endAt: meeting.reschedulePreferredEndAt,
    });
    const reason = String(meeting.rescheduleReason || '').trim();
    highlights.push(
      when
        ? `requested reschedule${reason ? ` (${reason})` : ''} → ${when}`
        : `requested a reschedule${reason ? `: ${reason}` : ''}`,
    );
  } else if (prevReschedule && nextReschedule) {
    const prevWhen = formatWhen({
      startAt: previous.reschedulePreferredStartAt,
      endAt: previous.reschedulePreferredEndAt,
    });
    const nextWhen = formatWhen({
      startAt: meeting.reschedulePreferredStartAt,
      endAt: meeting.reschedulePreferredEndAt,
    });
    const prevReason = String(previous.rescheduleReason || '').trim();
    const nextReason = String(meeting.rescheduleReason || '').trim();
    if (prevWhen !== nextWhen || prevReason !== nextReason) {
      highlights.push(
        nextWhen
          ? `updated reschedule request → ${nextWhen}`
          : 'updated reschedule request',
      );
    }
  } else if (prevReschedule && !nextReschedule) {
    highlights.push('cancelled the reschedule request');
  }

  const prevImportant = Boolean(previous.bossMarkedImportant);
  const nextImportant = Boolean(meeting.bossMarkedImportant);
  if (prevImportant !== nextImportant) {
    highlights.push(
      nextImportant ? 'marked this meeting important' : 'removed important mark',
    );
  }

  const prevNote = String(previous.bossPersonalNote || '').trim();
  const nextNote = String(meeting.bossPersonalNote || '').trim();
  if (prevNote !== nextNote) {
    if (nextNote) {
      const short =
        nextNote.length > 80 ? `${nextNote.slice(0, 77)}...` : nextNote;
      highlights.push(`left a note: "${short}"`);
    } else {
      highlights.push('cleared the team note');
    }
  }

  return highlights;
}
