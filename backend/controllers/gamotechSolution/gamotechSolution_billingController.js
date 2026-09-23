import Billing from '../../models/gamotechSolution/gamotechSolution_billing.js';
import { syncClientProfile } from '../../utils/gamotechSolution/gamotechSolution_clientProfileSync.js';

/** Financial year (India: Apr–Mar). Returns ending year e.g. 2026 for FY 2025-26 */
function getFinancialYearEnd(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed: Jan=0, Apr=3
  return month >= 3 ? year + 1 : year;
}

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

/** For a list of billings, compute per-project: total project cost (max), total paid (sum of distributed amount), remaining */
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

export const createBilling = async (req, res) => {
  try {
    const fy = getFinancialYearEnd();
    const prefix = `Gamo-${fy}-`;
    const count = await Billing.countDocuments({ invoiceNumber: new RegExp(`^${prefix}`) });
    const seq = count + 1;
    const invoiceNumber = `${prefix}${String(seq).padStart(3, '0')}`;
    const billing = new Billing({ ...req.body, invoiceNumber });
    await billing.save();
    await syncClientProfile({ clientId: billing.client });
    const populated = await Billing.findById(billing._id)
      .populate('client')
      .populate('projects.project');
    res.status(201).json({ message: 'Billing created', billing: withDynamicRemainingCost(populated) });
  } catch (error) {
    res.status(500).json({ message: 'Error creating billing', error });
  }
};

export const getBillings = async (req, res) => {
  try {
    const { clientId, billType } = req.query;
    const filter = {};
    if (clientId) filter.client = clientId;
    if (billType) filter.billType = billType;
    const billings = await Billing.find(filter)
      .populate('client')
      .populate('projects.project')
      .sort({ createdAt: -1 });
    res.status(200).json(billings.map((b) => withDynamicRemainingCost(b)));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching billings', error });
  }
};

export const getBillingById = async (req, res) => {
  try {
    const billing = await Billing.findById(req.params.id)
      .populate('client')
      .populate('projects.project');
    if (!billing) return res.status(404).json({ message: 'Billing not found' });
    const result = withDynamicRemainingCost(billing);
    const clientId = (billing.client?._id || billing.client)?.toString?.();
    if (clientId) {
      const allForClient = await Billing.find({ client: clientId })
        .populate('projects.project')
        .sort({ createdAt: 1 });
      result.tracking = computeTracking(allForClient);
    }
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching billing', error });
  }
};

/** GET /billing/tracking/:clientId - cumulative paid and remaining per project for a client */
export const getBillingTracking = async (req, res) => {
  try {
    const { clientId } = req.params;
    const billings = await Billing.find({ client: clientId })
      .populate('projects.project')
      .sort({ createdAt: 1 });
    const tracking = computeTracking(billings);
    res.status(200).json({ clientId, tracking });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching billing tracking', error });
  }
};

export const updateBilling = async (req, res) => {
  try {
    const previous = await Billing.findById(req.params.id).select('client');
    const updated = await Billing.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    })
      .populate('client')
      .populate('projects.project');
    if (!updated) return res.status(404).json({ message: 'Billing not found' });
    if (previous?.client) await syncClientProfile({ clientId: previous.client });
    if (updated?.client) await syncClientProfile({ clientId: updated.client });
    res.status(200).json({ message: 'Billing updated', billing: withDynamicRemainingCost(updated) });
  } catch (error) {
    res.status(500).json({ message: 'Error updating billing', error });
  }
};

export const deleteBilling = async (req, res) => {
  try {
    const deleted = await Billing.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Billing not found' });
    if (deleted?.client) await syncClientProfile({ clientId: deleted.client });
    res.status(200).json({ message: 'Billing deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting billing', error });
  }
};
