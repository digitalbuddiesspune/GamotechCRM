export const TASK_STATUSES = ['Pending', 'In Progress', 'Paused', 'Completed', 'Cancelled'];

export const normalizeTaskStatus = (status) => {
  if (status == null || status === '') return '';
  const value = String(status).trim();
  if (value === 'InProgress' || value.toLowerCase() === 'in progress') return 'In Progress';
  if (value.toLowerCase() === 'paused' || value.toLowerCase() === 'on hold') return 'Paused';
  if (TASK_STATUSES.includes(value)) return value;
  return value;
};

export const getTaskStatusColor = (status) => {
  switch (normalizeTaskStatus(status)) {
    case 'Completed':
      return 'bg-green-100 text-green-800';
    case 'In Progress':
      return 'bg-blue-100 text-blue-800';
    case 'Paused':
      return 'bg-violet-100 text-violet-800';
    case 'Pending':
      return 'bg-amber-100 text-amber-800';
    case 'Cancelled':
      return 'bg-gray-100 text-gray-600';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

export const getTaskRemainingMinutes = (task, nowMs = Date.now()) => {
  const estimated = Number(task?.estimatedDurationMinutes);
  if (!Number.isFinite(estimated) || estimated <= 0) return null;

  const status = normalizeTaskStatus(task?.status);
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

/** True if the employee has an open Urgent task (Pending / In Progress). */
export const hasOpenUrgentTask = (tasks = [], employeeId, excludeTaskId = null) => {
  if (!employeeId) return false;
  const emp = String(employeeId);
  return (Array.isArray(tasks) ? tasks : []).some((t) => {
    if (!t || String(t._id) === String(excludeTaskId || '')) return false
    const assignee = t.assignedTo?._id || t.assignedTo
    if (String(assignee) !== emp) return false
    if (String(t.priority || '') !== 'Urgent') return false
    const st = normalizeTaskStatus(t.status)
    return st === 'Pending' || st === 'In Progress'
  })
}

/** Status choices for the task status control (forward-only; Pause only when urgent is open). */
export const getEditableStatusOptions = (task, { hasOpenUrgent = false } = {}) => {
  const current = normalizeTaskStatus(task?.status) || 'Pending'
  const isUrgentTask = String(task?.priority || '') === 'Urgent'

  if (current === 'Completed' || current === 'Cancelled') {
    return [current]
  }

  if (current === 'Paused') {
    if (hasOpenUrgent) return ['Paused', 'Completed', 'Cancelled']
    return ['Paused', 'In Progress', 'Completed', 'Cancelled']
  }

  if (current === 'In Progress') {
    if (hasOpenUrgent && !isUrgentTask) {
      return ['In Progress', 'Paused', 'Completed', 'Cancelled']
    }
    return ['In Progress', 'Completed', 'Cancelled']
  }

  // Pending — can move forward, not sideways into Paused unless urgent rules apply elsewhere
  return ['Pending', 'In Progress', 'Completed', 'Cancelled']
}

export const taskStatusToSocialStatus = (status) => {
  const normalized = normalizeTaskStatus(status);
  if (normalized === 'Completed') return 'Published';
  if (normalized === 'Cancelled') return 'Cancelled';
  if (normalized === 'In Progress') return 'Draft';
  return 'Scheduled';
};

export const formatTaskDuration = (minutes) => {
  const mins = Number(minutes);
  if (!Number.isFinite(mins) || mins <= 0) return null;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
};
