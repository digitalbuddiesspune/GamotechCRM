import { Router } from 'express';
import {
  getLeaveCalendar,
  createLeaveCalendar,
  updateLeaveCalendar,
  deleteLeaveCalendar,
} from '../../controllers/gamotechSolution/gamotechSolution_leaveCalendarController.js';

const router = Router();

router.get('/leave-calendar', getLeaveCalendar);
router.post('/leave-calendar', createLeaveCalendar);
router.put('/leave-calendar/:id', updateLeaveCalendar);
router.delete('/leave-calendar/:id', deleteLeaveCalendar);

export default router;
