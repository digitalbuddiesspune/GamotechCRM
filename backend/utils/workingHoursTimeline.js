import {
  getBusinessDateKey,
  getBusinessMinutesFromMidnight,
  isSameBusinessDay,
  minutesOnBusinessDay,
  startOfBusinessDay,
} from './businessTime.js';

/** Parse strings like "9 AM - 6 PM", "9-6", "09:00 - 18:00" into minutes from midnight. */
const parseClockToken = (token) => {
  const raw = String(token || '').trim().toLowerCase();
  if (!raw) return null;

  const match12 = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (match12) {
    let hour = Number(match12[1]);
    const minute = Number(match12[2] || 0);
    const meridiem = match12[3].toLowerCase();
    if (hour === 12) hour = meridiem === 'am' ? 0 : 12;
    else if (meridiem === 'pm') hour += 12;
    return hour * 60 + minute;
  }

  const match24 = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hour = Number(match24[1]);
    const minute = Number(match24[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) return hour * 60 + minute;
  }

  const matchHourOnly = raw.match(/^(\d{1,2})$/);
  if (matchHourOnly) {
    const hour = Number(matchHourOnly[1]);
    if (hour >= 0 && hour <= 23) return hour * 60;
  }

  return null;
};

export const parseWorkingHours = (workingHours) => {
  const fallback = { startMinutes: 9 * 60, endMinutes: 18 * 60, label: '9 AM – 6 PM' };
  const text = String(workingHours || '').trim();
  if (!text) return fallback;

  const parts = text.split(/\s*(?:-|–|—|\bto\b)\s*/i).map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return fallback;

  let startMinutes = parseClockToken(parts[0]);
  let endMinutes = parseClockToken(parts[1]);

  if (startMinutes == null && /^\d{1,2}$/.test(parts[0])) {
    startMinutes = Number(parts[0]) * 60;
  }
  if (endMinutes == null && /^\d{1,2}$/.test(parts[1])) {
    let endHour = Number(parts[1]);
    if (endHour < 12 && startMinutes != null && startMinutes >= 12 * 60) endHour += 12;
    endMinutes = endHour * 60;
  }

  if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) return fallback;

  const formatMinutes = (mins) => {
    const h24 = Math.floor(mins / 60);
    const m = mins % 60;
    const meridiem = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 || 12;
    return m ? `${h12}:${String(m).padStart(2, '0')} ${meridiem}` : `${h12} ${meridiem}`;
  };

  return {
    startMinutes,
    endMinutes,
    label: `${formatMinutes(startMinutes)} – ${formatMinutes(endMinutes)}`,
  };
};

export const formatMinutesLabel = (minutes) => {
  const mins = Number(minutes);
  if (!Number.isFinite(mins)) return '—';
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const meridiem = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${meridiem}` : `${h12} ${meridiem}`;
};

const rangesOverlap = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

export const getTaskScheduledRange = (task) => {
  if (!task) return null;
  const start = task.scheduledStartAt ? new Date(task.scheduledStartAt) : null;
  if (!start || Number.isNaN(start.getTime())) return null;

  let end = task.scheduledEndAt ? new Date(task.scheduledEndAt) : null;
  if (!end || Number.isNaN(end.getTime())) {
    const duration = Number(task.estimatedDurationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) return null;
    end = new Date(start.getTime() + duration * 60000);
  }

  if (end <= start) return null;
  return { start, end };
};

export const buildWorkingTimeline = ({
  workingHours,
  date,
  slotMinutes = 15,
  occupiedRanges = [],
  selectedStartMinutes = null,
  selectedDurationMinutes = null,
  now = new Date(),
}) => {
  const { startMinutes, endMinutes, label } = parseWorkingHours(workingHours);
  const dayStart = startOfBusinessDay(date);
  const dayKey = getBusinessDateKey(dayStart);
  const todayKey = getBusinessDateKey(now);
  const isToday = dayKey === todayKey;
  const nowMinutes = getBusinessMinutesFromMidnight(now);

  const selectedEndMinutes =
    selectedStartMinutes != null && selectedDurationMinutes
      ? selectedStartMinutes + Number(selectedDurationMinutes)
      : null;

  const slots = [];
  for (let minute = startMinutes; minute < endMinutes; minute += slotMinutes) {
    const slotEnd = Math.min(minute + slotMinutes, endMinutes);
    let status = 'available';
    const taskCount = occupiedRanges.filter((range) =>
      rangesOverlap(minute, slotEnd, range.startMinutes, range.endMinutes)
    ).length;

    // Disable past and currently-running slots; only future starts are selectable.
    if (isToday && minute <= nowMinutes) {
      status = 'past';
    } else if (taskCount > 0) {
      // Occupied slots stay selectable: employees can run multiple tasks at once.
      status = 'occupied';
    }

    if (
      selectedStartMinutes != null &&
      selectedEndMinutes != null &&
      rangesOverlap(minute, slotEnd, selectedStartMinutes, selectedEndMinutes)
    ) {
      status = status === 'past' ? status : 'selected';
    }

    slots.push({
      startMinutes: minute,
      endMinutes: slotEnd,
      label: formatMinutesLabel(minute),
      status,
      taskCount,
      disabled: status === 'past',
    });
  }

  const totalMinutes = endMinutes - startMinutes;
  const occupiedMinutes = slots
    .filter((s) => s.taskCount > 0 && s.status !== 'past')
    .reduce((sum, s) => sum + (s.endMinutes - s.startMinutes), 0);
  const pastMinutes = slots
    .filter((s) => s.status === 'past')
    .reduce((sum, s) => sum + (s.endMinutes - s.startMinutes), 0);
  const remainingMinutes = Math.max(0, totalMinutes - pastMinutes);

  return {
    workingHoursLabel: label,
    startMinutes,
    endMinutes,
    slotMinutes,
    slots,
    totalMinutes,
    occupiedMinutes,
    pastMinutes,
    remainingMinutes,
    remainingTimeLabel: remainingMinutes
      ? `${Math.floor(remainingMinutes / 60)}h ${remainingMinutes % 60 ? `${remainingMinutes % 60}m` : ''}`.trim()
      : '0m',
    businessDate: dayKey,
    isToday,
  };
};

export const minutesOnDay = (dateValue, minutesFromMidnight) =>
  minutesOnBusinessDay(dateValue, minutesFromMidnight);

export const applyScheduledTimes = ({ date, startMinutes, durationMinutes }) => {
  if (startMinutes == null || durationMinutes == null) {
    return { scheduledStartAt: null, scheduledEndAt: null };
  }
  const start = minutesOnDay(date, startMinutes);
  const end = new Date(start.getTime() + Number(durationMinutes) * 60000);
  return { scheduledStartAt: start, scheduledEndAt: end };
};

export { isSameBusinessDay, getBusinessMinutesFromMidnight, getBusinessDateKey };
