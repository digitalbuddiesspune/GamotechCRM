import Attendance from '../../models/gamotechSolution/gamotechSolution_attendance.js';
import {
  createUpdateCheckInAddress,
  createUpdateCheckOutAddress,
} from '../../utils/attendanceLocationHandlers.js';

const getStatus = (durationHours) => {
  if (durationHours >= 8) return 'Full Day';
  if (durationHours >= 4) return 'Half Day';
  return 'Half Day';
};

const getTodayRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return { today, tomorrow };
};

const appendLocationPoint = (attendance, { latitude, longitude, address, at = new Date(), minMove = 0.00025 }) => {
  if (!attendance) return;
  if (Number.isNaN(latitude) || Number.isNaN(longitude)) return;
  const timeline = Array.isArray(attendance.locationTimeline) ? attendance.locationTimeline : [];
  const last = timeline[timeline.length - 1];
  const moved =
    !last ||
    Math.abs(Number(last.latitude) - latitude) > minMove ||
    Math.abs(Number(last.longitude) - longitude) > minMove ||
    ((address || '').trim() && (last.address || '').trim() !== (address || '').trim());
  if (!moved) return;
  timeline.push({
    at,
    latitude,
    longitude,
    address: typeof address === 'string' ? address.trim() : '',
  });
  attendance.locationTimeline = timeline.slice(-200);
};

export const checkIn = async (req, res) => {
  try {
    const { employee, latitude, longitude, address } = req.body;
    const lat = typeof latitude === 'number' ? latitude : Number(latitude);
    const lon = typeof longitude === 'number' ? longitude : Number(longitude);
    if (employee == null) {
      return res.status(400).json({ message: 'Employee is required' });
    }
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ message: 'Check-in location is required. Enable device location and allow this site to use it.' });
    }

    const { today, tomorrow } = getTodayRange();

    let attendance = await Attendance.findOne({
      employee,
      date: { $gte: today, $lt: tomorrow },
    });

    if (attendance?.checkIn) {
      return res.status(400).json({ message: 'Already checked in today' });
    }

    const checkInPayload = {
      checkIn: new Date(),
      status: 'In Progress',
      checkInLatitude: lat,
      checkInLongitude: lon,
    };
    if (typeof address === 'string' && address.trim()) {
      checkInPayload.checkInAddress = address.trim();
    }

    if (!attendance) {
      attendance = new Attendance({
        employee,
        date: today,
        ...checkInPayload,
      });
    } else {
      Object.assign(attendance, checkInPayload);
    }
    appendLocationPoint(attendance, { latitude: lat, longitude: lon, address, at: checkInPayload.checkIn, minMove: 0 });

    await attendance.save();
    const populated = await Attendance.findById(attendance._id).populate('employee');
    res.status(201).json({ message: 'Checked in successfully', attendance: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error checking in', error });
  }
};

