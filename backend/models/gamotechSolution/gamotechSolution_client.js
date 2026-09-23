import mongoose from 'mongoose';

const clientSchema = new mongoose.Schema({
  clientName: {
    type: String,
    required: true,
  },
  clientNumber: {
    type: String,
    required: true,
  },
  mailId: {
    type: String,
    required: true,
  },
  businessType: {
    type: String,
    required: true,
  },
  services: [{
    type: String,
  }],
  date: {
    type: Date,
    required: true,
  },
  clientType: {
    type: String,
    enum: ['Recurring', 'Non Recurring'],
    required: true,
  },
  clientCategory: {
    type: String,
    enum: ['Marketing', 'Property'],
    default: 'Marketing',
  },
  projectEndDate: {
    type: Date,
    required: function () {
      return this.clientType === 'Non Recurring';
    },
  },
  address: {
    type: String,
  },
  city: {
    type: String,
    default: '',
  },
  state: {
    type: String,
    default: '',
  },
  pincode: {
    type: String,
    default: '',
  },
  gstin: { type: String, default: '' },
  gstCode: { type: String, default: '' },
  onboardBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Employee',
    required: true,
  },
  mouLink: {
    type: String,
  },
  mouSentBy: {
    type: String,
  },
  mouSentTo: {
    type: String,
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
  },
}, { timestamps: true });

const Client = mongoose.model('gamotechSolution_Client', clientSchema, 'adsresearchglobal_clients');
export default Client;
