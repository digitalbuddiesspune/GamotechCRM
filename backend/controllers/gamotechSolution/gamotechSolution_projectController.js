import mongoose from 'mongoose';
import Project from '../../models/gamotechSolution/gamotechSolution_project.js';
import Billing from '../../models/gamotechSolution/gamotechSolution_billing.js';
import Task from '../../models/gamotechSolution/gamotechSolution_task.js';
import { syncClientProfile, calculateBillingSummary } from '../../utils/gamotechSolution/gamotechSolution_clientProfileSync.js';
import { computeTracking, withDynamicRemainingCost } from './gamotechSolution_billingController.js';
import { cacheKey, withCache, invalidateTenantCache, CACHE_TTL } from '../../utils/cache.js';

const COMPANY_KEY = 'gamotechSolution';

const normalizeProjectPayload = (body = {}) => {
  const normalized = { ...body };
  const emptyToNullFields = ['projectManager', 'endDate', 'deadline'];
  for (const field of emptyToNullFields) {
    if (normalized[field] === '') normalized[field] = null;
  }
  if (normalized.client === '') normalized.client = null;
  if (!Array.isArray(normalized.teamMembers)) normalized.teamMembers = [];
  normalized.teamMembers = normalized.teamMembers.filter(Boolean);
  return normalized;
};

const extractId = (value) => {
  if (!value) return null;
  if (typeof value === 'object') {
    const raw = value._id ?? value.id;
    return raw ? String(raw) : null;
  }
  return String(value);
};

const getProjectErrorMessage = (error, fallback) => {
  if (!error) return fallback;
  if (error.name === 'ValidationError') {
    const first = Object.values(error.errors || {})[0];
    return first?.message || error.message || fallback;
  }
  if (error.name === 'CastError') {
    return `Invalid value for ${error.path}`;
  }
  return error.message || fallback;
};

// Create a new project
export const createProject = async (req, res) => {
  try {
    const payload = normalizeProjectPayload(req.body);
    const {
      projectName,
      department,
      client,
      description,
      status,
      priority,
      startDate,
      endDate,
      deadline,
      budget,
      progress,
      projectManager,
      teamMembers,
      services,
      notes,
    } = payload;

    const newProject = new Project({
      projectName,
      department: department || 'IT',
      client,
      description,
      status: status || 'Not Started',
      priority: priority || 'Medium',
      startDate,
      endDate,
      deadline,
      budget,
      progress: progress ?? 0,
      projectManager,
      teamMembers: teamMembers || [],
      services: services || [],
      notes,
    });

    await newProject.save();
    await invalidateTenantCache(COMPANY_KEY, 'projects', 'dashboard');
    await syncClientProfile({ clientId: client, preferredProjectId: newProject._id });
    const populated = await Project.findById(newProject._id)
      .populate('client')
      .populate('projectManager')
      .populate('teamMembers');
    res.status(201).json({
      message: 'Project created successfully',
      project: populated,
    });
  } catch (error) {
    console.error('createProject failed:', error);
    const status = ['ValidationError', 'CastError'].includes(error?.name) ? 400 : 500;
    res.status(status).json({ message: getProjectErrorMessage(error, 'Error creating project') });
  }
};

// Get project stats by month for dashboard chart
export const getProjectStatsByMonth = async (req, res) => {
  try {
    const { year, department } = req.query;
    const targetYear = parseInt(year, 10) || new Date().getFullYear();
    const filter = {
      startDate: {
        $gte: new Date(targetYear, 0, 1),
        $lt: new Date(targetYear + 1, 0, 1),
      },
    };
    if (department && department !== 'All') {
      filter.department = department;
    }
    const projects = await Project.find(filter);
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const stats = monthNames.map((name, idx) => ({
      month: name,
      monthNum: idx + 1,
      projectCount: 0,
      totalAmount: 0,
    }));
    projects.forEach((p) => {
      const month = new Date(p.startDate).getMonth();
      stats[month].projectCount += 1;
      stats[month].totalAmount += p.budget || 0;
    });
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching project stats', error });
  }
};

