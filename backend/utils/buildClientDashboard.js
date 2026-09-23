/** Distribute payment amount across projects (first first), return projects with dynamic remainingCost */
export function withDynamicRemainingCost(billing) {
  const doc = billing.toObject ? billing.toObject() : { ...billing };
  const paymentAmount = Number(doc.paymentDetails?.amount) || 0;
  const projects = Array.isArray(doc.projects) ? doc.projects : [];
  if (paymentAmount <= 0) {
    doc.projects = projects.map((p) => ({
      ...p,
      remainingCost: Math.max(0, Number(p.projectCost) || 0),
    }));
    return doc;
  }
  let remainingToDistribute = paymentAmount;
  doc.projects = projects.map((p) => {
    const cost = Number(p.projectCost) || 0;
    const amountPaid = Math.min(cost, Math.max(0, remainingToDistribute));
    remainingToDistribute -= amountPaid;
    const remainingCost = Math.max(0, cost - amountPaid);
    return { ...p, remainingCost };
  });
  return doc;
}

/** For a list of billings, compute per-project tracking */
export function computeTracking(billings) {
  const byProject = new Map();
  for (const b of billings) {
    const doc = b.toObject ? b.toObject() : b;
    const paymentAmount = Number(doc.paymentDetails?.amount) || 0;
    const projects = Array.isArray(doc.projects) ? doc.projects : [];
    let remainingToDistribute = paymentAmount;
    for (const p of projects) {
      const projectId = (p.project?._id || p.project)?.toString?.() || p.project;
      if (!projectId) continue;
      const cost = Number(p.projectCost) || 0;
      const amountPaid = paymentAmount <= 0 ? 0 : Math.min(cost, Math.max(0, remainingToDistribute));
      if (paymentAmount > 0) remainingToDistribute -= amountPaid;
      if (!byProject.has(projectId)) {
        byProject.set(projectId, {
          project: p.project,
          projectCost: cost,
          totalPaid: 0,
        });
      }
      const entry = byProject.get(projectId);
      entry.projectCost = Math.max(entry.projectCost, cost);
      entry.totalPaid += amountPaid;
    }
  }
  return Array.from(byProject.values()).map((entry) => ({
    ...entry,
    remaining: Math.max(0, entry.projectCost - entry.totalPaid),
  }));
}

export function calculateBillingSummary(billings) {
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
}

export const socialStatusToTaskStatus = (status) => {
  if (status === 'Published') return 'Completed';
  if (status === 'Cancelled') return 'Cancelled';
  if (status === 'Draft') return 'In Progress';
  return 'Pending';
};

