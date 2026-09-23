import { buildAutoTaskRating } from './taskStarRating.js';

/**
 * When a task is marked Completed, auto-set star rating from completion time
 * unless the client explicitly sent a rating payload (manual override).
 * When reopened / cancelled, clear auto ratings.
 * Also backfills Completed tasks that somehow have no score yet.
 */
export const applyAutoTaskStarRating = ({
  existing,
  payload,
  nextStatus,
  ratingProvidedInRequest,
}) => {
  const result = { ...payload };

  if (ratingProvidedInRequest) {
    // Manual rating wins; ensure auto flag is false unless client set it
    if (result.rating && typeof result.rating === 'object' && result.rating.auto === undefined) {
      result.rating = { ...result.rating, auto: false };
    }
    return result;
  }

  const becomingCompleted = nextStatus === 'Completed' && existing?.status !== 'Completed';
  const leavingCompleted = nextStatus !== 'Completed' && existing?.status === 'Completed';
  const completedMissingScore =
    nextStatus === 'Completed' &&
    !(Number(existing?.rating?.score) >= 1) &&
    !(Number(result?.rating?.score) >= 1);

  if (becomingCompleted || completedMissingScore) {
    const completedAt = result.completedAt || existing?.completedAt || new Date();
    result.completedAt = completedAt;

    const estimatedDurationMinutes =
      result.estimatedDurationMinutes !== undefined
        ? result.estimatedDurationMinutes
        : existing?.estimatedDurationMinutes;
    const scheduledStartAt =
      result.scheduledStartAt !== undefined
        ? result.scheduledStartAt
        : existing?.scheduledStartAt;
    const scheduledEndAt =
      result.scheduledEndAt !== undefined
        ? result.scheduledEndAt
        : existing?.scheduledEndAt;
    const startedAt = result.startedAt || existing?.startedAt || null;
    const createdAt = existing?.createdAt || null;

    const autoRating = buildAutoTaskRating({
      status: 'Completed',
      estimatedDurationMinutes,
      startedAt,
      scheduledStartAt,
      scheduledEndAt,
      createdAt,
      completedAt,
    });

    if (autoRating) {
      result.rating = {
        score: autoRating.score,
        comments: autoRating.comments,
        ratedBy: null,
        ratedAt: autoRating.ratedAt,
        auto: true,
      };
      // Persist a start timestamp so duration remains auditable
      if (!startedAt && autoRating.startedAtUsed) {
        result.startedAt = autoRating.startedAtUsed;
      } else if (!startedAt) {
        result.startedAt = scheduledStartAt || createdAt || completedAt;
      }
    }
  } else if (leavingCompleted) {
    result.completedAt = null;
    if (existing?.rating?.auto || !existing?.rating?.score) {
      result.rating = { score: null, comments: '', ratedBy: null, ratedAt: null, auto: false };
    }
  } else if (nextStatus === 'Cancelled' && existing?.rating?.auto) {
    result.rating = { score: null, comments: '', ratedBy: null, ratedAt: null, auto: false };
  }

  return result;
};
