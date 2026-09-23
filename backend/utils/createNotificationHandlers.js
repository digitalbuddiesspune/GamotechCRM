import { NOTIFICATION_TYPES } from './notificationFields.js';

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const createNotificationHandlers = ({ Notification, Employee, notificationService }) => {
  const populateNotification = (query) =>
    query
      .populate('recipient', 'name email employeeCode profilePhoto')
      .populate('metadata.actor', 'name email profilePhoto')
      .sort({ createdAt: -1 });

  const getNotifications = async (req, res) => {
    try {
      const { recipientId, read, type, limit = '50' } = req.query;
      if (!recipientId?.trim()) {
        return res.status(400).json({ message: 'recipientId is required' });
      }

      const filter = { recipient: recipientId.trim() };
      if (read === 'true') filter.read = true;
      if (read === 'false') filter.read = false;
      if (type && NOTIFICATION_TYPES.includes(type)) filter.type = type;

      const now = new Date();
      filter.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];

      const take = Math.min(100, Math.max(1, Number(limit) || 50));
      const notifications = await populateNotification(Notification.find(filter).limit(take));
      res.status(200).json(notifications);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching notifications', error: error?.message });
    }
  };

  const getUnreadCount = async (req, res) => {
    try {
      const { recipientId } = req.query;
      if (!recipientId?.trim()) {
        return res.status(400).json({ message: 'recipientId is required' });
      }

      const now = new Date();
      const count = await Notification.countDocuments({
        recipient: recipientId.trim(),
        read: false,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      });

      res.status(200).json({ count });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching unread count', error: error?.message });
    }
  };

  const createNotification = async (req, res) => {
    try {
      const {
        recipientId,
        recipientIds,
        type = 'general',
        title,
        message,
        link = '',
        priority = 'normal',
        metadata = {},
        expiresAt,
        createdBy,
      } = req.body;

      if (!title?.trim() || !message?.trim()) {
        return res.status(400).json({ message: 'title and message are required' });
      }

      const ids = Array.isArray(recipientIds)
        ? recipientIds.filter(Boolean)
        : recipientId
          ? [recipientId]
          : [];

      if (!ids.length) {
        return res.status(400).json({ message: 'recipientId or recipientIds is required' });
      }

      const employees = await Employee.find({ _id: { $in: ids } }).select('_id');
      if (!employees.length) {
        return res.status(400).json({ message: 'No valid recipients found' });
      }

      const validType = NOTIFICATION_TYPES.includes(type) ? type : 'general';
      const actorId = metadata?.actor || createdBy || null;

      if (validType === 'announcement' && ids.length > 1) {
        const created = await notificationService.notifyAnnouncement({
          recipientIds: employees.map((e) => e._id),
          title,
          message,
          actorId,
          link,
        });
        return res.status(201).json({ message: 'Announcements sent', notifications: created });
      }

      const items = employees.map((employee) => ({
        recipientId: employee._id,
        type: validType,
        title,
        message,
        link,
        priority,
        expiresAt: toDate(expiresAt),
        metadata: { ...metadata, actor: actorId },
      }));

      const created = await notificationService.createMany(items);
      res.status(201).json({ message: 'Notification(s) created', notifications: created });
    } catch (error) {
      res.status(500).json({ message: 'Error creating notification', error: error?.message });
    }
  };

  const markNotificationRead = async (req, res) => {
    try {
      const updated = await Notification.findByIdAndUpdate(
        req.params.id,
        { read: true, readAt: new Date() },
        { new: true }
      );
      if (!updated) return res.status(404).json({ message: 'Notification not found' });
      res.status(200).json({ message: 'Notification marked as read', notification: updated });
    } catch (error) {
      res.status(500).json({ message: 'Error updating notification', error: error?.message });
    }
  };

  const markAllRead = async (req, res) => {
    try {
      const { recipientId } = req.body;
      if (!recipientId?.trim()) {
        return res.status(400).json({ message: 'recipientId is required' });
      }

      const result = await Notification.updateMany(
        { recipient: recipientId.trim(), read: false },
        { read: true, readAt: new Date() }
      );

      res.status(200).json({
        message: 'All notifications marked as read',
        modifiedCount: result.modifiedCount,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error marking notifications as read', error: error?.message });
    }
  };

  const deleteNotification = async (req, res) => {
    try {
      const deleted = await Notification.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Notification not found' });
      res.status(200).json({ message: 'Notification deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting notification', error: error?.message });
    }
  };

  return {
    getNotifications,
    getUnreadCount,
    createNotification,
    markNotificationRead,
    markAllRead,
    deleteNotification,
  };
};
