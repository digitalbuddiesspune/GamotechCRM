import mongoose from 'mongoose';
import { adsLeadSchemaFields } from '../../utils/adsLeadFields.js';

const followUpSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  comments: { type: String, default: '' },
  /** @deprecated prefer comments — kept for older records */
  text: { type: String },
});

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  businessName: { type: String, required: true },
  contactNumber: { type: String, required: true },
  address: { type: String },
  city: { type: String },
  state: { type: String },
  businessType: { type: String },
  leadSource: { type: String },
  description: { type: String },
  status: {
    type: String,
    enum: [
      'Call not Received',
      'Call You After Sometime',
      'Interested',
      'Not Interested',
      'Meeting Schedule',
    ],
    default: 'Call not Received',
  },
  meetingType: {
    type: String,
    enum: ['Online', 'Offline'],
  },
  meetingPersonName: { type: String },
  meetingTime: { type: Date },
  meetingInfoSent: { type: Boolean, default: false },
  followUps: [followUpSchema],
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Employee',
    required: true,
  },
  ...adsLeadSchemaFields,
}, { timestamps: true });

leadSchema.index(
  { adPlatform: 1, externalLeadId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      externalLeadId: { $type: 'string', $gt: '' },
      adPlatform: { $type: 'string', $gt: '' },
    },
  }
);

const Lead = mongoose.model('gamotechSolution_Lead', leadSchema, 'adsresearchglobal_leads');
export default Lead;
