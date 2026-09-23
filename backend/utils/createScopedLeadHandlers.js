import {
  assertCanAccessLead,
  isSiteVisitAssigneeEmployee,
  resolveLeadAccess,
} from './leadAccess.js';

/**
 * Shared list/filter + viewer scoping for bangar / maha / salesTech leads.
 */
export function createScopedLeadHandlers({ Lead, Employee }) {
  const buildListFilter = (query, access) => {
    const {
      status,
      date,
      dateFrom,
      dateTo,
      employee,
      assignedTo,
      businessType,
      leadSource,
      city,
      state,
      search,
      unassigned,
    } = query;

    const filter = {};

    if (status) filter.status = status;
    if (employee) filter.generatedBy = employee;
    if (city) filter.city = new RegExp(city, 'i');
    if (state) filter.state = new RegExp(state, 'i');
    if (businessType) filter.businessType = new RegExp(businessType, 'i');
    if (leadSource) filter.leadSource = new RegExp(leadSource, 'i');

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      filter.createdAt = { $gte: d, $lt: nextDay };
    } else if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) {
        const d = new Date(dateFrom);
        d.setHours(0, 0, 0, 0);
        filter.createdAt.$gte = d;
      }
      if (dateTo) {
        const d = new Date(dateTo);
        d.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = d;
      }
    }

    const andClauses = [];

    if (access.canViewAllLeads) {
      if (assignedTo) filter.assignedTo = assignedTo;
      if (unassigned === 'true' || unassigned === '1') {
        andClauses.push({ $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }] });
      }
    } else {
      // Sales exec keeps lead via assignedTo; Site Co-ordinator also sees via siteCoordinator
      andClauses.push({
        $or: [
          { assignedTo: access.employeeId },
          { siteCoordinator: access.employeeId },
        ],
      });
    }

    if (search) {
      andClauses.push({
        $or: [
          { name: new RegExp(search, 'i') },
          { businessName: new RegExp(search, 'i') },
          { contactNumber: new RegExp(search, 'i') },
          { leadSource: new RegExp(search, 'i') },
          { description: new RegExp(search, 'i') },
        ],
      });
    }

    if (andClauses.length === 1) {
      Object.assign(filter, andClauses[0]);
    } else if (andClauses.length > 1) {
      filter.$and = andClauses;
    }

    return filter;
  };

  const populateLead = (q) =>
    q
      .populate('generatedBy')
      .populate({
        path: 'assignedTo',
        select: 'name email department designation',
        populate: { path: 'designation', select: 'title accessRole' },
      })
      .populate({
        path: 'siteCoordinator',
        select: 'name email department designation',
        populate: { path: 'designation', select: 'title accessRole' },
      })
      .populate('assignedTeamLeader', 'name email');

  const resolveSiteCoordinatorAssignee = async (assigneeId) => {
    if (!assigneeId) return null;
    const emp = await Employee.findById(assigneeId)
      .populate('designation', 'title name accessRole department')
      .select('name department designation status');
    if (!emp || emp.status === 'Inactive') {
      const err = new Error('Selected employee was not found or is inactive');
      err.statusCode = 400;
      throw err;
    }
    if (!isSiteVisitAssigneeEmployee(emp)) {
      const err = new Error(
        'Selected employee must be in Sales or a Site Co-ordinator / Site Reliability Engineer'
      );
      err.statusCode = 400;
      throw err;
    }
    return emp;
  };

  const getLeads = async (req, res) => {
    try {
      const viewerId = req.query.viewerId || req.query.actorId;
      const access = await resolveLeadAccess(Employee, viewerId);
      const filter = buildListFilter(req.query, access);
      const leads = await populateLead(Lead.find(filter)).sort({ createdAt: -1 });
      res.status(200).json(leads);
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({
        message: error.message || 'Error fetching leads',
        error: status === 500 ? error : undefined,
      });
    }
  };

  const getLeadById = async (req, res) => {
    try {
      const viewerId = req.query.viewerId || req.body?.viewerId || req.body?.actorId;
      const access = await resolveLeadAccess(Employee, viewerId);
      const lead = await populateLead(Lead.findById(req.params.id));
      if (!lead) return res.status(404).json({ message: 'Lead not found' });
      assertCanAccessLead(access, lead);
      res.status(200).json(lead);
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Error fetching lead' });
    }
  };

  const updateLead = async (req, res) => {
    try {
      const viewerId = req.body?.viewerId || req.body?.actorId || req.query.viewerId;
      const access = await resolveLeadAccess(Employee, viewerId);
      const lead = await Lead.findById(req.params.id);
      if (!lead) return res.status(404).json({ message: 'Lead not found' });
      assertCanAccessLead(access, lead);

      const payload = { ...req.body };
      delete payload._id;
      delete payload.__v;
      delete payload.createdAt;
      delete payload.updatedAt;
      delete payload.viewerId;
      delete payload.actorId;

      const nextStatus = payload.status !== undefined ? payload.status : lead.status;
      const requestedSiteCoordinator = Object.prototype.hasOwnProperty.call(payload, 'siteCoordinator')
        ? payload.siteCoordinator
        : undefined;

      if (nextStatus === 'Site Visit' && requestedSiteCoordinator) {
        const coordinator = await resolveSiteCoordinatorAssignee(requestedSiteCoordinator);
        payload.siteCoordinator = coordinator._id;
        payload.siteCoordinatorAssignedAt = new Date();
        // Never replace sales assignee with site coordinator
        delete payload.assignedTo;
        delete payload.assignedTeamLeader;
        delete payload.assignedAt;
        delete payload.distributedBy;
      } else if (!access.canManageLeads) {
        delete payload.assignedTo;
        delete payload.assignedTeamLeader;
        delete payload.assignedAt;
        delete payload.distributedBy;
        if (nextStatus !== 'Site Visit') {
          delete payload.siteCoordinator;
          delete payload.siteCoordinatorAssignedAt;
        }
      }

      const { followUps, ...rest } = payload;
      Object.assign(lead, rest);

      if (Array.isArray(followUps)) {
        lead.followUps = followUps.map((fu) => {
          const row = {
            comments: String(fu.comments ?? fu.text ?? '').trim(),
            date: fu.date ? new Date(fu.date) : new Date(),
          };
          if (fu._id != null && String(fu._id).length > 0) {
            row._id = fu._id;
          }
          return row;
        });
        lead.markModified('followUps');
      }

      if (lead.status === 'Site Visit' && !lead.siteCoordinator) {
        const err = new Error(
          'Please select a Sales or Site Co-ordinator employee when status is Site Visit'
        );
        err.statusCode = 400;
        throw err;
      }

      await lead.save();
      const populated = await populateLead(Lead.findById(lead._id));
      res.status(200).json({ message: 'Lead updated', lead: populated });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Error updating lead' });
    }
  };

  const addFollowUp = async (req, res) => {
    try {
      const viewerId = req.body?.viewerId || req.body?.actorId || req.query.viewerId;
      const access = await resolveLeadAccess(Employee, viewerId);
      const { text, comments, date } = req.body;
      const body = String(comments ?? text ?? '').trim();
      if (!body) {
        return res.status(400).json({ message: 'Comments are required' });
      }
      const lead = await Lead.findById(req.params.id);
      if (!lead) return res.status(404).json({ message: 'Lead not found' });
      assertCanAccessLead(access, lead);
      lead.followUps.push({
        comments: body,
        date: date ? new Date(date) : new Date(),
      });
      await lead.save();
      const populated = await populateLead(Lead.findById(lead._id));
      res.status(200).json({ message: 'Follow-up added', lead: populated });
    } catch (error) {
      const status = error.statusCode || 500;
      res.status(status).json({ message: error.message || 'Error adding follow-up' });
    }
  };

  return { getLeads, getLeadById, updateLead, addFollowUp };
}
