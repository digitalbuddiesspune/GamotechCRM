import mongoose from 'mongoose';

const companySchema = new mongoose.Schema({
  companyLogo: { type: String, default: '' },
  companyStamp: { type: String, default: '' },
  authorizedSignature: { type: String, default: '' },
  companyName: { type: String, default: '' },
  workingHours: { type: String, default: '9 AM - 6 PM' },
  breakTimeMinutes: { type: Number, default: 45, min: 0 },
  address: { type: String, default: '' },
  website: { type: String, default: '' },
  pan: { type: String, default: '' },
  phone: { type: String, default: '' },
  gstin: { type: String, default: '' },
  gstCode: { type: String, default: '' },
  state: { type: String, default: '' },
  email: { type: String, default: '' },
  bankName: { type: String, default: '' },
  bankAccountNumber: { type: String, default: '' },
  // Personal accounts (for Non-GST bills) - multiple allowed
  personalAccounts: [{
    receiverName: { type: String, default: '' },
    bankName: { type: String, default: '' },
    bankAccountNumber: { type: String, default: '' },
  }],
}, { timestamps: true });

const Company = mongoose.model('gamotechSolution_Company', companySchema, 'adsresearchglobal_companies');
export default Company;