// Get projects assigned to the current employee (projectManager or teamMembers)
export const getMyProjects = async (req, res) => {
  try {
    const { employeeId } = req.query;
    if (!employeeId) {
      return res.status(400).json({ message: 'Employee ID is required' });
    }
    const projects = await Project.find({
      $or: [
        { projectManager: employeeId },
        { teamMembers: employeeId },
      ],
    })
      .populate('client')
      .populate('projectManager')
      .populate('teamMembers');
    res.status(200).json(projects);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching my projects', error });
  }
};

// Get all projects
export const getProjects = async (req, res) => {
  try {
    const key = cacheKey(COMPANY_KEY, 'projects', { list: 'all' });
    const { data } = await withCache(key, CACHE_TTL.projects, async () => {
      return Project.find()
        .populate('client')
        .populate('projectManager')
        .populate('teamMembers')
        .lean();
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching projects', error });
  }
};

/** Aggregated dashboard for one project: client context, billing lines, tasks, activity */
export const getProjectDashboard = async (req, res) => {
  try {
    const projectId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    const projectDoc = await Project.findById(projectId)
      .populate('client')
      .populate('projectManager')
      .populate('teamMembers');

    if (!projectDoc) return res.status(404).json({ message: 'Project not found' });

    const project = projectDoc.toObject();
    const client = project.client || null;
    const clientId = client?._id || project.client;

    const billingsRaw = clientId
      ? await Billing.find({ client: clientId }).populate('projects.project').sort({ createdAt: -1 })
      : [];

    const projectIdStr = projectId.toString();
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

    const tasks = await Task.find({
      project: projectId,
      isRecurringTemplate: { $ne: true },
    })
      .populate('project', 'projectName')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email')
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();

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

    res.status(200).json({
      project,
      client,
      financials,
      billingSummary,
      billings,
      tasks,
      workHistory: workHistory.slice(0, 50),
    });
  } catch (error) {
    console.error('getProjectDashboard failed:', error);
    res.status(500).json({ message: 'Error loading project dashboard', error: error.message });
  }
};

// Get a single project by ID
export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('client')
      .populate('projectManager')
      .populate('teamMembers');
    if (!project) return res.status(404).json({ message: 'Project not found' });
    res.status(200).json(project);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching project', error });
  }
};

// Update a project by ID
export const updateProject = async (req, res) => {
  try {
    const payload = normalizeProjectPayload(req.body);
    const previous = await Project.findById(req.params.id).select('client');
    const updated = await Project.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true,
    })
      .populate('client')
      .populate('projectManager')
      .populate('teamMembers');
    await invalidateTenantCache(COMPANY_KEY, 'projects', 'dashboard');
    if (!updated) return res.status(404).json({ message: 'Project not found' });
    const previousClientId = extractId(previous?.client);
    const updatedClientId = extractId(updated?.client);
    if (previousClientId) await syncClientProfile({ clientId: previousClientId, preferredProjectId: updated._id });
    if (updatedClientId) await syncClientProfile({ clientId: updatedClientId, preferredProjectId: updated._id });
    res.status(200).json({ message: 'Project updated', project: updated });
  } catch (error) {
    console.error('updateProject failed:', error);
    const status = ['ValidationError', 'CastError'].includes(error?.name) ? 400 : 500;
    res.status(status).json({ message: getProjectErrorMessage(error, 'Error updating project') });
  }
};

// Delete a project by ID
export const deleteProject = async (req, res) => {
  try {
    const deleted = await Project.findByIdAndDelete(req.params.id);
    await invalidateTenantCache(COMPANY_KEY, 'projects', 'dashboard');
    if (!deleted) return res.status(404).json({ message: 'Project not found' });
    if (deleted?.client) await syncClientProfile({ clientId: deleted.client });
    res.status(200).json({ message: 'Project deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting project', error });
  }
};
