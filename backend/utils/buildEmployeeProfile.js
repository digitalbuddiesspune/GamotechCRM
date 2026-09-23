import { isLateCheckIn } from './attendanceLate.js';

const parseMonthRange = (monthParam) => {
  const value = String(monthParam || '').trim();
  if (!/^\d{4}-\d{2}$/.test(value)) return null;
  const [yStr, mStr] = value.split('-');
  const year = Number(yStr);
  const monthIndex = Number(mStr) - 1;
  if (year < 2000 || year > 2100 || monthIndex < 0 || monthIndex > 11) return null;
  const rangeStart = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const rangeEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return {
    year,
    monthIndex,
    month: monthIndex + 1,
    monthValue: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
    monthLabel: rangeStart.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    rangeStart,
    rangeEnd,
  };
};

const inRange = (value, range) => {
  if (!range || !value) return false;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return false;
  return d >= range.rangeStart && d <= range.rangeEnd;
};

const leaveOverlapsMonth = (leave, range) => {
  if (!range) return true;
  const start = leave?.startDate ? new Date(leave.startDate) : null;
  const end = leave?.endDate ? new Date(leave.endDate) : start;
  if (!start || Number.isNaN(start.getTime())) return false;
  const safeEnd = end && !Number.isNaN(end.getTime()) ? end : start;
  return start <= range.rangeEnd && safeEnd >= range.rangeStart;
};

