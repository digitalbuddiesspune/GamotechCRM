import mongoose from 'mongoose';

/**
 * Enterprise audit trail for push notifications.
 * Separate from in-app history — used for compliance and debugging.
 */
const auditSchema = new mongoose.Schema(
  {
    notificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PushNotification',
      index: true,
    },
    event: {
      type: String,
      enum: ['created', 'queued', 'sent', 'delivered', 'failed', 'opened', 'read', 'deduped'],
      required: true,
      index: true,
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'CentralAdminUser', default: null },
    receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'CentralAdminUser', default: null },
    companyId: { type: String, default: '', index: true },
    type: { type: String, default: '' },
    meetingId: { type: String, default: '' },
    deviceToken: { type: String, default: '' },
    platform: { type: String, default: '' },
    ip: { type: String, default: '' },
    channel: { type: String, enum: ['fcm', 'socket', 'both'], default: 'fcm' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

auditSchema.index({ createdAt: -1 });
auditSchema.index({ receiverId: 1, event: 1, createdAt: -1 });
auditSchema.index({ companyId: 1, createdAt: -1 });

const NotificationAuditLog = mongoose.model('NotificationAuditLog', auditSchema);

export default NotificationAuditLog;
