import mongoose from 'mongoose';

/** Schema fields matching Meta/Google Sheet lead export (Rohan Nitara style). */
export const getSheetLeadSchemaFields = (employeeRef, crmLeadRef) => ({
  metaLeadId: { type: String, default: '', index: true },
  createdTime: { type: Date, default: null },
  adId: { type: String, default: '' },
  adName: { type: String, default: '' },
  adsetId: { type: String, default: '' },
  adsetName: { type: String, default: '' },
  campaignId: { type: String, default: '' },
  campaignName: { type: String, default: '' },
  formId: { type: String, default: '' },
  formName: { type: String, default: '' },
  isOrganic: { type: Boolean, default: false },
  platform: { type: String, default: '' },
  configurationInterest: { type: String, default: '' },
  propertyUsedFor: { type: String, default: '' },
  visitPreference: { type: String, default: '' },
  pickupRequested: { type: String, default: '' },
  fullName: { type: String, required: true },
  phone: { type: String, required: true, index: true },
  sheetLeadStatus: { type: String, default: '' },
  executiveName: { type: String, default: '' },
  remark: { type: String, default: '' },
  sourceFileName: { type: String, default: '' },
  importedAt: { type: Date, default: Date.now },
  importedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: employeeRef,
    default: null,
  },
  crmLead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: crmLeadRef,
    default: null,
  },
  rawRow: { type: Object, default: undefined },
});
