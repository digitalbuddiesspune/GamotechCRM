import LeaveCalendar from '../../models/gamotechSolution/gamotechSolution_leaveCalendar.js';
import Leave from '../../models/gamotechSolution/gamotechSolution_leave.js';
import Employee from '../../models/gamotechSolution/gamotechSolution_employee.js';

const isHigherPositionUser = (employee) => {
  if (!employee) return false;
  const designation = employee.designation;
  const accessRole = String(designation?.accessRole || '').toLowerCase().trim();
  const title = String(designation?.title || designation?.name || '').toLowerCase().trim();
  const level = String(designation?.level || '').toLowerCase().trim();
  const permissions = designation?.permissions || {};

  if (['admin', 'hr', 'manager', 'team_leader', 'technical_lead'].includes(accessRole)) return true;
  if (permissions.hasFullAccess || permissions.canApproveLeave || permissions.canManageEmployees) return true;
  if (['lead', 'manager', 'director', 'executive'].includes(level)) return true;
  if (
    title.includes('admin') ||
    title.includes('hr') ||
    title.includes('manager') ||
    title.includes('team lead') ||
    title.includes('director') ||
    title.includes('lead')
  ) {
    return true;
  }
  return false;
};

const getCurrentMonthStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
};

export const getLeaveCalendar = async (req, res) => {
  try {
    const { year, month, from, to, includeLeaves = 'true' } = req.query;

    const filter = {};
    if (from || to) {
      filter.startDate = {};
      if (from) filter.startDate.$gte = new Date(from);
      if (to) filter.startDate.$lte = new Date(to);
    } else if (year && month) {
      const y = parseInt(year, 10);
      const m = parseInt(month, 10) - 1; // 0-indexed
      const monthStart = new Date(y, m, 1, 0, 0, 0, 0);
      const monthEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
      filter.$or = [
        { startDate: { $gte: monthStart, $lte: monthEnd } },
        { endDate: { $gte: monthStart, $lte: monthEnd } },
        { startDate: { $lte: monthStart }, endDate: { $gte: monthEnd } },
      ];
    }

    const holidays = await LeaveCalendar.find(filter)
      .populate('createdBy', 'name email employeeCode designation')
      .sort({ startDate: 1 });

    let approvedLeaves = [];
    if (includeLeaves === 'true' || includeLeaves === true) {
      const leaveFilter = { status: 'Approved' };
      if (filter.$or) {
        leaveFilter.$or = filter.$or;
      } else if (from || to) {
        leaveFilter.startDate = filter.startDate;
      }

      approvedLeaves = await Leave.find(leaveFilter)
        .populate('employee', 'name email employeeCode department designation')
        .populate('approvedBy', 'name designation')
        .sort({ startDate: 1 });
    }

    return res.status(200).json({
      success: true,
      currentMonthStart: getCurrentMonthStart(),
      holidays,
      employeeLeaves: approvedLeaves,
    });
  } catch (error) {
    console.error('Error fetching leave calendar:', error);
    return res.status(500).json({
      message: 'Failed to load leave calendar',
      error: error?.message || error,
    });
  }
};

