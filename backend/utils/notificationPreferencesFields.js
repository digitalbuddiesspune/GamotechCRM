import mongoose from 'mongoose';

/** Per-channel notification opt-in/out preferences. */
export const notificationPreferencesSchema = new mongoose.Schema(
  {
    meetingAssignments: { type: Boolean, default: true },
    meetingReminders: { type: Boolean, default: true },
    meetingUpdates: { type: Boolean, default: true },
    meetingCancelled: { type: Boolean, default: true },
    systemNotifications: { type: Boolean, default: true },
    marketingNotifications: { type: Boolean, default: false },
  },
  { _id: false },
);
