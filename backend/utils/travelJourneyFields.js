import mongoose from 'mongoose';

/**
 * Per-employee travel journey (multiple allowed per business day).
 * Distance is calculated after the coordinator starts each journey.
 */
export const getTravelJourneySchemaFields = ({ employeeRef }) => ({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: employeeRef,
    required: true,
    index: true,
  },
  /** Business-day start used as the day key. */
  date: {
    type: Date,
    required: true,
    index: true,
  },
  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active',
  },
  startedAt: { type: Date, default: null },
  startLatitude: { type: Number, default: null },
  startLongitude: { type: Number, default: null },
  startAddress: { type: String, default: '' },
  endedAt: { type: Date, default: null },
  endLatitude: { type: Number, default: null },
  endLongitude: { type: Number, default: null },
  endAddress: { type: String, default: '' },
  /** GPS breadcrumbs recorded while journey is active (actual path travelled). */
  trackPoints: [
    {
      latitude: { type: Number, required: true },
      longitude: { type: Number, required: true },
      recordedAt: { type: Date, default: Date.now },
      source: {
        type: String,
        enum: ['track', 'journey_start', 'check_in', 'check_out', 'journey_end'],
        default: 'track',
      },
      siteVisitId: { type: mongoose.Schema.Types.ObjectId, default: null },
      address: { type: String, default: '' },
    },
  ],
});
