import {
  ANNOUNCEMENT_PRIORITIES,
  ANNOUNCEMENT_STATUSES,
} from './announcementFields.js';
import { cacheKey, withCache, invalidateTenantCache, CACHE_TTL } from './cache.js';

const toDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

const normalizePayload = (body = {}) => {
  const priority = ANNOUNCEMENT_PRIORITIES.includes(body.priority) ? body.priority : 'high';
  const status = ANNOUNCEMENT_STATUSES.includes(body.status) ? body.status : 'Published';

  return {
    title: String(body.title || '').trim(),
    message: String(body.message || '').trim(),
    priority,
    status,
    pinned: Boolean(body.pinned),
    notifyEmployees: body.notifyEmployees !== false && body.notifyEmployees !== 'false',
    expiresAt: toDate(body.expiresAt),
    createdBy: body.createdBy || null,
  };
};

export const createAnnouncementHandlers = ({ Announcement, Employee, notificationService, tenantId = 'shared' }) => {
  const populateAnnouncement = (query) =>
    query
      .populate('createdBy', 'name email employeeCode profilePhoto')
      .sort({ pinned: -1, publishedAt: -1, createdAt: -1 });

  const bust = () => invalidateTenantCache(tenantId, 'announcements');

  const sendNotifications = async (announcement, actorId) => {
    if (!notificationService?.notifyAnnouncement) return null;
    const employees = await Employee.find({}).select('_id');
    if (!employees.length) return null;

    return notificationService.notifyAnnouncement({
      recipientIds: employees.map((e) => e._id),
      title: announcement.title,
      message: announcement.message,
      actorId: actorId || announcement.createdBy || null,
      link: '/module/announcements',
    });
  };

  const getAnnouncements = async (req, res) => {
    try {
      const { status, priority, pinned, active } = req.query;
      const key = cacheKey(tenantId, 'announcements', {
        status: status || '',
        priority: priority || '',
        pinned: pinned || '',
        active: active || '',
      });

      const { data } = await withCache(key, CACHE_TTL.announcements, async () => {
        const filter = {};
        if (status && ANNOUNCEMENT_STATUSES.includes(status)) filter.status = status;
        if (priority && ANNOUNCEMENT_PRIORITIES.includes(priority)) filter.priority = priority;
        if (pinned === 'true') filter.pinned = true;
        if (pinned === 'false') filter.pinned = false;
        if (active === 'true') {
          filter.status = 'Published';
          const now = new Date();
          filter.$or = [{ expiresAt: null }, { expiresAt: { $gt: now } }];
        }
        return populateAnnouncement(Announcement.find(filter)).lean();
      });

      res.status(200).json(data);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching announcements', error: error?.message });
    }
  };

  const createAnnouncement = async (req, res) => {
    try {
      const payload = normalizePayload(req.body);
      if (!payload.title) {
        return res.status(400).json({ message: 'Title is required' });
      }
      if (!payload.message) {
        return res.status(400).json({ message: 'Message is required' });
      }

      if (payload.createdBy) {
        const author = await Employee.findById(payload.createdBy).select('_id');
        if (!author) return res.status(400).json({ message: 'Author not found' });
      }

      if (payload.status === 'Published') {
        payload.publishedAt = new Date();
      }

      const announcement = await Announcement.create(payload);
      await bust();
      let notified = 0;

      if (announcement.status === 'Published' && announcement.notifyEmployees) {
        const created = await sendNotifications(announcement, payload.createdBy);
        notified = Array.isArray(created) ? created.length : 0;
      }

      const populated = await populateAnnouncement(Announcement.findById(announcement._id));
      res.status(201).json({
        message: 'Announcement created',
        announcement: populated,
        notified,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error creating announcement', error: error?.message });
    }
  };

  const getAnnouncementById = async (req, res) => {
    try {
      const announcement = await populateAnnouncement(Announcement.findById(req.params.id));
      if (!announcement) return res.status(404).json({ message: 'Announcement not found' });
      res.status(200).json(announcement);
    } catch (error) {
      res.status(500).json({ message: 'Error fetching announcement', error: error?.message });
    }
  };

  const updateAnnouncement = async (req, res) => {
    try {
      const existing = await Announcement.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Announcement not found' });

      const payload = normalizePayload({ ...existing.toObject(), ...req.body });
      if (!payload.title) return res.status(400).json({ message: 'Title is required' });
      if (!payload.message) return res.status(400).json({ message: 'Message is required' });

      const wasPublished = existing.status === 'Published';
      const becomingPublished = payload.status === 'Published' && !wasPublished;

      if (becomingPublished && !existing.publishedAt) {
        payload.publishedAt = new Date();
      }
      if (payload.status !== 'Published') {
        // keep publishedAt history if it was published before
      } else if (!existing.publishedAt) {
        payload.publishedAt = new Date();
      }

      // Don't overwrite createdBy on update unless explicitly sent
      if (!req.body.createdBy) delete payload.createdBy;

      const updated = await Announcement.findByIdAndUpdate(req.params.id, payload, {
        new: true,
        runValidators: true,
      });
      await bust();

      let notified = 0;
      const shouldNotify =
        (becomingPublished || (req.body.resendNotify === true || req.body.resendNotify === 'true')) &&
        updated.notifyEmployees;

      if (shouldNotify) {
        const created = await sendNotifications(updated, updated.createdBy);
        notified = Array.isArray(created) ? created.length : 0;
      }

      const populated = await populateAnnouncement(Announcement.findById(updated._id));
      res.status(200).json({
        message: 'Announcement updated',
        announcement: populated,
        notified,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error updating announcement', error: error?.message });
    }
  };

  const deleteAnnouncement = async (req, res) => {
    try {
      const deleted = await Announcement.findByIdAndDelete(req.params.id);
      if (!deleted) return res.status(404).json({ message: 'Announcement not found' });
      await bust();
      res.status(200).json({ message: 'Announcement deleted' });
    } catch (error) {
      res.status(500).json({ message: 'Error deleting announcement', error: error?.message });
    }
  };

  return {
    getAnnouncements,
    createAnnouncement,
    getAnnouncementById,
    updateAnnouncement,
    deleteAnnouncement,
  };
};
