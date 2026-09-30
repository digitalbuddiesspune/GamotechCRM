import mongoose from 'mongoose';

const leaveCalendarSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    type: {
      type: String,
      enum: [
        'Company Holiday',
        'Public Holiday',
        'Optional Holiday',
        'Restricted Holiday',
        'Team Off',
        'Emergency Leave',
        'Other',
      ],
      default: 'Company Holiday',
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    applicableTo: {
      type: String,
      enum: ['All', 'Department', 'Specific'],
      default: 'All',
    },
    department: {
      type: String,
      default: '',
      trim: true,
    },
    color: {
      type: String,
      default: '#8b5cf6',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'gamotechSolution_Employee',
      default: null,
    },
    createdByName: {
      type: String,
      default: '',
    },
    createdByRole: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

const LeaveCalendar = mongoose.model(
  'gamotechSolution_LeaveCalendar',
  leaveCalendarSchema,
  'adsresearchglobal_leave_calendars'
);

export default LeaveCalendar;
