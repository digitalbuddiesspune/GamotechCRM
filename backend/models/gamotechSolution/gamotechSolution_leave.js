import mongoose from 'mongoose';
import { getLeaveWorkflowFields } from '../../utils/leaveFields.js';

const leaveSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Employee',
    required: true,
  },
  leaveType: {
    type: String,
    enum: ['Sick', 'Casual', 'Annual', 'Unpaid', 'Other'],
    required: true,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  reason: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Employee',
    default: null,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  rejectionReason: {
    type: String,
    default: '',
  },
  numberOfDays: {
    type: Number,
    default: null,
  },
  ...getLeaveWorkflowFields('gamotechSolution_Employee'),
}, { timestamps: true });

const Leave = mongoose.model('gamotechSolution_Leave', leaveSchema, 'adsresearchglobal_leaves');
export default Leave;
