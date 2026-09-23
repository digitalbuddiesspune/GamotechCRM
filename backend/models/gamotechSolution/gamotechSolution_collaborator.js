import mongoose from 'mongoose';

const collaboratorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  contactNo: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    default: '',
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
  rate: {
    type: Number,
    default: null,
  },
  rateType: {
    type: String,
    enum: ['Per Hour', 'Per Day', 'Per Project', 'Fixed', ''],
    default: '',
  },
  description: {
    type: String,
    default: '',
  },
  socialMediaLink: {
    type: String,
    default: '',
  },
  portfolioLink: {
    type: String,
    default: '',
  },
  individualType: {
    type: String,
    enum: ['Influencer', 'Model', 'Video Editor', 'Cinematographer', 'Content Writer', ''],
    default: '',
  },
}, { timestamps: true });

const Collaborator = mongoose.model('gamotechSolution_Collaborator', collaboratorSchema, 'adsresearchglobal_collaborators');
export default Collaborator;
