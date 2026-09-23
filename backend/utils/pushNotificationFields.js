import mongoose from 'mongoose';

/** Embedded FCM device tokens on user documents. */
export const pushNotificationEntrySchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ['android', 'ios', 'web', 'unknown'],
      default: 'unknown',
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

export const PUSH_PLATFORMS = new Set(['android', 'ios', 'web', 'unknown']);