export const buildEmployeeProfile = async ({ employeeId, models, month = null }) => {
  const { Employee, Project, Task, Attendance, Leave, Salary } = models;

  const employee = await Employee.findById(employeeId)
    .populate('designation')
    .populate('reportingManager', 'name email designation employeeCode')
    .lean();

  if (!employee) return null;

  const monthRange = parseMonthRange(month);

  const attendanceFilter = { employee: employeeId };
  const leaveFilter = { employee: employeeId };
  const taskFilter = { assignedTo: employeeId, isRecurringTemplate: { $ne: true } };
  const salaryFilter = { employee: employeeId };

  if (monthRange) {
    attendanceFilter.date = { $gte: monthRange.rangeStart, $lte: monthRange.rangeEnd };
    leaveFilter.startDate = { $lte: monthRange.rangeEnd };
    leaveFilter.$or = [
      { endDate: { $gte: monthRange.rangeStart } },
      { endDate: null },
      { endDate: { $exists: false } },
    ];
    taskFilter.$or = [
      { createdAt: { $gte: monthRange.rangeStart, $lte: monthRange.rangeEnd } },
      { dueDate: { $gte: monthRange.rangeStart, $lte: monthRange.rangeEnd } },
      { completedAt: { $gte: monthRange.rangeStart, $lte: monthRange.rangeEnd } },
      { 'rating.ratedAt': { $gte: monthRange.rangeStart, $lte: monthRange.rangeEnd } },
    ];
    salaryFilter.year = monthRange.year;
    salaryFilter.month = monthRange.month;
  }

  const attendanceQuery = Attendance.find(attendanceFilter).sort({ date: -1 });
  if (!monthRange) attendanceQuery.limit(60);

  const [managedProjects, teamProjects, tasks, attendance, leavesAll, leaves, salaries] = await Promise.all([
    Project.find({ projectManager: employeeId })
      .populate('client', 'clientName name companyName mailId clientNumber businessType city')
      .select('projectName status priority progress startDate endDate deadline client department')
      .lean(),
    Project.find({ teamMembers: employeeId })
      .populate('client', 'clientName name companyName mailId clientNumber businessType city')
      .select('projectName status priority progress startDate endDate deadline client department projectManager')
      .lean(),
    Task.find(taskFilter)
      .populate('project', 'projectName')
      .populate('rating.ratedBy', 'name designation')
      .select('title status priority dueDate completedAt project estimatedDurationMinutes rating createdAt')
      .sort({ updatedAt: -1 })
      .lean(),
    attendanceQuery.lean(),
    // Full leave history for annual leave-balance calculation
    Leave.find({ employee: employeeId }).sort({ startDate: -1 }).lean(),
    Leave.find(leaveFilter).sort({ startDate: -1 }).lean(),
    Salary.find(salaryFilter).sort({ year: -1, month: -1 }).lean(),
  ]);

  const monthLeaves = monthRange
    ? leaves.filter((leave) => leaveOverlapsMonth(leave, monthRange))
    : leaves;

  const presentDays = attendance.filter((a) => ['Full Day', 'Half Day'].includes(a.status)).length;
  const absentDays = attendance.filter((a) => a.status === 'Absent').length;
  const lateMarks = attendance.filter((a) => isLateCheckIn(a.checkIn)).length;

  const leaveBalance = {
    sick: 12 - leavesAll.filter((l) => l.leaveType === 'Sick' && l.status === 'Approved').reduce((s, l) => s + (l.numberOfDays || 1), 0),
    casual: 12 - leavesAll.filter((l) => l.leaveType === 'Casual' && l.status === 'Approved').reduce((s, l) => s + (l.numberOfDays || 1), 0),
    annual: 15 - leavesAll.filter((l) => l.leaveType === 'Annual' && l.status === 'Approved').reduce((s, l) => s + (l.numberOfDays || 1), 0),
  };

  const assignedProjects = [
    ...managedProjects.map((p) => ({ ...p, role: 'Project Manager' })),
    ...teamProjects
      .filter((p) => !managedProjects.some((m) => String(m._id) === String(p._id)))
      .map((p) => ({ ...p, role: 'Team Member' })),
  ];

  const ratedTasks = tasks.filter((t) => t.rating?.score);
  const taskRatingScores = ratedTasks
    .map((t) => Number(t.rating.score))
    .filter((score) => Number.isFinite(score) && score > 0);
  const taskRatingAverage = taskRatingScores.length
    ? Math.round((taskRatingScores.reduce((sum, score) => sum + score, 0) / taskRatingScores.length) * 10) / 10
    : null;

  const taskRatingPerformance = {
    averageRating: taskRatingAverage,
    ratedTaskCount: ratedTasks.length,
    totalAssignedTasks: tasks.length,
    assignedTasks: tasks.map((t) => ({
      taskId: t._id,
      title: t.title,
      projectName: t.project?.projectName || '',
      status: t.status,
      priority: t.priority,
      dueDate: t.dueDate,
      completedAt: t.completedAt,
      createdAt: t.createdAt,
      estimatedDurationMinutes: t.estimatedDurationMinutes,
      ratingScore: t.rating?.score ?? null,
      ratingComments: t.rating?.comments || '',
      ratedAt: t.rating?.ratedAt || null,
      ratedByName: t.rating?.ratedBy?.name || '',
    })),
    ratings: ratedTasks
      .map((t) => ({
        taskId: t._id,
        title: t.title,
        projectName: t.project?.projectName || '',
        score: t.rating.score,
        comments: t.rating.comments || '',
        ratedAt: t.rating.ratedAt,
        ratedByName: t.rating.ratedBy?.name || '',
        status: t.status,
        completedAt: t.completedAt,
      }))
      .sort((a, b) => new Date(b.ratedAt || 0) - new Date(a.ratedAt || 0)),
  };

  const employeePerformance = employee.performance || {};
  const filteredPerformance = monthRange
    ? {
        ...employeePerformance,
        reviews: (employeePerformance.reviews || []).filter((r) => inRange(r.date, monthRange)),
        appraisalHistory: (employeePerformance.appraisalHistory || []).filter((a) => inRange(a.date, monthRange)),
        goals: (employeePerformance.goals || []).filter((g) => inRange(g.dueDate, monthRange) || inRange(g.createdAt, monthRange)),
      }
    : employeePerformance;

  return {
    employee,
    assignedProjects,
    tasks,
    taskRatingPerformance,
    attendance: {
      summary: { presentDays, absentDays, lateMarks, totalRecords: attendance.length },
      records: attendance,
      leaveBalance,
      leaveHistory: monthLeaves,
    },
    salaries,
    performance: filteredPerformance,
    skills: employee.skills || {},
    assets: employee.assets || {},
    documents: employee.documents || {},
    access: {
      ...(employee.access || {}),
      crmRole: employee.access?.crmRole || employee.designation?.title || '',
      accountStatus: employee.access?.accountStatus || employee.employmentStatus || employee.status || 'Active',
    },
    notes: employee.notes || {},
    month: monthRange?.monthValue || null,
    monthLabel: monthRange?.monthLabel || null,
  };
};
