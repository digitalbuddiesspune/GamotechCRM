/**
 * Shared formatting for informative meeting push notifications.
 * Times are shown in India Standard Time so pushes match the app schedule.
 * @module templates/meetingTemplateHelpers
 */

const NOTIFICATION_TZ = process.env.NOTIFICATION_TIMEZONE || 'Asia/Kolkata';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** @param {unknown} value */
export function meetingIdOf(value) {
  return String(value?._id || value?.id || '');
}

/** @param {Date|string|number|null|undefined} value */
export function toValidDate(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parts of a date in the notification timezone. */
function zonedParts(value) {
  const d = toValidDate(value);
  if (!d) return null;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: NOTIFICATION_TZ,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d);

  const map = Object.fromEntries(
    parts.filter((p) => p.type !== 'literal').map((p) => [p.type, p.value]),
  );

  const dayNum = Number(map.day);
  const monthIdx = MONTHS.findIndex((m) => m === map.month);
  const weekdayIdx = WEEKDAYS.findIndex((w) => w === map.weekday);

  let hour = Number(map.hour);
  const minute = Number(map.minute);
  const dayPeriod = String(map.dayPeriod || '').toUpperCase();
  // Normalize hour for 12h display already provided by Intl hour12
  const ampm = dayPeriod.startsWith('P') ? 'PM' : 'AM';

  return {
    weekday: weekdayIdx >= 0 ? WEEKDAYS[weekdayIdx] : map.weekday,
    day: dayNum,
    month: monthIdx >= 0 ? MONTHS[monthIdx] : map.month,
    hour,
    minute,
    ampm,
    // comparable day key in timezone
    dayKey: `${map.weekday}|${map.day}|${map.month}`,
  };
}

/** Format like: 3:30 PM */
export function formatTime(value) {
  const p = zonedParts(value);
  if (!p) return '';
  const mm = String(p.minute).padStart(2, '0');
  return `${p.hour}:${mm} ${p.ampm}`;
}

/** Format like: Wed, 22 Jul */
export function formatDay(value) {
  const p = zonedParts(value);
  if (!p) return '';
  return `${p.weekday}, ${p.day} ${p.month}`;
}

/** Format like: Wed, 22 Jul · 3:30–4:30 PM */
export function formatWhen(meeting) {
  const start = toValidDate(meeting?.startAt);
  const end = toValidDate(meeting?.endAt);
  if (!start) return '';

  const startParts = zonedParts(start);
  if (!startParts) return '';

  const day = formatDay(start);
  const startTime = formatTime(start);
  if (!end) return `${day} · ${startTime}`;

  const endParts = zonedParts(end);
  if (!endParts) return `${day} · ${startTime}`;

  if (startParts.dayKey === endParts.dayKey) {
    const endTime = formatTime(end);
    if (startParts.ampm === endParts.ampm) {
      return `${day} · ${startTime.replace(` ${startParts.ampm}`, '')}–${endTime}`;
    }
    return `${day} · ${startTime} – ${endTime}`;
  }

  return `${day} ${startTime} → ${formatDay(end)} ${formatTime(end)}`;
}

/** Location / Meet link short label */
export function formatWhere(meeting) {
  const location = String(meeting?.location || '').trim();
  const meetLink = String(meeting?.meetLink || '').trim();
  if (location) return location;
  if (meetLink) return 'Online meeting';
  return '';
}

export function formatCompany(meeting) {
  return String(meeting?.companyName || '').trim();
}

export function formatOrganizer(meeting) {
  return String(meeting?.organizerName || '').trim();
}

export function formatBoss(meeting) {
  return String(meeting?.bossName || '').trim();
}

export function formatPriority(meeting) {
  const p = String(meeting?.priority || 'medium').toLowerCase();
  if (p === 'critical') return 'Critical';
  if (p === 'high') return 'High priority';
  if (p === 'low') return 'Low priority';
  return '';
}

/**
 * Build a compact multi-part context line.
 * Example: Wed, 22 Jul · 3:30–4:30 PM · Board Room · Bangalore Properties
 */
export function buildContextLine(meeting, { includeOrganizer = false, includeBoss = false } = {}) {
  const parts = [];
  const when = formatWhen(meeting);
  const where = formatWhere(meeting);
  const company = formatCompany(meeting);
  const organizer = formatOrganizer(meeting);
  const boss = formatBoss(meeting);
  const priority = formatPriority(meeting);

  if (when) parts.push(when);
  if (where) parts.push(where);
  if (company) parts.push(company);
  if (includeOrganizer && organizer) parts.push(`by ${organizer}`);
  if (includeBoss && boss) parts.push(`for ${boss}`);
  if (priority && (meeting?.priority === 'high' || meeting?.priority === 'critical')) {
    parts.push(priority);
  }

  return parts.join(' · ');
}

export function commonMeetingData(meeting, extra = {}) {
  return {
    type: 'meeting',
    screen: 'meeting_details',
    meetingId: meetingIdOf(meeting),
    companyId: String(meeting?.companyId || ''),
    companyName: formatCompany(meeting),
    title: String(meeting?.title || ''),
    priority: String(meeting?.priority || 'normal'),
    action: 'open_meeting',
    ...extra,
  };
}

export function resolvePriority(meeting, fallback = 'normal') {
  const p = String(meeting?.priority || '').toLowerCase();
  if (p === 'critical' || p === 'high') return 'high';
  return fallback;
}

/**
 * Human-readable list of what changed between two meeting snapshots.
 * @returns {string[]}
 */
export function summarizeMeetingChanges(previous, meeting) {
  if (!previous || !meeting) return [];

  const changes = [];

  const prevTitle = String(previous.title || '').trim();
  const nextTitle = String(meeting.title || '').trim();
  if (prevTitle !== nextTitle) {
    changes.push(
      prevTitle
        ? `Title: "${prevTitle}" → "${nextTitle}"`
        : `Title: "${nextTitle}"`,
    );
  }

  const prevWhen = formatWhen(previous);
  const nextWhen = formatWhen(meeting);
  if (prevWhen !== nextWhen && nextWhen) {
    changes.push(prevWhen ? `Time: ${prevWhen} → ${nextWhen}` : `Time: ${nextWhen}`);
  }

  const prevWhere = formatWhere(previous);
  const nextWhere = formatWhere(meeting);
  if (prevWhere !== nextWhere) {
    if (nextWhere && prevWhere) {
      changes.push(`Place: ${prevWhere} → ${nextWhere}`);
    } else if (nextWhere) {
      changes.push(`Place: ${nextWhere}`);
    } else if (prevWhere) {
      changes.push('Place removed');
    }
  }

  const prevAgenda = String(previous.agenda || previous.description || '').trim();
  const nextAgenda = String(meeting.agenda || meeting.description || '').trim();
  if (prevAgenda !== nextAgenda) {
    changes.push(nextAgenda ? 'Agenda updated' : 'Agenda cleared');
  }

  const prevPriority = String(previous.priority || '').toLowerCase();
  const nextPriority = String(meeting.priority || '').toLowerCase();
  if (prevPriority !== nextPriority && nextPriority) {
    changes.push(`Priority: ${nextPriority}`);
  }

  return changes;
}
