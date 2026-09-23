export const normalizeTaskPayload = (body = {}) => {
  const normalized = { ...body };

  if (normalized.estimatedDurationHours !== undefined && normalized.estimatedDurationHours !== '') {
    const hours = Number(normalized.estimatedDurationHours);
    normalized.estimatedDurationMinutes =
      Number.isFinite(hours) && hours > 0 ? Math.round(hours * 60) : null;
    delete normalized.estimatedDurationHours;
  } else if (normalized.estimatedDurationMinutes !== undefined && normalized.estimatedDurationMinutes !== '') {
    const mins = Number(normalized.estimatedDurationMinutes);
    normalized.estimatedDurationMinutes =
      Number.isFinite(mins) && mins > 0 ? Math.round(mins) : null;
  }

  if (normalized.scheduledStartAt) {
    const start = new Date(normalized.scheduledStartAt);
    normalized.scheduledStartAt = Number.isNaN(start.getTime()) ? null : start;
  }

  if (normalized.scheduledEndAt) {
    const end = new Date(normalized.scheduledEndAt);
    normalized.scheduledEndAt = Number.isNaN(end.getTime()) ? null : end;
  }

  if (
    normalized.scheduledStartAt &&
    normalized.estimatedDurationMinutes &&
    !normalized.scheduledEndAt
  ) {
    normalized.scheduledEndAt = new Date(
      normalized.scheduledStartAt.getTime() + Number(normalized.estimatedDurationMinutes) * 60000
    );
  }

  if (normalized.scheduledStartAt && !normalized.dueDate) {
    normalized.dueDate = normalized.scheduledStartAt;
  }

  if (normalized.rating !== undefined) {
    if (normalized.rating === null) {
      normalized.rating = { score: null, comments: '', ratedBy: null, ratedAt: null, auto: false };
    } else if (typeof normalized.rating === 'object') {
      const score = Number(normalized.rating.score);
      normalized.rating = {
        score: Number.isFinite(score) ? Math.min(5, Math.max(1, Math.round(score))) : null,
        comments: String(normalized.rating.comments || '').trim(),
        ratedBy: normalized.rating.ratedBy || null,
        ratedAt: normalized.rating.ratedAt || (Number.isFinite(score) ? new Date() : null),
        auto: Boolean(normalized.rating.auto),
      };
    }
  }

  return normalized;
};

export const formatDurationLabel = (minutes) => {
  const mins = Number(minutes);
  if (!Number.isFinite(mins) || mins <= 0) return null;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hours && rem) return `${hours}h ${rem}m`;
  if (hours) return `${hours}h`;
  return `${rem}m`;
};
