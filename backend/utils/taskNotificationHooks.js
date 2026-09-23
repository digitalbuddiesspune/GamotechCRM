import { emitTaskChanged } from '../services/realtimeNotification.service.js';

const toId = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const notifyAssigneeSocket = (task, reason, extra = {}) => {
  const assigneeId = toId(task?.assignedTo);
  if (!assigneeId) return;
  emitTaskChanged(assigneeId, {
    reason,
    taskId: task?._id,
    status: task?.status,
    title: task?.title,
    ...extra,
  });
};

export const runTaskNotificationSideEffects = async ({
  notificationService,
  existing = null,
  updated,
}) => {
  if (!updated || !notificationService) return;

  try {
    if (!existing) {
      await notificationService.notifyTaskAssigned({ task: updated });
      notifyAssigneeSocket(updated, 'assigned');
      return;
    }

    const prevAssigned = toId(existing.assignedTo);
    const nextAssigned = toId(updated.assignedTo);

    if (nextAssigned && prevAssigned !== nextAssigned) {
      await notificationService.notifyTaskAssigned({ task: updated });
      if (prevAssigned) {
        emitTaskChanged(prevAssigned, {
          reason: 'unassigned',
          taskId: updated._id,
          status: updated.status,
          title: updated.title,
        });
      }
      notifyAssigneeSocket(updated, 'assigned');
    }

    const prevScore = existing.rating?.score ?? null;
    const nextScore = updated.rating?.score ?? null;
    if (nextScore && prevScore !== nextScore) {
      await notificationService.notifyTaskReviewed({ task: updated });
    }

    if (existing.status !== updated.status) {
      if (updated.status === 'Completed') {
        await notificationService.notifyTaskCompleted({ task: updated });
      } else {
        await notificationService.notifyTaskStatusChanged({
          task: updated,
          previousStatus: existing.status,
        });
      }
      notifyAssigneeSocket(updated, 'status', {
        previousStatus: existing.status,
      });
    }
  } catch (error) {
    console.error('Task notification side effect failed:', error?.message || error);
  }
};
