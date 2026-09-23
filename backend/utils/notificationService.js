const toId = (value) => {
  if (!value) return null;
  if (typeof value === 'object' && value._id) return value._id;
  return value;
};

export const createNotificationService = ({ Notification }) => {
  const createOne = async ({
    recipientId,
    type = 'general',
    title,
    message,
    link = '',
    priority = 'normal',
    metadata = {},
    expiresAt = null,
  }) => {
    if (!recipientId || !title?.trim() || !message?.trim()) return null;

    return Notification.create({
      recipient: recipientId,
      type,
      title: title.trim(),
      message: message.trim(),
      link: String(link || '').trim(),
      priority,
      metadata: {
        entityType: metadata.entityType || '',
        entityId: metadata.entityId || null,
        actor: metadata.actor || null,
        extra: metadata.extra ?? null,
      },
      expiresAt: expiresAt || null,
    });
  };

  const createMany = async (items = []) => {
    const docs = items
      .filter((item) => item?.recipientId && item?.title?.trim() && item?.message?.trim())
      .map((item) => ({
        recipient: item.recipientId,
        type: item.type || 'general',
        title: item.title.trim(),
        message: item.message.trim(),
        link: String(item.link || '').trim(),
        priority: item.priority || 'normal',
        metadata: {
          entityType: item.metadata?.entityType || '',
          entityId: item.metadata?.entityId || null,
          actor: item.metadata?.actor || null,
          extra: item.metadata?.extra ?? null,
        },
        expiresAt: item.expiresAt || null,
      }));

    if (!docs.length) return [];
    return Notification.insertMany(docs);
  };

  const notifyTaskAssigned = async ({ task, actorId = null }) => {
    const recipientId = toId(task?.assignedTo);
    const assignedById = toId(task?.assignedBy);
    const actor = actorId || assignedById;
    if (!recipientId) return null;

    const assignerName =
      typeof task?.assignedBy === 'object' ? task.assignedBy?.name : 'Someone';
    const projectName =
      typeof task?.project === 'object' ? task.project?.projectName : 'a project';

    return createOne({
      recipientId,
      type: 'task_assigned',
      title: 'New task assigned',
      message: `${assignerName} assigned you "${task.title}" in ${projectName}.`,
      link: '/tasks',
      priority: task.priority === 'Urgent' ? 'high' : 'normal',
      metadata: {
        entityType: 'task',
        entityId: task._id,
        actor,
        extra: { taskTitle: task.title, priority: task.priority },
      },
    });
  };

  const notifyTaskReviewed = async ({ task, actorId = null }) => {
    const recipientId = toId(task?.assignedTo);
    const ratedById = toId(task?.rating?.ratedBy) || actorId;
    if (!recipientId || !task?.rating?.score) return null;

    const reviewerName =
      typeof task?.rating?.ratedBy === 'object'
        ? task.rating.ratedBy?.name
        : 'Your manager';

    return createOne({
      recipientId,
      type: 'task_reviewed',
      title: 'Task reviewed',
      message: `${reviewerName} rated "${task.title}" ${task.rating.score}/5.`,
      link: '/tasks',
      metadata: {
        entityType: 'task',
        entityId: task._id,
        actor: ratedById,
        extra: {
          score: task.rating.score,
          comments: task.rating.comments || '',
        },
      },
    });
  };

  const notifyTaskCompleted = async ({ task, actorId = null }) => {
    const assignerId = toId(task?.assignedBy);
    if (!assignerId) return null;

    const assigneeName =
      typeof task?.assignedTo === 'object' ? task.assignedTo?.name : 'An employee';

    return createOne({
      recipientId: assignerId,
      type: 'task_completed',
      title: 'Task completed',
      message: `${assigneeName} completed "${task.title}".`,
      link: '/tasks',
      metadata: {
        entityType: 'task',
        entityId: task._id,
        actor: actorId || toId(task?.assignedTo),
      },
    });
  };

  const notifyTaskStatusChanged = async ({ task, previousStatus, actorId = null }) => {
    const recipientId = toId(task?.assignedTo);
    const assignerId = toId(task?.assignedBy);
    const actor = actorId || recipientId;
    const notifyRecipient = recipientId?.toString() !== actor?.toString() ? recipientId : assignerId;
    if (!notifyRecipient || previousStatus === task?.status) return null;

    return createOne({
      recipientId: notifyRecipient,
      type: 'task_status_changed',
      title: 'Task status updated',
      message: `"${task.title}" changed from ${previousStatus} to ${task.status}.`,
      link: '/tasks',
      metadata: {
        entityType: 'task',
        entityId: task._id,
        actor,
        extra: { previousStatus, newStatus: task.status },
      },
    });
  };

  const notifyAnnouncement = async ({ recipientIds = [], title, message, actorId = null, link = '' }) => {
    const items = recipientIds.map((recipientId) => ({
      recipientId,
      type: 'announcement',
      title,
      message,
      link: link || '/dashboard',
      priority: 'high',
      metadata: {
        entityType: 'announcement',
        actor: actorId,
      },
    }));
    return createMany(items);
  };

  return {
    createOne,
    createMany,
    notifyTaskAssigned,
    notifyTaskReviewed,
    notifyTaskCompleted,
    notifyTaskStatusChanged,
    notifyAnnouncement,
  };
};
