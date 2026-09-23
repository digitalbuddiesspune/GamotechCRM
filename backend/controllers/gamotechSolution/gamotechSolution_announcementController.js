import Announcement from '../../models/gamotechSolution/gamotechSolution_announcement.js';
import Employee from '../../models/gamotechSolution/gamotechSolution_employee.js';
import Notification from '../../models/gamotechSolution/gamotechSolution_notification.js';
import { createNotificationService } from '../../utils/notificationService.js';
import { createAnnouncementHandlers } from '../../utils/createAnnouncementHandlers.js';

const notificationService = createNotificationService({ Notification });

export const {
  getAnnouncements,
  createAnnouncement,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
} = createAnnouncementHandlers({ Announcement, Employee, notificationService, tenantId: 'gamotechSolution' });
