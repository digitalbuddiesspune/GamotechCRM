import { Router } from 'express';
import {
  getCalendars,
  getCalendarByClient,
  createCalendar,
  addPost,
  updatePost,
  deletePost,
  getCalendarByShareToken,
  updatePostReviewByShareToken,
  addUploadedLinkToPost,
} from '../../controllers/gamotechSolution/gamotechSolution_socialMediaCalendarController.js';

const router = Router();

router.get('/social-calendars', getCalendars);
router.get('/social-calendars/client/:clientId', getCalendarByClient);
router.post('/social-calendars', createCalendar);
router.post('/social-calendars/client/:clientId/posts', addPost);
router.put('/social-calendars/client/:clientId/posts/:postId', updatePost);
router.post('/social-calendars/client/:clientId/posts/:postId/upload-links', addUploadedLinkToPost);
router.delete('/social-calendars/client/:clientId/posts/:postId', deletePost);
router.get('/social-calendars/shared/:token', getCalendarByShareToken);
router.put('/social-calendars/shared/:token/posts/:postId/review', updatePostReviewByShareToken);

export default router;
