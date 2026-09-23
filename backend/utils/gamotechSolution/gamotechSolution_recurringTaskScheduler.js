import Task from '../../models/gamotechSolution/gamotechSolution_task.js';
import { syncClientProfileByProjectId } from './gamotechSolution_clientProfileSync.js';
import { applyScheduledTimes } from '../workingHoursTimeline.js';
import { emitTaskChanged } from '../../services/realtimeNotification.service.js';

const MAX_BATCH_SIZE = 100;

const startOfDay = (dateLike) => {
  const d = new Date(dateLike);
  d.setHours(0, 0, 0, 0);
  return d;
};

const addRecurringInterval = (baseDate, recurrenceType, recurrenceInterval) => {
  const next = new Date(baseDate);
  const interval = Math.max(1, Number(recurrenceInterval) || 1);

  if (recurrenceType === 'weekly') {
    next.setDate(next.getDate() + interval * 7);
    return next;
  }
  if (recurrenceType === 'monthly') {
    next.setMonth(next.getMonth() + interval);
    return next;
  }
  next.setDate(next.getDate() + interval);
  return next;
};

const getTemplateScheduledTimes = (template, scheduledFor) => {
  if (!template.scheduledStartAt) {
    return { scheduledStartAt: undefined, scheduledEndAt: undefined };
  }
  const templateStart = new Date(template.scheduledStartAt);
  const startMinutes = templateStart.getHours() * 60 + templateStart.getMinutes();
  return applyScheduledTimes({
    date: scheduledFor,
    startMinutes,
    durationMinutes: template.estimatedDurationMinutes,
  });
};

const createTaskFromTemplate = async (template, scheduledFor) => {
  const alreadyExists = await Task.findOne({
    recurringParentTask: template._id,
    recurringScheduledFor: scheduledFor,
  })
    .select('_id')
    .lean();

  if (alreadyExists) return false;

  const { scheduledStartAt, scheduledEndAt } = getTemplateScheduledTimes(template, scheduledFor);

  const generatedTask = new Task({
    project: template.project,
    title: template.title,
    description: template.description,
    assignedTo: template.assignedTo,
    assignedBy: template.assignedBy,
    status: 'Pending',
    priority: template.priority || 'Medium',
    dueDate: scheduledStartAt || scheduledFor,
    estimatedDurationMinutes: template.estimatedDurationMinutes || null,
    scheduledStartAt: scheduledStartAt || undefined,
    scheduledEndAt: scheduledEndAt || undefined,
    isRecurringTemplate: false,
    recurrenceEnabled: false,
    recurringParentTask: template._id,
    recurringScheduledFor: scheduledFor,
  });

  await generatedTask.save();
  await syncClientProfileByProjectId(template.project);
  if (generatedTask.assignedTo) {
    emitTaskChanged(generatedTask.assignedTo, {
      reason: 'assigned',
      taskId: generatedTask._id,
      status: generatedTask.status,
      title: generatedTask.title,
    });
  }
  return true;
};

export const processRecurringTasks = async () => {
  const now = new Date();
  const dueTemplates = await Task.find({
    isRecurringTemplate: true,
    recurrenceEnabled: true,
    nextRunAt: { $lte: now },
  })
    .sort({ nextRunAt: 1 })
    .limit(MAX_BATCH_SIZE);

  let generatedCount = 0;
  let processedTemplates = 0;

  for (const template of dueTemplates) {
    const scheduledFor = startOfDay(template.nextRunAt || now);
    const created = await createTaskFromTemplate(template, scheduledFor);
    if (created) generatedCount += 1;

    const nextRunAt = addRecurringInterval(
      scheduledFor,
      template.recurrenceType || 'daily',
      template.recurrenceInterval || 1
    );

    const endDate = template.recurrenceEndDate ? startOfDay(template.recurrenceEndDate) : null;
    if (endDate && nextRunAt > endDate) {
      template.recurrenceEnabled = false;
      template.nextRunAt = null;
    } else {
      template.nextRunAt = nextRunAt;
    }

    template.lastGeneratedAt = now;
    await template.save();
    processedTemplates += 1;
  }

  return { processedTemplates, generatedCount };
};

export const getNextRecurringDate = (startDate, recurrenceType, recurrenceInterval) =>
  addRecurringInterval(startOfDay(startDate), recurrenceType, recurrenceInterval);
