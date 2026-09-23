import { Router } from 'express';
import {
  getAnnouncements,
  createAnnouncement,
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
} from '../../controllers/gamotechSolution/gamotechSolution_announcementController.js';

const router = Router();

router.get('/announcements', getAnnouncements);
router.post('/announcements', createAnnouncement);
router.get('/announcements/:id', getAnnouncementById);
router.put('/announcements/:id', updateAnnouncement);
router.delete('/announcements/:id', deleteAnnouncement);

export default router;
