/**
 * Business calendar timezone for working-hours timelines.
 * Production servers often run in UTC; staff operate in India time.
 * Override with BUSINESS_TIMEZONE if needed (IANA name).
 */
export const BUSINESS_TIMEZONE =
  String(process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata').trim() || 'Asia/Kolkata';

const pad2 = (n) => String(n).padStart(2, '0');

/** Wall-clock parts of an instant in the business timezone. */
export const getZonedParts = (date = new Date(), timeZone = BUSINESS_TIMEZONE) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) {
    return getZonedParts(new Date(), timeZone);
  }

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = {};
  for (const { type, value } of fmt.formatToParts(d)) {
    if (type !== 'literal') parts[type] = value;
  }

  let hour = Number(parts.hour);
  if (hour === 24) hour = 0;

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour,
    minute: Number(parts.minute),
    second: Number(parts.second || 0),
  };
};

export const getBusinessDateKey = (date = new Date(), timeZone = BUSINESS_TIMEZONE) => {
  const p = getZonedParts(date, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
};

export const getBusinessMinutesFromMidnight = (date = new Date(), timeZone = BUSINESS_TIMEZONE) => {
  const p = getZonedParts(date, timeZone);
  return p.hour * 60 + p.minute;
};

/**
 * Convert a business-timezone wall time to a UTC Date.
 * Uses a short correction loop so DST-aware zones still work.
 */
export const zonedWallTimeToUtc = (
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  timeZone = BUSINESS_TIMEZONE
) => {
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, second);
  let utcMs = desiredAsUtc;

  for (let i = 0; i < 3; i += 1) {
    const parts = getZonedParts(new Date(utcMs), timeZone);
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    );
    utcMs += desiredAsUtc - asUtc;
  }

  return new Date(utcMs);
};

/** Parse YYYY-MM-DD (or Date / ISO) as start of that calendar day in business TZ. */
export const startOfBusinessDay = (value, timeZone = BUSINESS_TIMEZONE) => {
  if (value == null || value === '') {
    const p = getZonedParts(new Date(), timeZone);
    return zonedWallTimeToUtc(p.year, p.month, p.day, 0, 0, 0, timeZone);
  }

  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return zonedWallTimeToUtc(
        Number(match[1]),
        Number(match[2]),
        Number(match[3]),
        0,
        0,
        0,
        timeZone
      );
    }
  }

  const p = getZonedParts(value, timeZone);
  return zonedWallTimeToUtc(p.year, p.month, p.day, 0, 0, 0, timeZone);
};

export const endOfBusinessDay = (value, timeZone = BUSINESS_TIMEZONE) => {
  const start = startOfBusinessDay(value, timeZone);
  // Next calendar day start in business TZ
  const p = getZonedParts(start, timeZone);
  const next = new Date(Date.UTC(p.year, p.month - 1, p.day + 1));
  return zonedWallTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), 0, 0, 0, timeZone);
};

export const minutesOnBusinessDay = (dateValue, minutesFromMidnight, timeZone = BUSINESS_TIMEZONE) => {
  const start = startOfBusinessDay(dateValue, timeZone);
  const p = getZonedParts(start, timeZone);
  const mins = Number(minutesFromMidnight) || 0;
  const hour = Math.floor(mins / 60);
  const minute = mins % 60;
  return zonedWallTimeToUtc(p.year, p.month, p.day, hour, minute, 0, timeZone);
};

export const isSameBusinessDay = (a, b, timeZone = BUSINESS_TIMEZONE) =>
  getBusinessDateKey(a, timeZone) === getBusinessDateKey(b, timeZone);
