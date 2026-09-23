import {
  withDynamicRemainingCost,
  computeTracking,
  calculateBillingSummary,
} from './buildClientDashboard.js';

export const buildProjectDashboard = async ({
  projectId,
  models: { Project, Billing, Task },
}) => {
  const projectDoc = await Project.findById(projectId)
    .populate({
      path: 'client',
      populate: { path: 'onboardBy', select: 'name email' },
    })
    .populate('projectManager', 'name email')
    .populate('teamMembers', 'name email');

  if (!projectDoc) return null;

  const project = projectDoc.toObject();
  const client = project.client || null;
  const clientId = client?._id || project.client;
  const billingsRaw =
    Billing && clientId
      ? await Billing.find({ client: clientId }).populate('projects.project').sort({ createdAt: -1 })
      : [];

  const projectIdStr = String(projectId);
  const billingsForProject = billingsRaw.filter((b) => {
    const arr = b.projects || [];
    return arr.some((line) => {
      const pid = (line.project?._id || line.project)?.toString?.() || String(line.project || '');
      return pid === projectIdStr;
    });
  });

  const billings = billingsForProject.map((b) => withDynamicRemainingCost(b));

  const tracking = computeTracking(
    billingsRaw.map((b) => (b.toObject ? b.toObject() : { ...b }))
  );
  const tr = tracking.find((t) => {
    const pid = (t.project?._id || t.project)?.toString?.() || String(t.project || '');
    return pid === projectIdStr;
  });

  const budget = Number(project.budget) || 0;
  const paid = tr?.totalPaid ?? 0;
  const costFromBilling = tr?.projectCost ?? 0;
  const remaining = tr != null ? tr.remaining : Math.max(0, budget - paid);

  const billingSummary = calculateBillingSummary(
    billingsForProject.map((b) => (b.toObject ? b.toObject() : { ...b }))
  );

  const tasks = Task
    ? await Task.find({
        project: projectId,
        isRecurringTemplate: { $ne: true },
      })
        .populate('project', 'projectName status department budget startDate endDate deadline')
        .populate('assignedTo', 'name email')
        .populate('assignedBy', 'name email')
        .populate('rating.ratedBy', 'name email')
        .sort({ updatedAt: -1 })
        .limit(100)
        .lean()
    : [];

  const workHistory = [];
  for (const b of billings) {
    const amt = b.paymentDetails?.amount;
    workHistory.push({
      type: 'invoice',
      at: b.createdAt,
      label: `Invoice ${b.invoiceNumber || String(b._id).slice(-6)}`,
      detail:
        amt != null && amt !== ''
          ? `Recorded payment: ₹${Number(amt).toLocaleString('en-IN')}`
          : '—',
      id: b._id,
    });
  }
  workHistory.push({
    type: 'project',
    at: project.createdAt,
    label: `Project created: ${project.projectName}`,
    detail: project.status || '—',
    id: project._id,
  });
  for (const t of tasks.slice(0, 50)) {
    workHistory.push({
      type: 'task',
      at: t.updatedAt || t.createdAt,
      label: t.title,
      detail: `${t.status || '—'} · ${t.project?.projectName || 'Project'}`,
      id: t._id,
    });
  }
  workHistory.sort((a, b) => new Date(b.at) - new Date(a.at));

  const financials = {
    budget,
    projectCostBilling: costFromBilling || budget,
    paidFromBilling: paid,
    remainingAmount: remaining,
  };

  // Strip heavy nested client from project payload; return separately
  const { client: _c, ...projectRest } = project;

  return {
    project: projectRest,
    client,
    financials,
    billingSummary,
    billings,
    tasks,
    workHistory: workHistory.slice(0, 50),
  };
};
