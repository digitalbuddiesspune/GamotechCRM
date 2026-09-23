import { body, param, query } from 'express-validator';
import { validationResult } from 'express-validator';

/** Express-validator middleware — returns 400 on failure. */
export const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array(),
    });
  }
  return next();
};

export const registerDeviceValidation = [
  body('deviceToken').trim().notEmpty().withMessage('deviceToken is required'),
  body('platform')
    .optional()
    .trim()
    .isIn(['android', 'ios', 'web', 'unknown'])
    .withMessage('Invalid platform'),
];

export const broadcastValidation = [
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('body').trim().notEmpty().isLength({ max: 1000 }),
  body('userIds').optional().isArray(),
  body('topic').optional().trim().isLength({ max: 200 }),
  body('data').optional().isObject(),
];

export const topicValidation = [
  body('topic').trim().notEmpty(),
  body('title').trim().notEmpty(),
  body('body').trim().notEmpty(),
];

export const userNotificationValidation = [
  body('userId').trim().notEmpty(),
  body('title').trim().notEmpty(),
  body('body').trim().notEmpty(),
];

export const scheduleValidation = [
  body('title').trim().notEmpty().isLength({ max: 200 }),
  body('body').trim().notEmpty().isLength({ max: 1000 }),
  body('userIds').isArray({ min: 1 }),
  body('sendAt').trim().notEmpty().isISO8601(),
  body('priority').optional().isIn(['low', 'normal', 'high', 'critical']),
  body('data').optional().isObject(),
];

export const listNotificationsValidation = [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('type').optional().trim(),
  query('read').optional().isIn(['true', 'false']),
  query('search').optional().trim().isLength({ max: 200 }),
  query('sort').optional().isIn(['newest', 'oldest']),
];

export const notificationIdValidation = [
  param('id').trim().notEmpty().isMongoId(),
];
