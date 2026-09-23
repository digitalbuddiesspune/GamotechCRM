const getTodayRange = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  return { today, tomorrow };
};

const patchTimelineAddress = (attendance, lat, lon, address) => {
  const timeline = Array.isArray(attendance.locationTimeline) ? attendance.locationTimeline : [];
  timeline.forEach((point) => {
    const pointLat = Number(point.latitude);
    const pointLon = Number(point.longitude);
    if (
      !Number.isNaN(pointLat) &&
      !Number.isNaN(pointLon) &&
      Math.abs(pointLat - lat) < 0.0001 &&
      Math.abs(pointLon - lon) < 0.0001
    ) {
      point.address = address;
    }
  });
  attendance.locationTimeline = timeline;
};

export const createUpdateCheckInAddress = (Attendance) => async (req, res) => {
  try {
    const { employee, address, latitude, longitude } = req.body;
    if (employee == null) {
      return res.status(400).json({ message: 'Employee is required' });
    }
    const trimmed = typeof address === 'string' ? address.trim() : '';
    if (!trimmed) {
      return res.status(400).json({ message: 'Address is required' });
    }

    const { today, tomorrow } = getTodayRange();
    const attendance = await Attendance.findOne({
      employee,
      date: { $gte: today, $lt: tomorrow },
    });
    if (!attendance?.checkIn) {
      return res.status(400).json({ message: 'No check-in found for today' });
    }

    const lat =
      latitude != null && !Number.isNaN(Number(latitude))
        ? Number(latitude)
        : Number(attendance.checkInLatitude);
    const lon =
      longitude != null && !Number.isNaN(Number(longitude))
        ? Number(longitude)
        : Number(attendance.checkInLongitude);

    attendance.checkInAddress = trimmed;
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      patchTimelineAddress(attendance, lat, lon, trimmed);
    }

    await attendance.save();
    const populated = await Attendance.findById(attendance._id).populate('employee');
    res.status(200).json({ message: 'Check-in address updated', attendance: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating check-in address', error });
  }
};

export const createUpdateCheckOutAddress = (Attendance) => async (req, res) => {
  try {
    const { employee, address, latitude, longitude } = req.body;
    if (employee == null) {
      return res.status(400).json({ message: 'Employee is required' });
    }
    const trimmed = typeof address === 'string' ? address.trim() : '';
    if (!trimmed) {
      return res.status(400).json({ message: 'Address is required' });
    }

    const { today, tomorrow } = getTodayRange();
    const attendance = await Attendance.findOne({
      employee,
      date: { $gte: today, $lt: tomorrow },
    });
    if (!attendance?.checkOut) {
      return res.status(400).json({ message: 'No check-out found for today' });
    }

    const lat =
      latitude != null && !Number.isNaN(Number(latitude))
        ? Number(latitude)
        : Number(attendance.checkOutLatitude);
    const lon =
      longitude != null && !Number.isNaN(Number(longitude))
        ? Number(longitude)
        : Number(attendance.checkOutLongitude);

    attendance.checkOutAddress = trimmed;
    if (!Number.isNaN(lat) && !Number.isNaN(lon)) {
      patchTimelineAddress(attendance, lat, lon, trimmed);
    }

    await attendance.save();
    const populated = await Attendance.findById(attendance._id).populate('employee');
    res.status(200).json({ message: 'Check-out address updated', attendance: populated });
  } catch (error) {
    res.status(500).json({ message: 'Error updating check-out address', error });
  }
};
