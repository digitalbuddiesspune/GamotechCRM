export const getTaskRemainingMinutes = (task, nowMs = Date.now()) => {
  const estimated = Number(task?.estimatedDurationMinutes);
  if (!Number.isFinite(estimated) || estimated <= 0) return null;

  const status = String(task?.status || '').trim();
  if ((status === 'In Progress' || status === 'Paused') && task?.startedAt) {
    const startedMs = new Date(task.startedAt).getTime();
    if (!Number.isNaN(startedMs)) {
      const endMs =
        status === 'Paused' && task?.pausedAt
          ? new Date(task.pausedAt).getTime()
          : nowMs;
      const refMs = Number.isNaN(endMs) ? nowMs : endMs;
      const elapsed = Math.floor((refMs - startedMs) / 60000);
      return Math.max(0, estimated - elapsed);
    }
  }

  return estimated;
};

export const applyTaskStatusTiming = ({ existingStatus, nextStatus, payload = {} }) => {
  const result = { ...payload };

  if (nextStatus === 'Paused') {
    // Keep startedAt; freeze clock
    if (!result.pausedAt) result.pausedAt = new Date();
  } else if (nextStatus === 'In Progress' && existingStatus === 'Paused') {
    // Resume timing is applied by urgentTaskInterrupt.buildResumeFromPausedPayload when auto-resuming.
    // For manual resume via status change, shift startedAt if pausedAt is present.
    const startedMs = result.startedAt
      ? new Date(result.startedAt).getTime()
      : NaN;
    const pausedMs = result.pausedAt ? new Date(result.pausedAt).getTime() : NaN;
    const now = Date.now();
    if (!Number.isNaN(startedMs) && !Number.isNaN(pausedMs) && pausedMs >= startedMs) {
      result.startedAt = new Date(now - (pausedMs - startedMs));
    } else if (!result.startedAt) {
      result.startedAt = new Date();
    }
    result.pausedAt = null;
    result.pausedByUrgentTask = null;
  } else if (nextStatus === 'In Progress' && existingStatus !== 'In Progress') {
    result.startedAt = result.startedAt || new Date();
    result.pausedAt = null;
    result.pausedByUrgentTask = null;
  } else if (nextStatus === 'Completed') {
    // Keep startedAt for auto star rating. Clear pause markers.
    result.pausedAt = null;
    result.pausedByUrgentTask = null;
  } else if (nextStatus !== 'In Progress' && nextStatus !== 'Paused') {
    // Pending / Cancelled — clear active timer
    result.startedAt = null;
    result.pausedAt = null;
    result.pausedByUrgentTask = null;
  }

  return result;
};

export const assertEmployeeAvailableForTask = async () => {
  // Employees may have multiple open tasks at the same time.
};
