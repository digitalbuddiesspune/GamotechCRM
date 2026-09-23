export const assertValidTaskSchedule = async ({
  Task,
  Employee,
  Company,
  assigneeId,
  scheduledStartAt,
  scheduledEndAt,
  estimatedDurationMinutes,
  excludeTaskId,
  existingScheduledStartAt = null,
  skipPastCheck = false,
  now = new Date(),
}) => {
  if (!scheduledStartAt) {
    const error = new Error('A scheduled start time is required');
    error.statusCode = 400;
    throw error;
  }

  const start = new Date(scheduledStartAt);
  if (Number.isNaN(start.getTime())) {
    const error = new Error('Invalid scheduled start time');
    error.statusCode = 400;
    throw error;
  }

  const existingStart = existingScheduledStartAt ? new Date(existingScheduledStartAt) : null;
  const startUnchanged =
    existingStart &&
    !Number.isNaN(existingStart.getTime()) &&
    Math.abs(existingStart.getTime() - start.getTime()) < 1000;

  // Only block NEW schedules in the past. Re-saving an existing start (e.g. status
  // change on an in-progress task) must always be allowed.
  // Compare at minute precision — time pickers do not include seconds.
  const startMinute = Math.floor(start.getTime() / 60000);
  const nowMinute = Math.floor(now.getTime() / 60000);
  if (!skipPastCheck && !startUnchanged && startMinute < nowMinute) {
    const error = new Error('Cannot schedule a task in the past');
    error.statusCode = 400;
    throw error;
  }

  let end = scheduledEndAt ? new Date(scheduledEndAt) : null;
  if (!end || Number.isNaN(end.getTime())) {
    const duration = Number(estimatedDurationMinutes);
    if (!Number.isFinite(duration) || duration <= 0) {
      const error = new Error('Task duration is required when scheduling a start time');
      error.statusCode = 400;
      throw error;
    }
    end = new Date(start.getTime() + duration * 60000);
  }

  if (end <= start) {
    const error = new Error('Scheduled end time must be after the start time');
    error.statusCode = 400;
    throw error;
  }

  // Overlapping schedules are allowed: an employee can have multiple tasks at the same time.

  return { scheduledStartAt: start, scheduledEndAt: end };
};