export const buildClientDashboard = async ({
  clientId,
  models: { Client, Project, Billing, Task, SocialMediaCalendar },
}) => {
  const client = await Client.findById(clientId).populate('onboardBy', 'name email').lean();
  if (!client) return null;

  const [projects, billingsRaw] = await Promise.all([
    Project.find({ client: clientId }).populate('projectManager', 'name email').sort({ createdAt: -1 }),
    Billing
      ? Billing.find({ client: clientId }).populate('projects.project').sort({ createdAt: -1 })
      : Promise.resolve([]),
  ]);

  const billings = billingsRaw.map((b) => withDynamicRemainingCost(b));
  const tracking = computeTracking(billingsRaw);
  const trackingByProjectId = new Map(
    tracking.map((t) => {
      const pid = (t.project?._id || t.project)?.toString?.() || String(t.project || '');
      return [pid, t];
    })
  );

  const projectsPayload = projects.map((p) => {
    const pid = p._id.toString();
    const tr = trackingByProjectId.get(pid);
    const budget = Number(p.budget) || 0;
    const paid = tr?.totalPaid ?? 0;
    const costFromBilling = tr?.projectCost ?? 0;
    const remaining = tr != null ? tr.remaining : budget;
    return {
      _id: p._id,
      projectName: p.projectName,
      status: p.status,
      department: p.department,
      startDate: p.startDate,
      endDate: p.endDate,
      deadline: p.deadline,
      budget,
      projectManager: p.projectManager
        ? { _id: p.projectManager._id, name: p.projectManager.name, email: p.projectManager.email }
        : null,
      progress: p.progress,
      paidFromBilling: paid,
      remainingAmount: remaining,
      projectCostBilling: costFromBilling || budget,
    };
  });

  const projectIds = projects.map((p) => p._id);
  const tasks =
    Task && projectIds.length > 0
      ? await Task.find({
          project: { $in: projectIds },
          isRecurringTemplate: { $ne: true },
        })
          .populate('project', 'projectName')
          .populate('assignedTo', 'name email')
          .populate('assignedBy', 'name email')
          .populate('rating.ratedBy', 'name email')
          .sort({ updatedAt: -1 })
          .limit(100)
          .lean()
      : [];

  let socialTasks = [];
  const bt = String(client.businessType || '').toLowerCase();
  const isMarketingClient = bt.includes('marketing') || bt.includes('social');
  if (isMarketingClient && SocialMediaCalendar) {
    const socialCalendar = await SocialMediaCalendar.findOne({ client: clientId }).populate(
      'posts.assignedTo',
      'name email'
    );
    if (socialCalendar && Array.isArray(socialCalendar.posts)) {
      for (const post of socialCalendar.posts) {
        const assignees = Array.isArray(post.assignedTo) ? post.assignedTo : [];
        if (assignees.length === 0) {
          socialTasks.push({
            _id: `social-media-${socialCalendar._id}-${post._id}-unassigned`,
            source: 'social_media',
            title: post.title || 'Social media post',
            description: post.description || post.subject || '',
            project: { _id: 'social-media', projectName: 'Social Media' },
            assignedTo: null,
            assignedBy: { _id: 'social-calendar-system', name: 'Social Media Calendar' },
            createdAt: post.createdAt || socialCalendar.createdAt || new Date(),
            updatedAt: post.updatedAt || socialCalendar.updatedAt || new Date(),
            status: socialStatusToTaskStatus(post.status),
            priority: 'Medium',
            dueDate: post.scheduledTime,
            socialPostStatus: post.status || 'Scheduled',
            platform: post.platform || '',
            contentType: post.contentType || '',
          });
          continue;
        }
        for (const assignee of assignees) {
          const aid = assignee?._id || assignee;
          const aidStr = aid?.toString?.() || String(aid || '');
          socialTasks.push({
            _id: `social-media-${socialCalendar._id}-${post._id}-${aidStr || 'unassigned'}`,
            source: 'social_media',
            title: post.title || 'Social media post',
            description: post.description || post.subject || '',
            project: { _id: 'social-media', projectName: 'Social Media' },
            assignedTo: typeof assignee === 'object' ? assignee : { _id: aid, name: '—' },
            assignedBy: { _id: 'social-calendar-system', name: 'Social Media Calendar' },
            createdAt: post.createdAt || socialCalendar.createdAt || new Date(),
            updatedAt: post.updatedAt || socialCalendar.updatedAt || new Date(),
            status: socialStatusToTaskStatus(post.status),
            priority: 'Medium',
            dueDate: post.scheduledTime,
            socialPostStatus: post.status || 'Scheduled',
            platform: post.platform || '',
            contentType: post.contentType || '',
          });
        }
      }
    }
  }

  const mergedTasks = [...tasks, ...socialTasks].sort(
    (a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
  );

  const billingSummary = calculateBillingSummary(
    billingsRaw.map((b) => (b.toObject ? b.toObject() : { ...b }))
  );

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
  for (const p of projects) {
    workHistory.push({
      type: 'project',
      at: p.createdAt,
      label: `Project created: ${p.projectName}`,
      detail: p.status || '—',
      id: p._id,
    });
  }
  for (const t of mergedTasks.slice(0, 50)) {
    workHistory.push({
      type: 'task',
      at: t.updatedAt || t.createdAt,
      label: t.title,
      detail: `${t.status || '—'} · ${t.project?.projectName || 'Project'}`,
      id: t._id,
    });
  }
  workHistory.sort((a, b) => new Date(b.at) - new Date(a.at));

  return {
    client,
    billingSummary,
    projects: projectsPayload,
    billings,
    tasks: mergedTasks,
    workHistory: workHistory.slice(0, 50),
  };
};
