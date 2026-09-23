import mongoose from 'mongoose';
import Client from '../../models/gamotechSolution/gamotechSolution_client.js';
import Project from '../../models/gamotechSolution/gamotechSolution_project.js';
import Billing from '../../models/gamotechSolution/gamotechSolution_billing.js';
import Task from '../../models/gamotechSolution/gamotechSolution_task.js';
import SocialMediaCalendar from '../../models/gamotechSolution/gamotechSolution_socialMediaCalendar.js';
import { calculateBillingSummary } from '../../utils/gamotechSolution/gamotechSolution_clientProfileSync.js';
import { computeTracking, withDynamicRemainingCost } from './gamotechSolution_billingController.js';
import { socialStatusToTaskStatus } from '../../utils/taskStatus.js';
import { cacheKey, withCache, invalidateTenantCache, CACHE_TTL } from '../../utils/cache.js';

const COMPANY_KEY = 'gamotechSolution';

// Create a new client
export const createClient = async (req, res) => {
  try {
    const {
      clientName,
      clientNumber,
      mailId,
      businessType,
      services,
      date,
      clientType,
      clientCategory,
      projectEndDate,
      address,
      city,
      state,
      pincode,
      onboardBy,
      mouLink,
      mouSentBy,
      mouSentTo,
      status,
    } = req.body;

    const newClient = new Client({
      clientName,
      clientNumber,
      mailId,
      businessType,
      services: services || [],
      date,
      clientType,
      clientCategory: clientCategory || 'Marketing',
      projectEndDate: clientType === 'Non Recurring' ? projectEndDate : undefined,
      address,
      city: city || '',
      state: state || '',
      pincode: pincode || '',
      onboardBy,
      mouLink,
      mouSentBy,
      mouSentTo,
      status: status || 'Active',
    });

    await newClient.save();
    await invalidateTenantCache(COMPANY_KEY, 'clients', 'dashboard');
    const populated = await Client.findById(newClient._id).populate('onboardBy');
    res.status(201).json({
      message: 'Client created successfully',
      client: populated,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error creating client', error });
  }
};

// Get all clients
export const getClients = async (req, res) => {
  try {
    const filter = {};
    if (req.query.clientCategory) filter.clientCategory = req.query.clientCategory;
    const key = cacheKey(COMPANY_KEY, 'clients', {
      category: String(req.query.clientCategory || ''),
    });
    const { data } = await withCache(key, CACHE_TTL.clients, async () => {
      return Client.find(filter).sort({ createdAt: -1 }).populate('onboardBy').lean();
    });
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching clients', error });
  }
};

/** Aggregated dashboard: projects, billing, tasks, work history */
export const getClientDashboard = async (req, res) => {
  try {
    const clientId = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(clientId)) {
      return res.status(400).json({ message: 'Invalid client id' });
    }

    const client = await Client.findById(clientId).populate('onboardBy');
    if (!client) return res.status(404).json({ message: 'Client not found' });

    const [projects, billingsRaw] = await Promise.all([
      Project.find({ client: clientId }).populate('projectManager').sort({ createdAt: -1 }),
      Billing.find({ client: clientId }).populate('projects.project').sort({ createdAt: -1 }),
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
          ? { _id: p.projectManager._id, name: p.projectManager.name }
          : null,
        progress: p.progress,
        paidFromBilling: paid,
        remainingAmount: remaining,
        projectCostBilling: costFromBilling || budget,
      };
    });

    const projectIds = projects.map((p) => p._id);
    const tasks =
      projectIds.length > 0
        ? await Task.find({
            project: { $in: projectIds },
            isRecurringTemplate: { $ne: true },
          })
            .populate('project', 'projectName')
            .populate('assignedTo', 'name email')
            .populate('assignedBy', 'name email')
            .sort({ updatedAt: -1 })
            .limit(100)
            .lean()
        : [];

    let socialTasks = [];
    const bt = String(client.businessType || '').toLowerCase();
    const isMarketingClient = bt.includes('marketing') || bt.includes('social');
    if (isMarketingClient) {
      const socialCalendar = await SocialMediaCalendar.findOne({ client: clientId })
        .populate('posts.assignedTo', 'name email');
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
              referenceLink: post.referenceLink || '',
              referenceUpload: post.referenceUpload || { fileName: '', mimeType: '', dataUrl: '' },
              clientName: client.clientName || '',
              clientId,
              calendarId: socialCalendar._id,
              postId: post._id,
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
              referenceLink: post.referenceLink || '',
              referenceUpload: post.referenceUpload || { fileName: '', mimeType: '', dataUrl: '' },
              clientName: client.clientName || '',
              clientId,
              calendarId: socialCalendar._id,
              postId: post._id,
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

    res.status(200).json({
      client,
      billingSummary,
      projects: projectsPayload,
      billings,
      tasks: mergedTasks,
      workHistory: workHistory.slice(0, 50),
    });
  } catch (error) {
    res.status(500).json({ message: 'Error loading client dashboard', error: error.message });
  }
};

// Get a single client by ID
export const getClientById = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id).populate('onboardBy');
    if (!client) return res.status(404).json({ message: 'Client not found' });
    res.status(200).json(client);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching client', error });
  }
};

// Update a client by ID
export const updateClient = async (req, res) => {
  try {
    const updates = req.body;
    if (updates.clientType === 'Recurring') {
      updates.projectEndDate = undefined;
    }
    const updated = await Client.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    }).populate('onboardBy');
    await invalidateTenantCache(COMPANY_KEY, 'clients', 'dashboard');
    if (!updated) return res.status(404).json({ message: 'Client not found' });
    res.status(200).json({ message: 'Client updated', client: updated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating client', error });
  }
};

// Delete a client by ID
export const deleteClient = async (req, res) => {
  try {
    const deleted = await Client.findByIdAndDelete(req.params.id);
    await invalidateTenantCache(COMPANY_KEY, 'clients', 'dashboard');
    if (!deleted) return res.status(404).json({ message: 'Client not found' });
    res.status(200).json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting client', error });
  }
};
