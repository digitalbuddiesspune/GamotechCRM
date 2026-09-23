import { Router } from 'express';
import {
  registerDevice,
  getNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllRead,
  deleteNotification,
  getAnalytics,
  broadcastNotification,
  sendTopicNotification,
  sendUserNotification,
  scheduleNotification,
} from '../controllers/notification.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
import { requireAdmin } from '../middlewares/admin.middleware.js';
import {
  validate,
  registerDeviceValidation,
  listNotificationsValidation,
  notificationIdValidation,
  broadcastValidation,
  topicValidation,
  userNotificationValidation,
  scheduleValidation,
} from '../middlewares/notification.validation.js';
import { createRateLimitMiddleware } from '../utils/notificationRateLimit.js';
import { RATE_LIMITS } from '../utils/notificationConstants.js';

const apiRateLimit = createRateLimitMiddleware(
  (req) => `api:${req.auth?.sub || req.ip}`,
  RATE_LIMITS.api,
);

const router = Router();

router.use(apiRateLimit);

// Device registration (existing API — unchanged path & response)
router.post('/device/register', requireAuth, registerDeviceValidation, validate, registerDevice);

// Authenticated notification history
router.get(
  '/notifications',
  requireAuth,
  listNotificationsValidation,
  validate,
  getNotifications,
);
router.get('/notifications/unread-count', requireAuth, getUnreadCount);
router.get('/notifications/analytics', requireAuth, getAnalytics);
router.patch(
  '/notifications/read-all',
  requireAuth,
  markAllRead,
);
router.patch(
  '/notifications/:id/read',
  requireAuth,
  notificationIdValidation,
  validate,
  markNotificationRead,
);
router.delete(
  '/notifications/:id',
  requireAuth,
  notificationIdValidation,
  validate,
  deleteNotification,
);

// Admin broadcast APIs
router.post(
  '/notifications/broadcast',
  requireAuth,
  requireAdmin,
  broadcastValidation,
  validate,
  broadcastNotification,
);
router.post(
  '/notifications/topic',
  requireAuth,
  requireAdmin,
  topicValidation,
  validate,
  sendTopicNotification,
);
router.post(
  '/notifications/user',
  requireAuth,
  requireAdmin,
  userNotificationValidation,
  validate,
  sendUserNotification,
);
router.post(
  '/notifications/schedule',
  requireAuth,
  requireAdmin,
  scheduleValidation,
  validate,
  scheduleNotification,
);

export default router;
