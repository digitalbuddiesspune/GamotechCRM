import mongoose from 'mongoose';

/** Duration and performance rating fields shared across company task models. */
export const getTaskDurationAndRatingFields = (employeeRef) => ({
  estimatedDurationMinutes: {
    type: Number,
    min: 1,
    default: null,
  },
  startedAt: {
    type: Date,
    default: null,
  },
  /** When status is Paused, freezes the active timer at this instant. */
  pausedAt: {
    type: Date,
    default: null,
  },
  /** Urgent task that caused this pause (auto-resume when that task completes). */
  pausedByUrgentTask: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  scheduledStartAt: {
    type: Date,
    default: null,
  },
  scheduledEndAt: {
    type: Date,
    default: null,
  },
  rating: {
    score: { type: Number, min: 1, max: 5, default: null },
    comments: { type: String, default: '' },
    ratedBy: { type: mongoose.Schema.Types.ObjectId, ref: employeeRef, default: null },
    ratedAt: { type: Date, default: null },
    /** true when score was set by completion-time automation */
    auto: { type: Boolean, default: false },
  },
});
