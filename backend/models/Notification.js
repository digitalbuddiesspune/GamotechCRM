import mongoose from 'mongoose';
import {
  NOTIFICATION_PRIORITY,
  NOTIFICATION_STATUS,
  NOTIFICATION_TYPES,
} from '../utils/notificationConstants.js';

/**
 * Persisted FCM push notification history (meeting app).
 * Distinct from per-company in-app CRM Notification models.
 */
const notificationSchema = new mongoose.Schema(
  {
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CentralAdminUser',
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CentralAdminUser',
      default: null,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
      index: true,
    },
    meetingId: { type: String, default: '', index: true },
    companyId: { type: String, default: '', index: true },
    priority: {
      type: String,
      enum: NOTIFICATION_PRIORITY,
      default: 'normal',
    },
    status: {
      type: String,
      enum: NOTIFICATION_STATUS,
      default: 'queued',
      index: true,
    },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    opened: { type: Boolean, default: false },
    openedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    fcmMessageId: { type: String, default: '' },
    error: { type: String, default: '' },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    image: { type: String, default: '' },
    dedupeKey: { type: String, default: '', index: true },
    expiresAt: { type: Date, default: null, index: true },
    deliveryChannel: {
      type: String,
      enum: ['fcm', 'socket', 'both'],
      default: 'fcm',
    },
    scheduledFor: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ receiver: 1, expiresAt: 1 });
notificationSchema.index({ receiver: 1, read: 1, expiresAt: 1, createdAt: -1 });
notificationSchema.index({ receiver: 1, type: 1, createdAt: -1 });
notificationSchema.index({ status: 1, createdAt: -1 });
notificationSchema.index({ meetingId: 1, type: 1, receiver: 1 });
notificationSchema.index({ title: 'text', body: 'text' });

const Notification = mongoose.model('PushNotification', notificationSchema);

export default Notification;