export const checkOut = async (req, res) => {
  try {
    const { employee, latitude, longitude, address } = req.body;
    const lat = latitude == null ? null : (typeof latitude === 'number' ? latitude : Number(latitude));
    const lon = longitude == null ? null : (typeof longitude === 'number' ? longitude : Number(longitude));
    const { today, tomorrow } = getTodayRange();

    let attendance = await Attendance.findOne({
      employee,
      date: { $gte: today, $lt: tomorrow },
    });

    // If no check-in today, apply auto checkout for previous day's open session (day ended)
    if (!attendance || !attendance.checkIn) {
      attendance = await Attendance.findOne({
        employee,
        checkIn: { $exists: true, $ne: null },
        checkOut: { $in: [null, undefined] },
      })
        .sort({ date: -1 })
        .limit(1)
        .exec();
      if (attendance) {
        // Set checkout to end of that day (day ended)
        const recordDate = new Date(attendance.date);
        recordDate.setHours(23, 59, 59, 999);
        attendance.checkOut = recordDate;
      }
    } else {
      const now = new Date();
      attendance.checkOut = now;
      if (attendance.breakStartedAt) {
        const breakMins = Math.max(0, Math.floor((now - attendance.breakStartedAt) / (1000 * 60)));
        attendance.breakDurationMinutes = (attendance.breakDurationMinutes || 0) + breakMins;
        attendance.breakStartedAt = null;
      }
      if (attendance.meetingStartedAt) {
        const meetingMins = Math.max(0, Math.floor((now - attendance.meetingStartedAt) / (1000 * 60)));
        attendance.meetingDurationMinutes = (attendance.meetingDurationMinutes || 0) + meetingMins;
        attendance.meetingStartedAt = null;
      }
      // Only capture location for a real (today) checkout initiated by user
      if (!Number.isNaN(lat) && !Number.isNaN(lon) && lat != null && lon != null) {
        attendance.checkOutLatitude = lat;
        attendance.checkOutLongitude = lon;
        if (typeof address === 'string' && address.trim()) {
          attendance.checkOutAddress = address.trim();
        }
        appendLocationPoint(attendance, { latitude: lat, longitude: lon, address, at: now });
      }
    }

    if (!attendance || !attendance.checkIn) {
      return res.status(400).json({ message: 'No check-in found for today' });
    }

    const durationMs = attendance.checkOut - attendance.checkIn;
    const breakMs = (attendance.breakDurationMinutes || 0) * 60 * 1000;
    attendance.durationHours = Math.max(0, durationMs - breakMs) / (1000 * 60 * 60);
    attendance.status = getStatus(attendance.durationHours);

    await attendance.save();
    const populated = await Attendance.findById(attendance._id).populate('employee');
    res.status(200).json({ message: 'Checked out successfully', attendance: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error checking out', error });
  }
};

const UNDO_CHECKOUT_MS = 2 * 60 * 1000;

export const undoCheckOut = async (req, res) => {
  try {
    const { employee } = req.body;
    if (!employee) {
      return res.status(400).json({ message: 'Employee is required' });
    }

    const { today, tomorrow } = getTodayRange();
    const attendance = await Attendance.findOne({
      employee,
      date: { $gte: today, $lt: tomorrow },
      checkIn: { $exists: true, $ne: null },
      checkOut: { $ne: null },
    });

    if (!attendance) {
      return res.status(400).json({ message: 'No check-out found for today to undo' });
    }

    const checkedOutAt = new Date(attendance.checkOut).getTime();
    if (Number.isNaN(checkedOutAt)) {
      return res.status(400).json({ message: 'Invalid check-out time' });
    }

    const remainingMs = UNDO_CHECKOUT_MS - (Date.now() - checkedOutAt);
    if (remainingMs <= 0) {
      return res.status(400).json({
        message: 'Undo window expired. Check-out can only be undone within 2 minutes.',
      });
    }

    // Drop the last timeline point if it matches this checkout (coords / timestamp)
    const timeline = Array.isArray(attendance.locationTimeline) ? [...attendance.locationTimeline] : [];
    if (timeline.length) {
      const last = timeline[timeline.length - 1];
      const lastAt = last?.at ? new Date(last.at).getTime() : NaN;
      const sameTime = !Number.isNaN(lastAt) && Math.abs(lastAt - checkedOutAt) < 5000;
      const sameCoords =
        attendance.checkOutLatitude != null &&
        attendance.checkOutLongitude != null &&
        last?.latitude != null &&
        last?.longitude != null &&
        Math.abs(Number(last.latitude) - Number(attendance.checkOutLatitude)) < 0.0001 &&
        Math.abs(Number(last.longitude) - Number(attendance.checkOutLongitude)) < 0.0001;
      if (sameTime || sameCoords) {
        timeline.pop();
        attendance.locationTimeline = timeline;
      }
    }

    attendance.checkOut = null;
    attendance.checkOutLatitude = null;
    attendance.checkOutLongitude = null;
    attendance.checkOutAddress = null;
    attendance.durationHours = null;
    attendance.status = 'In Progress';

    await attendance.save();
    const populated = await Attendance.findById(attendance._id).populate('employee');
    res.status(200).json({
      message: 'Check-out undone successfully',
      attendance: populated,
      undoRemainingMs: remainingMs,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error undoing check-out', error });
  }
};

export const getTodayAttendance = async (req, res) => {
  try {
    const { employeeId, date } = req.query;
    let dayStart, dayEnd;
    if (date) {
      const parts = date.split('-').map(Number);
      if (parts.length !== 3 || parts.some(isNaN)) {
        return res.status(400).json({ message: 'Invalid date format. Use YYYY-MM-DD' });
      }
      dayStart = new Date(parts[0], parts[1] - 1, parts[2]);
      if (isNaN(dayStart.getTime())) {
        return res.status(400).json({ message: 'Invalid date' });
      }
      dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    } else {
      dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    }

    const filter = { date: { $gte: dayStart, $lt: dayEnd } };
    if (employeeId) {
      filter.employee = employeeId;
    }

    const attendances = await Attendance.find(filter).populate('employee');

    res.status(200).json(attendances);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching attendance', error });
  }
};

export const getAttendanceByMonth = async (req, res) => {
  try {
    const { employeeId, month } = req.query;
    if (!month) {
      return res.status(400).json({ message: 'Month is required (YYYY-MM)' });
    }
    const parts = month.split('-').map(Number);
    if (parts.length !== 2 || parts.some(isNaN)) {
      return res.status(400).json({ message: 'Invalid month format. Use YYYY-MM' });
    }
    const monthStart = new Date(parts[0], parts[1] - 1, 1);
    const monthEnd = new Date(parts[0], parts[1], 1);

    const filter = { date: { $gte: monthStart, $lt: monthEnd } };
    if (employeeId) {
      filter.employee = employeeId;
    }

    const attendances = await Attendance.find(filter)
      .populate('employee')
      .sort({ date: 1 });

    res.status(200).json(attendances);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching attendance', error });
  }
};

export const getAttendanceByEmployee = async (req, res) => {
  try {
    const { employeeId } = req.params;
    const attendances = await Attendance.find({ employee: employeeId })
      .populate('employee')
      .sort({ date: -1 });
    res.status(200).json(attendances);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching attendance', error });
  }
};

export const startBreak = async (req, res) => {
  try {
    const { employee } = req.body;
    if (!employee) return res.status(400).json({ message: 'Employee is required' });
    const { today, tomorrow } = getTodayRange();
    const attendance = await Attendance.findOne({
      employee,
      date: { $gte: today, $lt: tomorrow },
    });
    if (!attendance?.checkIn) return res.status(400).json({ message: 'Check in first to start break' });
    if (attendance.checkOut) return res.status(400).json({ message: 'Cannot start break after check out' });
    if (attendance.breakStartedAt) return res.status(400).json({ message: 'Break already started' });
    attendance.breakStartedAt = new Date();
    await attendance.save();
    const populated = await Attendance.findById(attendance._id).populate('employee');
    res.status(200).json({ message: 'Break started', attendance: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error starting break', error });
  }
};

export const endBreak = async (req, res) => {
  try {
    const { employee } = req.body;
    if (!employee) return res.status(400).json({ message: 'Employee is required' });
    const { today, tomorrow } = getTodayRange();
    const attendance = await Attendance.findOne({
      employee,
      date: { $gte: today, $lt: tomorrow },
    });
    if (!attendance?.breakStartedAt) return res.status(400).json({ message: 'No active break found' });
    const now = new Date();
    const mins = Math.max(0, Math.floor((now - attendance.breakStartedAt) / (1000 * 60)));
    attendance.breakDurationMinutes = (attendance.breakDurationMinutes || 0) + mins;
    attendance.breakStartedAt = null;
    await attendance.save();
    const populated = await Attendance.findById(attendance._id).populate('employee');
    res.status(200).json({ message: 'Break ended', attendance: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error ending break', error });
  }
};

export const startMeeting = async (req, res) => {
  try {
    const { employee } = req.body;
    if (!employee) return res.status(400).json({ message: 'Employee is required' });
    const { today, tomorrow } = getTodayRange();
    const attendance = await Attendance.findOne({
      employee,
      date: { $gte: today, $lt: tomorrow },
    });
    if (!attendance?.checkIn) return res.status(400).json({ message: 'Check in first to start meeting' });
    if (attendance.checkOut) return res.status(400).json({ message: 'Cannot start meeting after check out' });
    if (attendance.meetingStartedAt) return res.status(400).json({ message: 'Meeting already started' });
    attendance.meetingStartedAt = new Date();
    await attendance.save();
    const populated = await Attendance.findById(attendance._id).populate('employee');
    res.status(200).json({ message: 'Meeting started', attendance: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error starting meeting', error });
  }
};

export const endMeeting = async (req, res) => {
  try {
    const { employee } = req.body;
    if (!employee) return res.status(400).json({ message: 'Employee is required' });
    const { today, tomorrow } = getTodayRange();
    const attendance = await Attendance.findOne({
      employee,
      date: { $gte: today, $lt: tomorrow },
    });
    if (!attendance?.meetingStartedAt) return res.status(400).json({ message: 'No active meeting found' });
    const now = new Date();
    const mins = Math.max(0, Math.floor((now - attendance.meetingStartedAt) / (1000 * 60)));
    attendance.meetingDurationMinutes = (attendance.meetingDurationMinutes || 0) + mins;
    attendance.meetingStartedAt = null;
    await attendance.save();
    const populated = await Attendance.findById(attendance._id).populate('employee');
    res.status(200).json({ message: 'Meeting ended', attendance: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error ending meeting', error });
  }
};

export const updateLocationTimeline = async (req, res) => {
  try {
    const { employee, latitude, longitude, address } = req.body;
    const lat = typeof latitude === 'number' ? latitude : Number(latitude);
    const lon = typeof longitude === 'number' ? longitude : Number(longitude);
    if (!employee) return res.status(400).json({ message: 'Employee is required' });
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required' });
    }

    const { today, tomorrow } = getTodayRange();
    const attendance = await Attendance.findOne({
      employee,
      date: { $gte: today, $lt: tomorrow },
    });
    if (!attendance?.checkIn || attendance.checkOut) {
      return res.status(400).json({ message: 'No active attendance session found' });
    }

    appendLocationPoint(attendance, { latitude: lat, longitude: lon, address, at: new Date() });
    await attendance.save();
    const populated = await Attendance.findById(attendance._id).populate('employee');
    res.status(200).json({ message: 'Location timeline updated', attendance: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating location timeline', error });
  }
};

export const updateCheckInAddress = createUpdateCheckInAddress(Attendance);
export const updateCheckOutAddress = createUpdateCheckOutAddress(Attendance);
