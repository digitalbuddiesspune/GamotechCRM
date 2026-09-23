import mongoose from 'mongoose';
import { getTaskDurationAndRatingFields } from '../../utils/taskFields.js';

const taskSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Project',
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Employee',
    required: true,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Employee',
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Paused', 'Completed', 'Cancelled'],
    default: 'Pending',
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium',
  },
  dueDate: {
    type: Date,
  },
  ...getTaskDurationAndRatingFields('gamotechSolution_Employee'),
  completedAt: {
    type: Date,
    default: null,
  },
  isRecurringTemplate: {
    type: Boolean,
    default: false,
  },
  recurrenceEnabled: {
    type: Boolean,
    default: false,
  },
  recurrenceType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly'],
  },
  recurrenceInterval: {
    type: Number,
    default: 1,
  },
  recurrenceStartDate: {
    type: Date,
  },
  recurrenceEndDate: {
    type: Date,
  },
  nextRunAt: {
    type: Date,
  },
  lastGeneratedAt: {
    type: Date,
  },
  recurringParentTask: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Task',
    default: null,
  },
  recurringScheduledFor: {
    type: Date,
  },
}, { timestamps: true });

const Task = mongoose.model('gamotechSolution_Task', taskSchema, 'adsresearchglobal_tasks');
export default Task;
