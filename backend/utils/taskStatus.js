export const TASK_STATUSES = ['Pending', 'In Progress', 'Paused', 'Completed', 'Cancelled'];

/** Workflow rank. In Progress/Paused share a rank so pause/resume stays allowed. */
export const getTaskStatusRank = (status) => {
  const normalized = normalizeTaskStatus(status);
  if (normalized === 'Pending') return 0;
  if (normalized === 'In Progress' || normalized === 'Paused') return 1;
  if (normalized === 'Completed' || normalized === 'Cancelled') return 2;
  return -1;
};

export const normalizeTaskStatus = (status) => {
  if (status == null || status === '') return '';
  const value = String(status).trim();
  if (value === 'InProgress' || value.toLowerCase() === 'in progress') return 'In Progress';
  if (value.toLowerCase() === 'paused' || value.toLowerCase() === 'on hold') return 'Paused';
  if (TASK_STATUSES.includes(value)) return value;
  return value;
};

/**
 * Once a task advances, it cannot move to an earlier status.
 * Completed / Cancelled are terminal (no further status changes).
 */
export const assertForwardOnlyStatusTransition = (fromStatus, toStatus) => {
  const from = normalizeTaskStatus(fromStatus) || 'Pending';
  const to = normalizeTaskStatus(toStatus);
  if (!to || from === to) return;

  if (from === 'Completed' || from === 'Cancelled') {
    const err = new Error(`Task is ${from} and cannot be moved to another status.`);
    err.statusCode = 400;
    throw err;
  }

  const fromRank = getTaskStatusRank(from);
  const toRank = getTaskStatusRank(to);
  if (fromRank < 0 || toRank < 0) return;
  if (toRank < fromRank) {
    const err = new Error(
      `Cannot move task from "${from}" back to "${to}". Status can only move forward.`
    );
    err.statusCode = 400;
    throw err;
  }
};

export const socialStatusToTaskStatus = (status) => {
  if (status === 'Published') return 'Completed';
  if (status === 'Cancelled') return 'Cancelled';
  if (status === 'Draft') return 'In Progress';
  return 'Pending';
};

export const taskStatusToSocialStatus = (status) => {
  const normalized = normalizeTaskStatus(status);
  if (normalized === 'Completed') return 'Published';
  if (normalized === 'Cancelled') return 'Cancelled';
  if (normalized === 'In Progress') return 'Draft';
  return 'Scheduled';
};
