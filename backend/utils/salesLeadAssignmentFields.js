import mongoose from 'mongoose';

/** Assignment fields for sales-team lead distribution. */
export const getSalesLeadAssignmentFields = (employeeRef) => ({
  /** Sales employee this lead is assigned to (Sales department). */
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: employeeRef,
    default: null,
    index: true,
  },
  /** Sales Team Leader whose pool this lead was taken from. */
  assignedTeamLeader: {
    type: mongoose.Schema.Types.ObjectId,
    ref: employeeRef,
    default: null,
    index: true,
  },
  assignedAt: {
    type: Date,
    default: null,
  },
  distributedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: employeeRef,
    default: null,
  },
  /**
   * Site Co-ordinator / Site Reliability Engineer for Site Visit status.
   * Does not replace sales `assignedTo` — both keep access to the lead.
   */
  siteCoordinator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: employeeRef,
    default: null,
    index: true,
  },
  siteCoordinatorAssignedAt: {
    type: Date,
    default: null,
  },
  /** Photo/file proof that the visitor attended the site visit. */
  siteVisitEvidence: {
    fileName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    dataUrl: { type: String, default: '' },
    uploadedAt: { type: Date, default: null },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: employeeRef,
      default: null,
    },
  },
});
