import mongoose from 'mongoose';

const attendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'gamotechSolution_Employee',
    required: true,
  },
  date: {
    type: Date,
    required: true,
  },
  checkIn: {
    type: Date,
  },
  checkInLatitude: { type: Number },
  checkInLongitude: { type: Number },
  checkInAddress: { type: String },
  checkInDeviceType: {
    type: String,
    enum: ['mobile', 'tablet', 'desktop'],
  },
  checkInDevicePlatform: { type: String, default: '' },
  checkInDeviceBrowser: { type: String, default: '' },
  locationTimeline: [{
    at: { type: Date, default: Date.now },
    latitude: { type: Number },
    longitude: { type: Number },
    address: { type: String, default: '' },
  }],
  checkOut: {
    type: Date,
  },
  checkOutLatitude: { type: Number },
  checkOutLongitude: { type: Number },
  checkOutAddress: { type: String },
  breakStartedAt: { type: Date, default: null },
  breakDurationMinutes: { type: Number, default: 0 },
  meetingStartedAt: { type: Date, default: null },
  meetingDurationMinutes: { type: Number, default: 0 },
  durationHours: {
    type: Number,
  },
  status: {
    type: String,
    enum: ['Absent', 'Half Day', 'Full Day', 'In Progress'],
    default: 'Absent',
  },
}, { timestamps: true });

/** Legacy rows may have checkInDeviceType: null; enum rejects null on save (e.g. checkout). */
attendanceSchema.pre('validate', function normalizeOptionalDeviceFields(next) {
  if (this.checkInDeviceType == null || this.checkInDeviceType === '') {
    this.checkInDeviceType = undefined;
  }
  next();
});

const Attendance = mongoose.model('gamotechSolution_Attendance', attendanceSchema, 'adsresearchglobal_attendances');
export default Attendance;
