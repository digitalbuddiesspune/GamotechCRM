import mongoose from 'mongoose';
import { getNotificationSchemaFields } from '../../utils/notificationFields.js';

const notificationSchema = new mongoose.Schema(
  getNotificationSchemaFields('gamotechSolution_Employee'),
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('gamotechSolution_Notification', notificationSchema, 'adsresearchglobal_notifications');
export default Notification;
