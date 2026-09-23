import Notification from '../../models/gamotechSolution/gamotechSolution_notification.js';
import Employee from '../../models/gamotechSolution/gamotechSolution_employee.js';
import { createNotificationHandlers } from '../../utils/createNotificationHandlers.js';
import { createNotificationService } from '../../utils/notificationService.js';

const notificationService = createNotificationService({ Notification });

export const {
  getNotifications,
  getUnreadCount,
  createNotification,
  markNotificationRead,
  markAllRead,
  deleteNotification,
} = createNotificationHandlers({ Notification, Employee, notificationService });
