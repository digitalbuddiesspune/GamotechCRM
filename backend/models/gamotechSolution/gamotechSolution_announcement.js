import mongoose from 'mongoose';
import { getAnnouncementFields } from '../../utils/announcementFields.js';

const announcementSchema = new mongoose.Schema(
  getAnnouncementFields('gamotechSolution'),
  { timestamps: true }
);

const Announcement = mongoose.model('gamotechSolution_Announcement', announcementSchema, 'adsresearchglobal_announcements');
export default Announcement;
