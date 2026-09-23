import mongoose from 'mongoose';

const billingSchema = new mongoose.Schema({
  billType: {
    type: String,
    enum: ['GST', 'Non-GST'],
    required: true,
  },
  companyLogo: {
    type: String,
    default: '',
  },
  invoiceNumber: { type: String, default: '' },
  company: {
    name: { type: String, default: '' },
    address: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    pan: { type: String, default: '' },
    website: { type: String, default: '' },
  },
  termsAndConditions: { type: String, default: '' },
  authorizedSignature: { type: String, default: '' },
  // GST fields for company (when billType === 'GST')
  companyGst: {
    gstin: { type: String, default: '' },
    state: { type: String, default: '' },
    stateCode: { type: String, default: '' },
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Client',
    required: true,
  },
  // GST fields for client (when billType === 'GST')
  clientGst: {
    gstin: { type: String, default: '' },
    state: { type: String, default: '' },
    billingAddress: { type: String, default: '' },
  },
  projects: [{
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'gamotechSolution_Project' },
    projectCost: { type: Number, default: 0 },
    remainingCost: { type: Number, default: 0 },
  }],
  // Common payment details
  paymentDetails: {
    amount: { type: Number, default: null },
    paymentDate: { type: Date, default: null },
    receiverName: { type: String, default: '' },
    receiverBankAccount: { type: String, default: '' },
    receiverBankName: { type: String, default: '' },
    modeOfTransaction: { type: String, default: '' },
  },
}, { timestamps: true });

const Billing = mongoose.model('gamotechSolution_Billing', billingSchema, 'adsresearchglobal_billings');
export default Billing;
