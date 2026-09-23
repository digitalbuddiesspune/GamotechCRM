/**
 * Auto star rating from completion speed vs estimated duration.
 *
 * For a 60‑minute estimate (same % bands for any estimate):
 *   ≤ 75% of estimate (≥25% time left)     → 5
 *   > 75% and ≤ 100% (<25% time left)      → 4
 *   > 100% and ≤ 125% (late up to 25%)     → 3
 *   > 125% and ≤ 150% (late up to 50%)     → 2
 *   > 150% (more than 50% late)            → 1
 *   Not completed                          → null (UI shows ❌)
 */

export const TASK_STAR_BANDS = [
  { maxRatio: 0.75, score: 5, label: 'Finished with ≥25% time left' },
  { maxRatio: 1.0, score: 4, label: 'Finished with <25% time left' },
  { maxRatio: 1.25, score: 3, label: 'Late by up to 25%' },
  { maxRatio: 1.5, score: 2, label: 'Late by up to 50%' },
  { maxRatio: Infinity, score: 1, label: 'More than 50% late' },
];

const toValidDate = (value) => {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const resolveEstimatedDurationMinutes = ({
  estimatedDurationMinutes,
  scheduledStartAt,
  scheduledEndAt,
} = {}) => {
  const estimated = Number(estimatedDurationMinutes);
  if (Number.isFinite(estimated) && estimated > 0) return Math.round(estimated);

  const start = toValidDate(scheduledStartAt);
  const end = toValidDate(scheduledEndAt);
  if (start && end && end > start) {
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000));
  }
  return null;
};

export const resolveTaskStartAt = ({
  startedAt,
  scheduledStartAt,
  createdAt,
  completedAt,
} = {}) => {
  const completed = toValidDate(completedAt);
  const candidates = [startedAt, scheduledStartAt, createdAt]
    .map(toValidDate)
    .filter(Boolean);

  // Prefer the latest start that is still <= completedAt (avoid future schedule clocks).
  if (completed) {
    const notAfterComplete = candidates.filter((d) => d.getTime() <= completed.getTime());
    if (notAfterComplete.length) {
      return notAfterComplete.reduce((latest, d) =>
        d.getTime() > latest.getTime() ? d : latest
      );
    }
  }

  if (candidates.length) return candidates[0];
  // Last resort: treat as completed instantly so a score can still be assigned.
  return completed;
};

export const getActualTaskDurationMinutes = ({
  startedAt,
  scheduledStartAt,
  createdAt,
  completedAt,
  status,
} = {}) => {
  if (String(status || '').trim() !== 'Completed' || !completedAt) return null;

  const end = toValidDate(completedAt);
  if (!end) return null;

  const start = resolveTaskStartAt({
    startedAt,
    scheduledStartAt,
    createdAt,
    completedAt: end,
  });
  if (!start) return null;

  if (end.getTime() < start.getTime()) return null;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
};

export const computeTaskStarScore = (estimatedDurationMinutes, actualDurationMinutes) => {
  const estimated = Number(estimatedDurationMinutes);
  const actual = Number(actualDurationMinutes);
  if (!Number.isFinite(estimated) || estimated <= 0) return null;
  if (!Number.isFinite(actual) || actual < 0) return null;

  const ratio = actual / estimated;
  const band = TASK_STAR_BANDS.find((b) => ratio <= b.maxRatio) || TASK_STAR_BANDS[TASK_STAR_BANDS.length - 1];
  return band.score;
};

export const getTaskStarBandLabel = (score) => {
  const band = TASK_STAR_BANDS.find((b) => b.score === Number(score));
  return band?.label || '';
};

export const buildAutoTaskRating = ({
  status,
  estimatedDurationMinutes,
  startedAt,
  scheduledStartAt,
  scheduledEndAt,
  createdAt,
  completedAt,
  now = new Date(),
} = {}) => {
  if (String(status || '').trim() !== 'Completed') {
    return {
      score: null,
      comments: '',
      ratedBy: null,
      ratedAt: null,
      auto: true,
    };
  }

  const estimate = resolveEstimatedDurationMinutes({
    estimatedDurationMinutes,
    scheduledStartAt,
    scheduledEndAt,
  });
  const completed = toValidDate(completedAt) || now;
  const actualMinutes = getActualTaskDurationMinutes({
    startedAt,
    scheduledStartAt,
    createdAt,
    completedAt: completed,
    status: 'Completed',
  });

  // If we still cannot compute actual time but have an estimate, treat as on-time (4★).
  const effectiveActual = actualMinutes == null && estimate != null ? estimate : actualMinutes;
  const score = computeTaskStarScore(estimate, effectiveActual);
  if (score == null) return null;

  const label = getTaskStarBandLabel(score);
  const actualLabel = actualMinutes == null ? 'n/a' : `${actualMinutes}`;
  return {
    score,
    comments: `Auto-rated from completion time (${actualLabel} min vs ${estimate} min estimate). ${label}.`,
    ratedBy: null,
    ratedAt: now,
    auto: true,
    startedAtUsed: resolveTaskStartAt({
      startedAt,
      scheduledStartAt,
      createdAt,
      completedAt: completed,
    }),
  };
};
