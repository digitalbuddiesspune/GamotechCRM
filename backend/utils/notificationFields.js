import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'task_assigned',
  'task_reviewed',
  'task_completed',
  'task_status_changed',
  'task_reassigned',
  'announcement',
  'leave_status',
  'asset_assigned',
  'general',
];

export const NOTIFICATION_PRIORITIES = ['low', 'normal', 'high'];

export const getNotificationSchemaFields = (employeeRef) => ({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: employeeRef,
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: NOTIFICATION_TYPES,
    default: 'general',
    index: true,
  },
  title: {
    type: String,
    required: true,
    trim: true,
  },
  message: {
    type: String,
    required: true,
    trim: true,
  },
  link: {
    type: String,
    default: '',
    trim: true,
  },
  read: {
    type: Boolean,
    default: false,
    index: true,
  },
  readAt: {
    type: Date,
    default: null,
  },
  priority: {
    type: String,
    enum: NOTIFICATION_PRIORITIES,
    default: 'normal',
  },
  metadata: {
    entityType: { type: String, default: '' },
    entityId: { type: mongoose.Schema.Types.ObjectId, default: null },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: employeeRef, default: null },
    extra: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  expiresAt: {
    type: Date,
    default: null,
  },
});
