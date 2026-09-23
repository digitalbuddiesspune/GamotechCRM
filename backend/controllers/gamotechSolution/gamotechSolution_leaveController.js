import Leave from '../../models/gamotechSolution/gamotechSolution_leave.js';
import Employee from '../../models/gamotechSolution/gamotechSolution_employee.js';
import Notification from '../../models/gamotechSolution/gamotechSolution_notification.js';
import { createLeaveHandlers } from '../../utils/createLeaveHandlers.js';

export const leaveHandlers = createLeaveHandlers({ Leave, Employee, Notification });

const getNumberOfDays = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  const diffMs = end - start;
  return Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)) + 1);
};

export const createLeave = async (req, res) => {
  try {
    const { employee, leaveType, startDate, endDate, reason } = req.body;
    if (!employee || !leaveType || !startDate || !endDate) {
      return res.status(400).json({ message: 'Employee, leave type, start date and end date are required' });
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({ message: 'End date must be on or after start date' });
    }
    const numberOfDays = getNumberOfDays(start, end);
    const leave = new Leave({
      employee,
      leaveType,
      startDate: start,
      endDate: end,
      reason: reason || '',
      numberOfDays,
    });
    await leave.save();
    const populated = await Leave.findById(leave._id).populate('employee');
    res.status(201).json({ message: 'Leave application submitted', leave: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error creating leave application', error });
  }
};

export const getLeaves = async (req, res) => {
  try {
    const { employeeId, status } = req.query;
    const filter = {};
    if (employeeId && employeeId.trim()) filter.employee = employeeId.trim();
    if (status && status.trim()) filter.status = status.trim();
    const leaves = await Leave.find(filter)
      .populate('employee')
      .populate('approvedBy')
      .sort({ createdAt: -1 });
    res.status(200).json(leaves);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leaves', error });
  }
};

export const getLeaveById = async (req, res) => {
  try {
    const leave = await Leave.findById(req.params.id).populate('employee').populate('approvedBy');
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    res.status(200).json(leave);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching leave', error });
  }
};

export const updateLeaveStatus = async (req, res) => {
  try {
    const { status, approvedBy, rejectionReason } = req.body;
    if (!status || !['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ message: 'Status must be Approved or Rejected' });
    }
    const leave = await Leave.findById(req.params.id);
    if (!leave) return res.status(404).json({ message: 'Leave not found' });
    if (leave.status !== 'Pending') {
      return res.status(400).json({ message: 'Leave has already been processed' });
    }
    leave.status = status;
    leave.approvedBy = approvedBy || null;
    leave.approvedAt = new Date();
    if (status === 'Rejected') leave.rejectionReason = rejectionReason || '';
    await leave.save();
    const populated = await Leave.findById(leave._id).populate('employee').populate('approvedBy');
    res.status(200).json({ message: `Leave ${status.toLowerCase()}`, leave: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating leave status', error });
  }
};
