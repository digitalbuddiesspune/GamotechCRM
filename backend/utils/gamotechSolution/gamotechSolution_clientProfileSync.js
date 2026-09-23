import ClientProfile from '../../models/gamotechSolution/gamotechSolution_clientProfile.js';
import Project from '../../models/gamotechSolution/gamotechSolution_project.js';
import Task from '../../models/gamotechSolution/gamotechSolution_task.js';
import Billing from '../../models/gamotechSolution/gamotechSolution_billing.js';
import SocialMediaCalendar from '../../models/gamotechSolution/gamotechSolution_socialMediaCalendar.js';

const dayNow = () => new Date();

export const calculateBillingSummary = (billings) => {
  const byProject = new Map();
  let totalAmountPaid = 0;

  for (const b of billings) {
    const paymentAmount = Number(b?.paymentDetails?.amount) || 0;
    totalAmountPaid += paymentAmount;
    const projects = Array.isArray(b.projects) ? b.projects : [];
    let remainingToDistribute = paymentAmount;

    for (const p of projects) {
      const projectId = (p.project?._id || p.project)?.toString?.() || p.project?.toString?.();
      if (!projectId) continue;
      const cost = Number(p.projectCost) || 0;
      const paidForThisBill = paymentAmount > 0 ? Math.min(cost, Math.max(0, remainingToDistribute)) : 0;
      if (paymentAmount > 0) remainingToDistribute -= paidForThisBill;

      if (!byProject.has(projectId)) {
        byProject.set(projectId, { projectCost: cost, totalPaid: 0 });
      }
      const entry = byProject.get(projectId);
      entry.projectCost = Math.max(entry.projectCost, cost);
      entry.totalPaid += paidForThisBill;
    }
  }

  const totalAmountPending = Array.from(byProject.values()).reduce(
    (sum, p) => sum + Math.max(0, p.projectCost - p.totalPaid),
    0
  );

  return {
    totalInvoicesGenerated: billings.length,
    totalAmountPaid,
    totalAmountPending,
  };
};

const calculateDeadlines = (projects) => {
  const allDates = projects
    .map((p) => p.deadline || p.endDate)
    .filter(Boolean)
    .map((d) => new Date(d))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());

  if (!allDates.length) return { projectDeadline: null, nextProjectDeadline: null };

  const now = dayNow();
  const nextUpcoming = allDates.find((d) => d >= now) || allDates[0];
  const latest = allDates[allDates.length - 1];
  return { projectDeadline: latest, nextProjectDeadline: nextUpcoming };
};

export const syncClientProfile = async ({ clientId, preferredProjectId = null }) => {
  if (!clientId) return null;

  const clientObjId = clientId.toString();

  const [projects, calendars, billings] = await Promise.all([
    Project.find({ client: clientObjId }).select('_id deadline endDate').lean(),
    SocialMediaCalendar.find({ client: clientObjId }).select('_id').lean(),
    Billing.find({ client: clientObjId }).select('projects paymentDetails').lean(),
  ]);

  const projectIds = projects.map((p) => p._id);
  const tasks = await Task.find({ project: { $in: projectIds } }).select('status dueDate').lean();

  const totalCreatedTasks = tasks.length;
  const totalCompletedTasks = tasks.filter((t) => t.status === 'Completed').length;
  const totalPendingTasks = tasks.filter((t) => ['Pending', 'In Progress'].includes(t.status)).length;
  const now = dayNow();
  const delayedTasks = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < now && !['Completed', 'Cancelled'].includes(t.status)
  ).length;

  const { totalInvoicesGenerated, totalAmountPaid, totalAmountPending } = calculateBillingSummary(billings);
  const { projectDeadline, nextProjectDeadline } = calculateDeadlines(projects);

  const defaultProjectId =
    preferredProjectId ||
    (projects.length ? projects[0]._id : null);

  const updated = await ClientProfile.findOneAndUpdate(
    { client: clientObjId },
    {
      $set: {
        client: clientObjId,
        project: defaultProjectId,
        totalCreatedTasks,
        totalCompletedTasks,
        totalPendingTasks,
        delayedTasks,
        socialMediaCalendars: calendars.map((c) => c._id),
        totalInvoicesGenerated,
        totalAmountPaid,
        totalAmountPending,
        projectDeadline,
        nextProjectDeadline,
        lastSyncedAt: now,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return updated;
};

export const syncClientProfileByProjectId = async (projectId) => {
  if (!projectId) return null;
  const project = await Project.findById(projectId).select('client').lean();
  if (!project?.client) return null;
  return syncClientProfile({ clientId: project.client, preferredProjectId: projectId });
};

