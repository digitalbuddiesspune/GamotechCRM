import mongoose from 'mongoose';

/**
 * Shared quotation schema for all company CRM instances.
 * Adapted from Quotation domain model:
 * - customer → client ({company}_Client)
 * - salesExecutive → preparedBy ({company}_Employee)
 * - items → lineItems
 * - expiryDate → validUntil
 */
export const getQuotationFields = (companyRef) => ({
  quotationNumber: {
    type: String,
    trim: true,
    unique: true,
    sparse: true,
  },
  subject: {
    type: String,
    required: true,
    trim: true,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: `${companyRef}_Client`,
    required: true,
  },
  lead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: `${companyRef}_Lead`,
    default: null,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: `${companyRef}_Project`,
    default: null,
  },
  preparedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: `${companyRef}_Employee`,
    required: true,
  },
  quotationDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  validUntil: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Revised'],
    default: 'Draft',
  },
  currency: {
    type: String,
    default: 'INR',
    trim: true,
  },
  lineItems: {
    type: [{
      name: { type: String, trim: true, default: '' },
      description: { type: String, required: true, trim: true },
      quantity: { type: Number, required: true, min: 1, default: 1 },
      unit: { type: String, default: 'Nos', trim: true },
      unitPrice: { type: Number, required: true, min: 0, default: 0 },
      discount: { type: Number, default: 0, min: 0 },
      taxRate: { type: Number, default: 0, min: 0 },
      amount: { type: Number, default: 0, min: 0 },
    }],
    validate: {
      validator: (val) => Array.isArray(val) && val.length > 0,
      message: 'At least one item is required',
    },
  },
  subtotal: { type: Number, default: 0, min: 0 },
  discountTotal: { type: Number, default: 0, min: 0 },
  taxTotal: { type: Number, default: 0, min: 0 },
  grandTotal: { type: Number, default: 0, min: 0 },
  paymentTerms: { type: String, default: '', trim: true },
  scopeOfWork: { type: String, default: '', trim: true },
  termsAndConditions: { type: String, default: '', trim: true },
  notes: { type: String, default: '', trim: true },
  quotationUrl: { type: String, default: '', trim: true },
  quotationFileName: { type: String, default: '', trim: true },
  clientContact: {
    name: { type: String, default: '', trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
  },
  billingAddress: { type: String, default: '', trim: true },
});
