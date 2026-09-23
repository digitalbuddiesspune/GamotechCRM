import mongoose from 'mongoose';
import PushNotification from '../models/Notification.js';

/**
 * Aggregate push notification analytics for a user.
 * @param {string} userId
 * @param {'daily' | 'weekly' | 'monthly'} period
 */
export async function getNotificationAnalytics(userId, period = 'daily') {
  const receiverId = new mongoose.Types.ObjectId(userId);
  const now = new Date();
  let since = new Date(now);

  if (period === 'weekly') since.setDate(since.getDate() - 7);
  else if (period === 'monthly') since.setMonth(since.getMonth() - 1);
  else since.setDate(since.getDate() - 1);

  const [stats] = await PushNotification.aggregate([
    {
      $match: {
        receiver: receiverId,
        createdAt: { $gte: since },
      },
    },
    {
      $group: {
        _id: null,
        sent: { $sum: { $cond: [{ $in: ['$status', ['sent', 'delivered']] }, 1, 0] } },
        delivered: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        failed: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
        opened: { $sum: { $cond: ['$opened', 1, 0] } },
        read: { $sum: { $cond: ['$read', 1, 0] } },
        total: { $sum: 1 },
      },
    },
  ]);

  return {
    period,
    since,
    sent: stats?.sent || 0,
    delivered: stats?.delivered || 0,
    failed: stats?.failed || 0,
    opened: stats?.opened || 0,
    read: stats?.read || 0,
    total: stats?.total || 0,
  };
}

/**
 * Build MongoDB filter for notification list queries.
 */
export function buildNotificationFilter(userId, query) {
  const filter = { receiver: userId };

  // Hide expired notifications from list and unread counts
  filter.$or = [
    { expiresAt: null },
    { expiresAt: { $exists: false } },
    { expiresAt: { $gt: new Date() } },
  ];

  if (query.type) filter.type = query.type;
  if (query.read === 'true') filter.read = true;
  if (query.read === 'false') filter.read = false;

  if (query.search?.trim()) {
    const term = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    filter.$and = filter.$and || [];
    filter.$and.push({
      $or: [
        { title: { $regex: term, $options: 'i' } },
        { body: { $regex: term, $options: 'i' } },
      ],
    });
  }

  return filter;
}

/** Filter for non-expired unread notifications. */
export function buildUnreadFilter(userId) {
  return {
    receiver: userId,
    read: false,
    $or: [
      { expiresAt: null },
      { expiresAt: { $exists: false } },
      { expiresAt: { $gt: new Date() } },
    ],
  };
}

export function buildNotificationSort(sort) {
  return sort === 'oldest' ? { createdAt: 1 } : { createdAt: -1 };
}