export const createLeaveCalendar = async (req, res) => {
  try {
    const {
      title,
      startDate,
      endDate,
      type,
      description,
      applicableTo,
      department,
      color,
      actorId,
    } = req.body;

    if (!title?.trim() || !startDate) {
      return res.status(400).json({ message: 'Title and start date are required' });
    }

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(startDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
      return res.status(400).json({ message: 'End date must be on or after start date' });
    }

    // Restriction: Only current month and upcoming months
    const currentMonthStart = getCurrentMonthStart();
    if (start < currentMonthStart) {
      return res.status(400).json({
        message: 'Leaves can only be set for the current month and upcoming months.',
      });
    }

    // Role check: Only higher position people can set the calendar for leaves
    const creatorId = actorId || req.body.createdBy || req.headers['x-user-id'];
    let creator = null;
    if (creatorId) {
      creator = await Employee.findById(creatorId).populate('designation');
    }

    if (creator && !isHigherPositionUser(creator)) {
      return res.status(403).json({
        message: 'Permission denied: Only higher position personnel (Admin, HR, Managers, Team Leaders) can set the calendar for leaves.',
      });
    }

    const doc = await LeaveCalendar.create({
      title: title.trim(),
      startDate: start,
      endDate: end,
      type: type || 'Company Holiday',
      description: (description || '').trim(),
      applicableTo: applicableTo || 'All',
      department: (department || '').trim(),
      color: color || '#8b5cf6',
      createdBy: creator?._id || null,
      createdByName: creator?.name || 'Higher Management',
      createdByRole: creator?.designation?.title || creator?.designation?.accessRole || 'Management',
    });

    const populated = await LeaveCalendar.findById(doc._id).populate('createdBy', 'name email designation');
    return res.status(201).json({
      message: 'Leave set on calendar successfully',
      event: populated,
    });
  } catch (error) {
    console.error('Error creating leave calendar event:', error);
    return res.status(500).json({
      message: 'Failed to create leave calendar event',
      error: error?.message || error,
    });
  }
};

export const updateLeaveCalendar = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      startDate,
      endDate,
      type,
      description,
      applicableTo,
      department,
      color,
      actorId,
    } = req.body;

    const existing = await LeaveCalendar.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Leave calendar event not found' });
    }

    // Role check
    const creatorId = actorId || req.body.createdBy || req.headers['x-user-id'];
    if (creatorId) {
      const actor = await Employee.findById(creatorId).populate('designation');
      if (actor && !isHigherPositionUser(actor)) {
        return res.status(403).json({
          message: 'Permission denied: Only higher position personnel can modify the leave calendar.',
        });
      }
    }

    const updates = {};
    if (title) updates.title = title.trim();
    if (type) updates.type = type;
    if (description !== undefined) updates.description = description.trim();
    if (applicableTo) updates.applicableTo = applicableTo;
    if (department !== undefined) updates.department = department.trim();
    if (color) updates.color = color;

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      const currentMonthStart = getCurrentMonthStart();
      if (start < currentMonthStart) {
        return res.status(400).json({
          message: 'Leaves can only be set for the current month and upcoming months.',
        });
      }
      updates.startDate = start;
    }

    if (endDate || startDate) {
      const start = updates.startDate || existing.startDate;
      const end = endDate ? new Date(endDate) : updates.startDate || existing.endDate;
      end.setHours(23, 59, 59, 999);
      if (end < start) {
        return res.status(400).json({ message: 'End date must be on or after start date' });
      }
      updates.endDate = end;
    }

    const updated = await LeaveCalendar.findByIdAndUpdate(id, updates, { new: true })
      .populate('createdBy', 'name email designation');

    return res.status(200).json({
      message: 'Leave calendar event updated',
      event: updated,
    });
  } catch (error) {
    console.error('Error updating leave calendar event:', error);
    return res.status(500).json({
      message: 'Failed to update leave calendar event',
      error: error?.message || error,
    });
  }
};

export const deleteLeaveCalendar = async (req, res) => {
  try {
    const { id } = req.params;
    const actorId = req.query.actorId || req.body?.actorId || req.headers['x-user-id'];

    if (actorId) {
      const actor = await Employee.findById(actorId).populate('designation');
      if (actor && !isHigherPositionUser(actor)) {
        return res.status(403).json({
          message: 'Permission denied: Only higher position personnel can delete calendar leaves.',
        });
      }
    }

    const deleted = await LeaveCalendar.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ message: 'Leave calendar event not found' });
    }

    return res.status(200).json({
      message: 'Leave calendar event deleted',
      id,
    });
  } catch (error) {
    console.error('Error deleting leave calendar event:', error);
    return res.status(500).json({
      message: 'Failed to delete leave calendar event',
      error: error?.message || error,
    });
  }
};
