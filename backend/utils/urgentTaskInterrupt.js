/**
 * Urgent-task interrupt: pause current In Progress work when Urgent is assigned,
 * and auto-resume those paused tasks when the Urgent task is completed.
 */

const OPEN_URGENT_STATUSES = ['Pending', 'In Progress'];

export const employeeHasOpenUrgentTask = async (Task, employeeId, excludeTaskId = null) => {
  if (!employeeId) return false;
  const filter = {
    assignedTo: employeeId,
    priority: 'Urgent',
    status: { $in: OPEN_URGENT_STATUSES },
    isRecurringTemplate: { $ne: true },
  };
  if (excludeTaskId) filter._id = { $ne: excludeTaskId };
  const found = await Task.exists(filter);
  return Boolean(found);
};

/** Freeze in-progress tasks for an employee when an urgent task is assigned. */
export const pauseInProgressTasksForUrgent = async ({
  Task,
  employeeId,
  urgentTaskId,
  excludeTaskIds = [],
}) => {
  if (!employeeId || !urgentTaskId) return [];

  const exclude = [urgentTaskId, ...excludeTaskIds].filter(Boolean).map(String);
  const open = await Task.find({
    assignedTo: employeeId,
    status: 'In Progress',
    isRecurringTemplate: { $ne: true },
    _id: { $nin: exclude },
  });

  if (!open.length) return [];

  const now = new Date();
  const paused = [];
  for (const task of open) {
    task.status = 'Paused';
    task.pausedAt = now;
    task.pausedByUrgentTask = urgentTaskId;
    // Keep startedAt so remaining time can be restored on resume
    await task.save();
    paused.push(task);
  }
  return paused;
};

/** Restore timing when moving from Paused → In Progress. */
export const buildResumeFromPausedPayload = (task, now = new Date()) => {
  const startedMs = task?.startedAt ? new Date(task.startedAt).getTime() : NaN;
  const pausedMs = task?.pausedAt ? new Date(task.pausedAt).getTime() : NaN;

  let startedAt = now;
  if (!Number.isNaN(startedMs) && !Number.isNaN(pausedMs) && pausedMs >= startedMs) {
    const elapsedBeforePause = pausedMs - startedMs;
    startedAt = new Date(now.getTime() - elapsedBeforePause);
  } else if (!Number.isNaN(startedMs)) {
    startedAt = new Date(startedMs);
  }

  return {
    status: 'In Progress',
    startedAt,
    pausedAt: null,
    pausedByUrgentTask: null,
  };
};

/** Auto-start tasks that were paused because of this urgent task. */
export const resumeTasksPausedByUrgent = async ({ Task, urgentTask }) => {
  if (!urgentTask?._id) return [];
  if (String(urgentTask.priority || '') !== 'Urgent') return [];

  const paused = await Task.find({
    assignedTo: urgentTask.assignedTo,
    status: 'Paused',
    pausedByUrgentTask: urgentTask._id,
    isRecurringTemplate: { $ne: true },
  }).sort({ pausedAt: -1, updatedAt: -1 });

  if (!paused.length) return [];

  const now = new Date();
  const resumed = [];
  for (const task of paused) {
    Object.assign(task, buildResumeFromPausedPayload(task, now));
    await task.save();
    resumed.push(task);
  }
  return resumed;
};

/**
 * Employee may set Paused only while an open urgent task exists for them.
 * Managers (isManager=true) may also pause under the same rule for consistency,
 * or we allow managers always — keep same rule for everyone.
 */
export const assertEmployeeCanPause = async ({ Task, task, nextStatus }) => {
  if (nextStatus !== 'Paused') return;
  if (task?.status === 'Paused') return;

  const assigneeId = task?.assignedTo?._id || task?.assignedTo;
  const hasUrgent = await employeeHasOpenUrgentTask(Task, assigneeId, task?._id);
  if (!hasUrgent) {
    const err = new Error('Pause is only enabled when an urgent task is assigned to you');
    err.statusCode = 400;
    throw err;
  }
};

/** Block starting/resuming non-urgent work while an urgent task is still open. */
export const assertCanStartOrResumeTask = async ({ Task, task, nextStatus }) => {
  if (nextStatus !== 'In Progress') return;
  if (String(task?.priority || '') === 'Urgent') return;

  const assigneeId = task?.assignedTo?._id || task?.assignedTo;
  const hasUrgent = await employeeHasOpenUrgentTask(Task, assigneeId, task?._id);
  if (hasUrgent) {
    const err = new Error('Complete the urgent task first — other tasks stay paused until then');
    err.statusCode = 400;
    throw err;
  }
};

/** After create/update of an urgent task, pause the assignee's in-progress work. */
export const handleUrgentTaskAssigned = async ({ Task, task }) => {
  if (!task || String(task.priority || '') !== 'Urgent') return [];
  if (['Completed', 'Cancelled'].includes(String(task.status || ''))) return [];

  const employeeId = task.assignedTo?._id || task.assignedTo;
  return pauseInProgressTasksForUrgent({
    Task,
    employeeId,
    urgentTaskId: task._id,
  });
};

/** After an urgent task is completed, auto-resume previously paused tasks. */
export const handleUrgentTaskCompleted = async ({ Task, task, previousStatus }) => {
  if (!task || String(task.priority || '') !== 'Urgent') return [];
  if (String(task.status || '') !== 'Completed') return [];
  if (String(previousStatus || '') === 'Completed') return [];

  return resumeTasksPausedByUrgent({ Task, urgentTask: task });
};
