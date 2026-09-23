import mongoose from 'mongoose';

export const DOCUMENT_TYPES = ['File', 'Contract', 'Policy'];

/** Shared document schema — one model; type set by Files / Contracts / Policies pages. */
export const getDocumentFields = (companyRef) => ({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: DOCUMENT_TYPES,
    required: true,
    index: true,
  },
  description: {
    type: String,
    default: '',
    trim: true,
  },
  documentUrl: {
    type: String,
    default: '',
    trim: true,
  },
  fileName: {
    type: String,
    default: '',
    trim: true,
  },
  status: {
    type: String,
    enum: ['Draft', 'Active', 'Expired', 'Archived'],
    default: 'Active',
  },
  effectiveDate: {
    type: Date,
    default: Date.now,
  },
  expiryDate: {
    type: Date,
    default: null,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: `${companyRef}_Employee`,
    default: null,
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: `${companyRef}_Client`,
    default: null,
  },
  notes: {
    type: String,
    default: '',
    trim: true,
  },
});
