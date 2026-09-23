import mongoose from 'mongoose';

export const SITE_VISIT_STATUSES = [
  'Scheduled',
  'Confirmed',
  'Completed',
  'Cancelled',
  'No Show',
  'Rescheduled',
];

export const SITE_VISIT_TYPES = [
  'First Visit',
  'Follow-up',
  'Inspection',
  'Negotiation',
  'Handover',
  'Other',
];

export const getSiteVisitSchemaFields = ({ employeeRef, propertyRef, leadRef }) => ({
  property: {
    type: mongoose.Schema.Types.ObjectId,
    ref: propertyRef,
    default: null,
    index: true,
  },
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: leadRef,
    default: null,
  },
  visitorName: {
    type: String,
    required: true,
    trim: true,
  },
  visitorPhone: {
    type: String,
    default: '',
    trim: true,
  },
  visitorEmail: {
    type: String,
    default: '',
    trim: true,
  },
  visitType: {
    type: String,
    enum: SITE_VISIT_TYPES,
    default: 'First Visit',
  },
  status: {
    type: String,
    enum: SITE_VISIT_STATUSES,
    default: 'Scheduled',
    index: true,
  },
  scheduledAt: {
    type: Date,
    required: true,
    index: true,
  },
  durationMinutes: {
    type: Number,
    default: 60,
    min: 15,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: employeeRef,
    default: null,
    index: true,
  },
  meetingPoint: {
    type: String,
    default: '',
    trim: true,
  },
  address: {
    type: String,
    default: '',
    trim: true,
  },
  city: {
    type: String,
    default: '',
    trim: true,
  },
  notes: {
    type: String,
    default: '',
  },
  outcome: {
    type: String,
    default: '',
  },
  interested: {
    type: Boolean,
    default: null,
  },
  feedback: {
    type: String,
    default: '',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: employeeRef,
    default: null,
  },
  /** GPS check-in when Site Co-ordinator arrives at the visit. */
  checkInAt: { type: Date, default: null },
  checkInLatitude: { type: Number, default: null },
  checkInLongitude: { type: Number, default: null },
  checkInAddress: { type: String, default: '' },
  /** GPS check-out when leaving the visit. */
  checkOutAt: { type: Date, default: null },
  checkOutLatitude: { type: Number, default: null },
  checkOutLongitude: { type: Number, default: null },
  checkOutAddress: { type: String, default: '' },
  /**
   * Road/travel distance (km) from the previous check-in of the same day
   * to this visit's check-in (haversine approximation).
   */
  travelFromPreviousKm: { type: Number, default: null },
  /** Travel journey this check-in belongs to (supports multiple journeys per day). */
  travelJourneyId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
    index: true,
  },
  /** Allocated travel expense record id (tenant Expense collection). */
  travelExpenseId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null,
  },
  travelExpenseAllocatedAt: { type: Date, default: null },
});
