import mongoose from 'mongoose';

export const ANNOUNCEMENT_PRIORITIES = ['normal', 'high', 'urgent'];
export const ANNOUNCEMENT_STATUSES = ['Draft', 'Published', 'Archived'];

/** Shared announcement schema fields per company. */
export const getAnnouncementFields = (companyRef) => ({
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
  priority: {
    type: String,
    enum: ANNOUNCEMENT_PRIORITIES,
    default: 'high',
  },
  status: {
    type: String,
    enum: ANNOUNCEMENT_STATUSES,
    default: 'Published',
  },
  pinned: {
    type: Boolean,
    default: false,
  },
  notifyEmployees: {
    type: Boolean,
    default: true,
  },
  expiresAt: {
    type: Date,
    default: null,
  },
  publishedAt: {
    type: Date,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: `${companyRef}_Employee`,
    default: null,
  },
});
