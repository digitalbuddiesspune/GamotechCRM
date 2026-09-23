import { Router } from 'express';
import {
  checkIn,
  checkOut,
  undoCheckOut,
  getTodayAttendance,
  getAttendanceByMonth,
  getAttendanceByEmployee,
  startBreak,
  endBreak,
  startMeeting,
  endMeeting,
  updateLocationTimeline,
  updateCheckInAddress,
  updateCheckOutAddress,
} from '../../controllers/gamotechSolution/gamotechSolution_attendanceController.js';

const router = Router();

router.post('/attendance/check-in', checkIn);
router.post('/attendance/check-out', checkOut);
router.post('/attendance/undo-check-out', undoCheckOut);
router.post('/attendance/break/start', startBreak);
router.post('/attendance/break/end', endBreak);
router.post('/attendance/meeting/start', startMeeting);
router.post('/attendance/meeting/end', endMeeting);
router.post('/attendance/location-update', updateLocationTimeline);
router.post('/attendance/check-in-address', updateCheckInAddress);
router.post('/attendance/check-out-address', updateCheckOutAddress);
router.get('/attendance/today', getTodayAttendance);
router.get('/attendance/by-month', getAttendanceByMonth);
router.get('/attendance/employee/:employeeId', getAttendanceByEmployee);

export default router;
