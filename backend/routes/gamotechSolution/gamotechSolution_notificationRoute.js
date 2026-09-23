import { Router } from 'express';
import {
  getNotifications,
  getUnreadCount,
  createNotification,
  markNotificationRead,
  markAllRead,
  deleteNotification,
} from '../../controllers/gamotechSolution/gamotechSolution_notificationController.js';

const router = Router();

router.get('/notifications', getNotifications);
router.get('/notifications/unread-count', getUnreadCount);
router.post('/notifications', createNotification);
router.patch('/notifications/read-all', markAllRead);
router.patch('/notifications/:id/read', markNotificationRead);
router.delete('/notifications/:id', deleteNotification);

export default router;
