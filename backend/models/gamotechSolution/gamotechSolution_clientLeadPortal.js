import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    campaignId: { type: String, default: '', trim: true },
    campaignName: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const clientLeadPortalSchema = new mongoose.Schema(
  {
    clientName: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    campaigns: { type: [campaignSchema], default: [] },
    logoUrl: { type: String, default: '', trim: true },
    status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  },
  { timestamps: true }
);

const ClientLeadPortal = mongoose.model(
  'gamotechSolution_ClientLeadPortal',
  clientLeadPortalSchema,
  'adsresearchglobal_clientleadportals'
);

export default ClientLeadPortal;
