import mongoose from 'mongoose';

const socialMediaPostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  contentType: {
    type: String,
    enum: ['Reel', 'Feed Post', 'Carousel', 'Story'],
    default: 'Feed Post',
  },
  subject: { type: String, default: '' },
  description: { type: String },
  carouselItems: [{
    subject: { type: String, default: '' },
    description: { type: String, default: '' },
    referenceUpload: {
      fileName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      dataUrl: { type: String, default: '' },
    },
  }],
  platform: {
    type: String,
    enum: ['All', 'Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'YouTube', 'Other'],
    default: 'Instagram',
  },
  scheduledTime: { type: Date },
  status: {
    type: String,
    enum: ['Scheduled', 'Published', 'Draft', 'Cancelled'],
    default: 'Scheduled',
  },
  referenceLink: { type: String },
  referenceUpload: {
    fileName: { type: String, default: '' },
    mimeType: { type: String, default: '' },
    dataUrl: { type: String, default: '' },
  },
  clientReviewStatus: {
    type: String,
    enum: ['Pending', 'Accepted', 'Rejected', 'Need Changes'],
    default: 'Pending',
  },
  clientNote: { type: String, default: '' },
  clientDecisionAt: { type: Date },
  uploadedLinks: [{
    platform: { type: String, default: '' },
    url: { type: String, default: '' },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'gamotechSolution_Employee' },
    addedAt: { type: Date, default: Date.now },
  }],
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'gamotechSolution_Employee' }],
}, { timestamps: true });

const socialMediaCalendarSchema = new mongoose.Schema({
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Client',
    required: true,
  },
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Project',
    default: null,
  },
  shareToken: { type: String, index: true },
  posts: [socialMediaPostSchema],
}, { timestamps: true });

const SocialMediaCalendar = mongoose.model('gamotechSolution_SocialMediaCalendar', socialMediaCalendarSchema, 'adsresearchglobal_socialmediacalendars');
export default SocialMediaCalendar;
