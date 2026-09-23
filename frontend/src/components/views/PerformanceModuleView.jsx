import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'

const PERIOD_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'this_week', label: 'This Week' },
  { value: 'last_week', label: 'Last Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'last_month', label: 'Last Month' },
]

const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDuration = (minutes) => {
  const mins = Number(minutes)
  if (!Number.isFinite(mins) || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

const startOfWeek = (ref = new Date()) => {
  const d = new Date(ref)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfWeek = (ref = new Date()) => {
  const start = startOfWeek(ref)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

const startOfMonth = (year, monthIndex) => {
  const d = new Date(year, monthIndex, 1)
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfMonth = (year, monthIndex) => {
  const d = new Date(year, monthIndex + 1, 0)
  d.setHours(23, 59, 59, 999)
  return d
}

const getPeriodRange = (period, customMonth) => {
  const now = new Date()
  if (period === 'all') return null

  if (period === 'this_week') {
    return { start: startOfWeek(now), end: endOfWeek(now), label: 'This week' }
  }
  if (period === 'last_week') {
    const lastWeekRef = new Date(now)
    lastWeekRef.setDate(now.getDate() - 7)
    return { start: startOfWeek(lastWeekRef), end: endOfWeek(lastWeekRef), label: 'Last week' }
  }
  if (period === 'this_month') {
    return {
      start: startOfMonth(now.getFullYear(), now.getMonth()),
      end: endOfMonth(now.getFullYear(), now.getMonth()),
      label: now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
    }
  }
  if (period === 'last_month') {
    const m = now.getMonth() - 1
    const y = m < 0 ? now.getFullYear() - 1 : now.getFullYear()
    const monthIndex = (m + 12) % 12
    const label = new Date(y, monthIndex, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    return { start: startOfMonth(y, monthIndex), end: endOfMonth(y, monthIndex), label }
  }
  if (period === 'custom_month' && customMonth) {
    const [y, m] = customMonth.split('-').map(Number)
    if (!y || !m) return null
    const monthIndex = m - 1
    const label = new Date(y, monthIndex, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    return { start: startOfMonth(y, monthIndex), end: endOfMonth(y, monthIndex), label }
  }
  return null
}

const isDateInRange = (date, range) => {
  if (!range) return true
  if (!date) return false
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return false
  return d >= range.start && d <= range.end
}

const getTaskActivityDate = (task) =>
  task.ratedAt || task.completedAt || task.dueDate || task.createdAt || null

const taskStatusClass = (status) => {
  switch (status) {
    case 'Completed': return 'bg-green-100 text-green-800'
    case 'In Progress': return 'bg-blue-100 text-blue-800'
    case 'Cancelled': return 'bg-gray-100 text-gray-600'
    default: return 'bg-amber-100 text-amber-800'
  }
}

const StarRating = ({ rating = 0 }) => {
  const stars = []
  for (let i = 1; i <= 5; i += 1) {
    stars.push(
      <svg key={i} className={`w-5 h-5 ${i <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`} fill='currentColor' viewBox='0 0 20 20'>
        <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
      </svg>
    )
  }
  return <div className='flex items-center gap-1'>{stars}</div>
}

const StatBox = ({ label, value, color }) => {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  }
  return (
    <div className={`rounded-lg border px-4 py-3 text-center ${colors[color] || colors.blue}`}>
      <p className='text-2xl font-bold'>{value}</p>
      <p className='text-xs mt-1 opacity-80'>{label}</p>
    </div>
  )
}

const currentMonthValue = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const PerformanceModuleView = () => {
  const navigate = useNavigate()
  const [employees, setEmployees] = useState([])
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('')
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [error, setError] = useState(null)
  const [periodFilter, setPeriodFilter] = useState('all')
  const [customMonth, setCustomMonth] = useState(currentMonthValue())

  useEffect(() => {
    const loadEmployees = async () => {
      try {
        setEmployeesLoading(true)
        const res = await api.get('/employees')
        const list = Array.isArray(res.data) ? res.data : res.data?.data || []
        setEmployees(list.filter((e) => e.status !== 'Inactive'))
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load employees')
      } finally {
        setEmployeesLoading(false)
      }
    }
    loadEmployees()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setProfile(null)
      return
    }
    let cancelled = false
    const loadProfile = async () => {
      try {
        setProfileLoading(true)
        setError(null)
        const res = await api.get(`/employees/${selectedId}/profile`)
        if (!cancelled) setProfile(res.data)
      } catch (err) {
        if (!cancelled) {
          setError(err.response?.data?.message || err.message || 'Failed to load performance data')
          setProfile(null)
        }
      } finally {
        if (!cancelled) setProfileLoading(false)
      }
    }
    loadProfile()
    return () => {
      cancelled = true
    }
  }, [selectedId])

  const periodRange = useMemo(
    () => getPeriodRange(periodFilter, customMonth),
    [periodFilter, customMonth],
  )

  const derived = useMemo(() => {
    if (!profile?.employee) return null
    const e = profile.employee
    const performance = e.performance || {}
    const taskRating = profile.taskRatingPerformance || {}
    const allAssignedTasks = taskRating.assignedTasks?.length
      ? taskRating.assignedTasks
      : (profile.tasks || []).map((t) => ({
          taskId: t._id,
          title: t.title,
          projectName: t.project?.projectName || '',
          status: t.status,
          dueDate: t.dueDate,
          completedAt: t.completedAt,
          createdAt: t.createdAt,
          estimatedDurationMinutes: t.estimatedDurationMinutes,
          ratingScore: t.rating?.score ?? null,
          ratingComments: t.rating?.comments || '',
          ratedAt: t.rating?.ratedAt || null,
          ratedByName: t.rating?.ratedBy?.name || '',
        }))

    const assignedTasks = allAssignedTasks.filter((task) =>
      isDateInRange(getTaskActivityDate(task), periodRange),
    )

    const ratedInPeriod = assignedTasks.filter((t) => t.ratingScore)
    const ratingScores = ratedInPeriod
      .map((t) => Number(t.ratingScore))
      .filter((s) => Number.isFinite(s) && s > 0)
    const taskAvgRating = ratingScores.length
      ? Math.round((ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length) * 10) / 10
      : null

    const reviewsInPeriod = (performance.reviews || []).filter((r) =>
      isDateInRange(r.date, periodRange),
    )
    const appraisalsInPeriod = (performance.appraisalHistory || []).filter((a) =>
      isDateInRange(a.date, periodRange),
    )
    const latestReview = reviewsInPeriod[reviewsInPeriod.length - 1]
      || (periodFilter === 'all' ? performance.reviews?.[performance.reviews.length - 1] : null)
    const hrRating = latestReview?.rating
      || appraisalsInPeriod.slice(-1)[0]?.score
      || (periodFilter === 'all'
        ? (performance.reviews?.[performance.reviews.length - 1]?.rating
          || performance.appraisalHistory?.slice(-1)?.[0]?.score
          || null)
        : null)

    const goalsInPeriod = (performance.goals || []).filter((g) =>
      isDateInRange(g.dueDate, periodRange),
    )

    return {
      employee: e,
      performance,
      assignedTasks,
      allAssignedCount: allAssignedTasks.length,
      ratedTaskCount: ratedInPeriod.length,
      hrRating,
      taskAvgRating,
      latestReview,
      goalsInPeriod,
      reviewsInPeriod,
    }
  }, [profile, periodFilter, periodRange])

  const selectedEmployee = employees.find((emp) => String(emp._id) === String(selectedId))

  const periodLabel = periodFilter === 'all'
    ? 'All time'
    : periodRange?.label || 'Selected period'

  return (
    <div className='p-6 md:p-8 w-full bg-gray-50 min-h-full'>
      <div className='mb-6'>
        <p className='text-xs font-semibold uppercase tracking-wide text-blue-600 mb-1'>Employees</p>
        <h1 className='text-2xl font-bold text-gray-900'>Performance</h1>
        <p className='text-gray-600 mt-1 text-sm'>Select an employee and filter by week or month to view performance ratings.</p>
      </div>

      <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6 space-y-5'>
        <div>
          <label htmlFor='employee-select' className='block text-sm font-medium text-gray-700 mb-2'>
            Select Employee
          </label>
          <div className='flex flex-col sm:flex-row gap-3'>
            <select
              id='employee-select'
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              disabled={employeesLoading}
              className='flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
            >
              <option value=''>{employeesLoading ? 'Loading employees…' : 'Choose an employee'}</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}
                  {emp.designation?.title ? ` — ${emp.designation.title}` : ''}
                  {emp.department ? ` (${emp.department})` : ''}
                </option>
              ))}
            </select>
            {selectedId && (
              <button
                type='button'
                onClick={() => navigate(`/employees/${selectedId}/profile`)}
                className='px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 whitespace-nowrap'
              >
                Full Profile
              </button>
            )}
          </div>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-2'>Filter by Period</label>
          <div className='flex flex-wrap gap-2 mb-3'>
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type='button'
                onClick={() => setPeriodFilter(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                  periodFilter === opt.value
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className='flex flex-col sm:flex-row sm:items-center gap-2'>
            <label htmlFor='custom-month' className='text-sm text-gray-600 shrink-0'>
              Or pick a month:
            </label>
            <input
              id='custom-month'
              type='month'
              value={customMonth}
              onChange={(e) => {
                setCustomMonth(e.target.value)
                setPeriodFilter('custom_month')
              }}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
            />
            {periodFilter === 'custom_month' && periodRange && (
              <span className='text-xs text-gray-500'>Showing {periodRange.label}</span>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className='mb-6 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700'>
          {error}
        </div>
      )}

      {!selectedId && !employeesLoading && (
        <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center'>
          <p className='text-gray-500 text-sm'>Select an employee above to view their performance ratings.</p>
        </div>
      )}

      {selectedId && profileLoading && (
        <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center'>
          <p className='text-gray-500 text-sm'>Loading performance data…</p>
        </div>
      )}

      {selectedId && !profileLoading && derived && (
        <div className='space-y-6'>
          <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
              <div className='flex items-center gap-4'>
                <div className='w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-lg font-bold'>
                  {(derived.employee.name || '?').split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h2 className='text-xl font-bold text-gray-900'>{derived.employee.name}</h2>
                  <p className='text-sm text-gray-500'>
                    {derived.employee.designation?.title || 'Employee'}
                    {derived.employee.department ? ` · ${derived.employee.department}` : ''}
                  </p>
                  <p className='text-xs text-gray-400 mt-0.5'>{derived.employee.email}</p>
                </div>
              </div>
              <div className='text-right'>
                <p className='text-xs font-semibold text-blue-600 uppercase tracking-wide'>Period</p>
                <p className='text-sm font-medium text-gray-900 mt-0.5'>{periodLabel}</p>
                {periodRange && (
                  <p className='text-xs text-gray-500 mt-0.5'>
                    {formatDate(periodRange.start)} – {formatDate(periodRange.end)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'>
            <StatBox
              label='Avg Task Rating'
              value={derived.taskAvgRating != null ? `${derived.taskAvgRating}/5` : '—'}
              color='green'
            />
            <StatBox label='HR Review Rating' value={derived.hrRating ? `${derived.hrRating}/5` : '—'} color='purple' />
            <StatBox label='Tasks in Period' value={derived.assignedTasks.length} color='blue' />
            <StatBox label='Rated in Period' value={derived.ratedTaskCount} color='yellow' />
          </div>

          <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
            <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
              <div className='px-5 py-4 border-b border-gray-100'>
                <h3 className='text-sm font-semibold text-gray-900'>Task Rating Summary</h3>
                <p className='text-xs text-gray-500 mt-0.5'>{periodLabel}</p>
              </div>
              <div className='p-5'>
                <p className='text-xs text-gray-500 mb-2'>Average from manager task ratings in this period</p>
                <div className='flex items-center gap-3 mb-4'>
                  <StarRating rating={derived.taskAvgRating || 0} />
                  <span className='text-2xl font-bold text-gray-900'>
                    {derived.taskAvgRating != null ? `${derived.taskAvgRating} / 5` : '—'}
                  </span>
                </div>
                <p className='text-sm text-gray-600'>
                  {derived.ratedTaskCount} rated of {derived.assignedTasks.length} tasks in period
                  {periodFilter === 'all' && derived.allAssignedCount !== derived.assignedTasks.length
                    ? ` (${derived.allAssignedCount} total assigned)`
                    : ''}
                </p>
              </div>
            </div>

            <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
              <div className='px-5 py-4 border-b border-gray-100'>
                <h3 className='text-sm font-semibold text-gray-900'>HR Performance Reviews</h3>
                <p className='text-xs text-gray-500 mt-0.5'>{periodLabel}</p>
              </div>
              <div className='p-5 space-y-3'>
                <div className='flex items-center gap-3'>
                  <StarRating rating={derived.hrRating || 0} />
                  <span className='text-lg font-bold text-gray-900'>
                    {derived.hrRating ? `${derived.hrRating} / 5` : '—'}
                  </span>
                </div>
                {derived.latestReview ? (
                  <p className='text-sm text-gray-600'>
                    Review: {formatDate(derived.latestReview.date)}
                    {derived.latestReview.comments ? ` — ${derived.latestReview.comments}` : ''}
                  </p>
                ) : (
                  <p className='text-sm text-gray-500'>No HR review in this period.</p>
                )}
                {derived.reviewsInPeriod.length > 1 && (
                  <p className='text-xs text-gray-400'>{derived.reviewsInPeriod.length} reviews in period</p>
                )}
                {(derived.goalsInPeriod.length ? derived.goalsInPeriod : derived.performance.goals || [])
                  .slice(0, 3)
                  .map((g, i) => (
                    <p key={i} className='text-xs text-gray-500'>
                      Goal: {g.title} ({g.status})
                    </p>
                  ))}
              </div>
            </div>
          </div>

          <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
            <div className='px-5 py-4 border-b border-gray-100'>
              <h3 className='text-sm font-semibold text-gray-900'>
                Tasks in Period ({derived.assignedTasks.length})
              </h3>
              <p className='text-xs text-gray-500 mt-0.5'>
                {selectedEmployee?.name || 'Employee'} · {periodLabel}
              </p>
            </div>
            {derived.assignedTasks.length ? (
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase'>
                    <tr>
                      <th className='px-4 py-3'>Task</th>
                      <th className='px-4 py-3'>Project</th>
                      <th className='px-4 py-3'>Status</th>
                      <th className='px-4 py-3'>Due</th>
                      <th className='px-4 py-3'>Duration</th>
                      <th className='px-4 py-3'>Rating</th>
                    </tr>
                  </thead>
                  <tbody className='divide-y divide-gray-100'>
                    {derived.assignedTasks.map((task) => (
                      <tr key={task.taskId} className='hover:bg-gray-50/80'>
                        <td className='px-4 py-3'>
                          <p className='font-medium text-gray-900'>{task.title}</p>
                          {task.ratingComments && (
                            <p className='text-xs text-gray-500 mt-1 line-clamp-2'>&ldquo;{task.ratingComments}&rdquo;</p>
                          )}
                        </td>
                        <td className='px-4 py-3 text-gray-600'>{task.projectName || '—'}</td>
                        <td className='px-4 py-3'>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${taskStatusClass(task.status)}`}>
                            {task.status || 'Pending'}
                          </span>
                        </td>
                        <td className='px-4 py-3 text-gray-600 whitespace-nowrap'>{formatDate(task.dueDate)}</td>
                        <td className='px-4 py-3 text-gray-600 whitespace-nowrap'>{formatDuration(task.estimatedDurationMinutes)}</td>
                        <td className='px-4 py-3'>
                          {task.ratingScore ? (
                            <div>
                              <div className='flex items-center gap-1.5'>
                                <StarRating rating={task.ratingScore} />
                                <span className='text-sm font-bold text-gray-900'>{task.ratingScore}/5</span>
                              </div>
                              {task.ratedByName && (
                                <p className='text-[10px] text-gray-400 mt-1'>
                                  by {task.ratedByName}
                                  {task.ratedAt ? ` · ${formatDate(task.ratedAt)}` : ''}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className='text-xs text-gray-400'>Not rated</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className='p-8 text-sm text-gray-500 text-center'>
                No tasks found for {periodLabel.toLowerCase()}.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default PerformanceModuleView
