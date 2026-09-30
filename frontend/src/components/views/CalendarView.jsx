import React, { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import {
  isAdminUser,
  hasFullAccessForUser,
  canApproveLeaveForUser,
  isPeopleManagerUser,
} from '../../config/authPermissions'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const LEAVE_TYPES = [
  { label: 'Company Holiday', value: 'Company Holiday', color: '#8b5cf6' },
  { label: 'Public Holiday', value: 'Public Holiday', color: '#10b981' },
  { label: 'Optional Holiday', value: 'Optional Holiday', color: '#f59e0b' },
  { label: 'Restricted Holiday', value: 'Restricted Holiday', color: '#ec4899' },
  { label: 'Team Off', value: 'Team Off', color: '#06b6d4' },
  { label: 'Emergency Leave', value: 'Emergency Leave', color: '#ef4444' },
  { label: 'Other', value: 'Other', color: '#64748b' },
]

const COLOR_PRESETS = [
  { name: 'Purple', hex: '#8b5cf6', bg: 'bg-purple-500' },
  { name: 'Emerald', hex: '#10b981', bg: 'bg-emerald-500' },
  { name: 'Blue', hex: '#3b82f6', bg: 'bg-blue-500' },
  { name: 'Amber', hex: '#f59e0b', bg: 'bg-amber-500' },
  { name: 'Rose', hex: '#f43f5e', bg: 'bg-rose-500' },
  { name: 'Cyan', hex: '#06b6d4', bg: 'bg-cyan-500' },
]

const isHigherPositionUser = (user) => {
  if (!user) return false
  if (isAdminUser(user)) return true
  if (hasFullAccessForUser(user)) return true
  if (canApproveLeaveForUser(user)) return true
  if (isPeopleManagerUser(user)) return true
  const role = String(user?.designation?.accessRole || '').toLowerCase().trim()
  const title = String(user?.designation?.title || user?.designation?.name || '').toLowerCase().trim()
  const level = String(user?.designation?.level || '').toLowerCase().trim()
  const perms = user?.designation?.permissions || {}

  if (['admin', 'hr', 'manager', 'team_leader', 'technical_lead'].includes(role)) return true
  if (perms.hasFullAccess || perms.canApproveLeave || perms.canManageEmployees) return true
  if (['lead', 'manager', 'director', 'executive'].includes(level)) return true
  if (
    title.includes('admin') ||
    title.includes('hr') ||
    title.includes('manager') ||
    title.includes('team lead') ||
    title.includes('director') ||
    title.includes('lead')
  ) {
    return true
  }
  return false
}

const formatDateKey = (year, month, day) => {
  const mm = String(month + 1).padStart(2, '0')
  const dd = String(day).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

const toDateInputString = (d) => {
  if (!d) return ''
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const CalendarView = () => {
  const { user } = useAuth()
  const canSetLeaves = useMemo(() => isHigherPositionUser(user), [user])

  // Current system date
  const now = useMemo(() => new Date(), [])
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() // 0-indexed
  const todayKey = formatDateKey(currentYear, currentMonth, now.getDate())

  // Active viewing month & year (starts at current month)
  const [viewYear, setViewYear] = useState(currentYear)
  const [viewMonth, setViewMonth] = useState(currentMonth)

  // Data states
  const [holidays, setHolidays] = useState([])
  const [employeeLeaves, setEmployeeLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('grid') // 'grid' | 'list'
  const [typeFilter, setTypeFilter] = useState('ALL') // 'ALL' | 'HOLIDAYS' | 'LEAVES'

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEvent, setEditingEvent] = useState(null)
  const [selectedEventDetails, setSelectedEventDetails] = useState(null)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const [formSuccess, setFormSuccess] = useState(null)

  // Form fields
  const [formTitle, setFormTitle] = useState('')
  const [formType, setFormType] = useState('Company Holiday')
  const [formStartDate, setFormStartDate] = useState(toDateInputString(now))
  const [formEndDate, setFormEndDate] = useState(toDateInputString(now))
  const [formDescription, setFormDescription] = useState('')
  const [formApplicableTo, setFormApplicableTo] = useState('All')
  const [formDepartment, setFormDepartment] = useState('')
  const [formColor, setFormColor] = useState('#8b5cf6')

  // Check if viewing current month (to disable "Previous Month" button)
  const isAtCurrentMonth = viewYear === currentYear && viewMonth === currentMonth

  // Fetch Leave Calendar for current viewing month
  const fetchCalendarData = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/leave-calendar', {
        params: {
          year: viewYear,
          month: viewMonth + 1,
          includeLeaves: true,
        },
      })
      setHolidays(Array.isArray(res.data?.holidays) ? res.data.holidays : [])
      setEmployeeLeaves(Array.isArray(res.data?.employeeLeaves) ? res.data.employeeLeaves : [])
    } catch (err) {
      console.error('Failed to load leave calendar:', err)
      setError(err.response?.data?.message || err.message || 'Failed to load leave calendar')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCalendarData()
  }, [viewYear, viewMonth])

  // Navigation handlers (enforce current & upcoming months only)
  const handlePrevMonth = () => {
    if (isAtCurrentMonth) return // Cannot navigate to past months
    if (viewMonth === 0) {
      setViewYear((prev) => prev - 1)
      setViewMonth(11)
    } else {
      setViewMonth((prev) => prev - 1)
    }
  }

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((prev) => prev + 1)
      setViewMonth(0)
    } else {
      setViewMonth((prev) => prev + 1)
    }
  }

  const handleJumpToCurrent = () => {
    setViewYear(currentYear)
    setViewMonth(currentMonth)
  }

  // Generate list of upcoming months for quick jump dropdown (current + next 11 months)
  const upcomingMonthOptions = useMemo(() => {
    const list = []
    for (let i = 0; i < 12; i++) {
      const d = new Date(currentYear, currentMonth + i, 1)
      list.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}${i === 0 ? ' (Current)' : ''}`,
      })
    }
    return list
  }, [currentYear, currentMonth])

  // Calendar calculations
  const daysInViewMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay() // 0 = Sunday

  // Group events by day key "YYYY-MM-DD"
  const eventsByDate = useMemo(() => {
    const map = {}

    // Add company holidays
    holidays.forEach((h) => {
      const s = new Date(h.startDate)
      const e = new Date(h.endDate || h.startDate)
      s.setHours(0, 0, 0, 0)
      e.setHours(23, 59, 59, 999)

      // Mark on every day within range that falls in the current view
      const curr = new Date(s)
      while (curr <= e) {
        if (curr.getFullYear() === viewYear && curr.getMonth() === viewMonth) {
          const key = formatDateKey(curr.getFullYear(), curr.getMonth(), curr.getDate())
          if (!map[key]) map[key] = []
          map[key].push({
            ...h,
            isHoliday: true,
            displayType: h.type || 'Company Holiday',
            color: h.color || '#8b5cf6',
          })
        }
        curr.setDate(curr.getDate() + 1)
      }
    })

    // Add employee approved leaves
    employeeLeaves.forEach((l) => {
      const s = new Date(l.startDate)
      const e = new Date(l.endDate || l.startDate)
      s.setHours(0, 0, 0, 0)
      e.setHours(23, 59, 59, 999)

      const curr = new Date(s)
      while (curr <= e) {
        if (curr.getFullYear() === viewYear && curr.getMonth() === viewMonth) {
          const key = formatDateKey(curr.getFullYear(), curr.getMonth(), curr.getDate())
          if (!map[key]) map[key] = []
          map[key].push({
            ...l,
            isEmployeeLeave: true,
            title: `${l.employee?.name || 'Employee'} (${l.leaveType || 'Leave'})`,
            displayType: `${l.leaveType || 'Leave'} Leave`,
            color: '#3b82f6', // blue for employee leaves
          })
        }
        curr.setDate(curr.getDate() + 1)
      }
    })

    return map
  }, [holidays, employeeLeaves, viewYear, viewMonth])

  // Open modal to set leave
  const openSetLeaveModal = (initialDate = null) => {
    if (!canSetLeaves) return
    setEditingEvent(null)
    setFormError(null)
    setFormSuccess(null)
    setFormTitle('')
    setFormType('Company Holiday')

    const minDateStr = toDateInputString(now)
    let defaultDate = initialDate || minDateStr
    if (defaultDate < minDateStr) {
      defaultDate = minDateStr
    }

    setFormStartDate(defaultDate)
    setFormEndDate(defaultDate)
    setFormDescription('')
    setFormApplicableTo('All')
    setFormDepartment('')
    setFormColor('#8b5cf6')
    setIsModalOpen(true)
  }

  // Open modal to edit existing leave
  const openEditModal = (event) => {
    if (!canSetLeaves || event.isEmployeeLeave) return
    setEditingEvent(event)
    setFormError(null)
    setFormSuccess(null)
    setFormTitle(event.title || '')
    setFormType(event.type || 'Company Holiday')
    setFormStartDate(toDateInputString(event.startDate))
    setFormEndDate(toDateInputString(event.endDate || event.startDate))
    setFormDescription(event.description || '')
    setFormApplicableTo(event.applicableTo || 'All')
    setFormDepartment(event.department || '')
    setFormColor(event.color || '#8b5cf6')
    setSelectedEventDetails(null)
    setIsModalOpen(true)
  }

  // Submit leave form
  const handleSaveLeave = async (e) => {
    e.preventDefault()
    if (!formTitle.trim()) {
      setFormError('Please enter a title for the holiday / leave.')
      return
    }
    if (!formStartDate || !formEndDate) {
      setFormError('Please specify start and end dates.')
      return
    }
    if (formEndDate < formStartDate) {
      setFormError('End date cannot be earlier than start date.')
      return
    }

    // Verify date is not in past month
    const startObj = new Date(formStartDate)
    const currentMonthStart = new Date(currentYear, currentMonth, 1, 0, 0, 0, 0)
    if (startObj < currentMonthStart) {
      setFormError('Leaves can only be set for the current month and upcoming months.')
      return
    }

    try {
      setFormSubmitting(true)
      setFormError(null)

      const payload = {
        title: formTitle.trim(),
        type: formType,
        startDate: formStartDate,
        endDate: formEndDate,
        description: formDescription.trim(),
        applicableTo: formApplicableTo,
        department: formApplicableTo === 'Department' ? formDepartment.trim() : '',
        color: formColor,
        actorId: user?._id,
      }

      if (editingEvent && editingEvent._id) {
        await api.put(`/leave-calendar/${editingEvent._id}`, payload)
        setFormSuccess('Leave calendar entry updated successfully!')
      } else {
        await api.post('/leave-calendar', payload)
        setFormSuccess('Leave set on calendar successfully!')
      }

      await fetchCalendarData()
      setTimeout(() => {
        setIsModalOpen(false)
        setEditingEvent(null)
      }, 700)
    } catch (err) {
      console.error('Failed to save leave calendar entry:', err)
      setFormError(err.response?.data?.message || err.message || 'Failed to save leave calendar entry.')
    } finally {
      setFormSubmitting(false)
    }
  }

  // Delete leave calendar entry
  const handleDeleteLeave = async (eventId) => {
    if (!canSetLeaves || !eventId) return
    const confirmed = window.confirm('Are you sure you want to remove this leave from the calendar?')
    if (!confirmed) return

    try {
      setLoading(true)
      await api.delete(`/leave-calendar/${eventId}`, {
        params: { actorId: user?._id },
      })
      setSelectedEventDetails(null)
      await fetchCalendarData()
    } catch (err) {
      console.error('Failed to delete leave entry:', err)
      alert(err.response?.data?.message || 'Failed to delete leave entry')
    } finally {
      setLoading(false)
    }
  }

  // Day cell click handler
  const handleDayClick = (day) => {
    const clickedDateStr = formatDateKey(viewYear, viewMonth, day)
    const minAllowedDate = toDateInputString(now)

    if (clickedDateStr < minAllowedDate) {
      // Past day
      return
    }

    if (canSetLeaves) {
      openSetLeaveModal(clickedDateStr)
    }
  }

  // Summary counts
  const totalHolidaysThisMonth = holidays.length
  const totalEmployeeLeavesThisMonth = employeeLeaves.length
  const upcomingHolidaysList = useMemo(() => {
    return [...holidays]
      .filter((h) => new Date(h.startDate).getTime() >= now.getTime() - 24 * 60 * 60 * 1000)
      .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      .slice(0, 5)
  }, [holidays, now])

  return (
    <div className='p-6 md:p-8 bg-[#f4f6f9] min-h-full'>
      {/* Header */}
      <div className='mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
        <div>
          <div className='flex items-center gap-3'>
            <h1 className='text-2xl md:text-3xl font-bold text-gray-900'>Leave Calendar</h1>
            <span className='px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200'>
              Current & Upcoming Months
            </span>
          </div>
          <p className='text-gray-600 mt-1 text-sm'>
            Official company holidays, designated days off, and team leave schedules.
          </p>
        </div>

        {/* Action button & Role status badge */}
        <div className='flex flex-wrap items-center gap-3'>
          {canSetLeaves ? (
            <div className='flex items-center gap-2'>
              <span className='hidden sm:inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200'>
                <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse'></span>
                Authorized to Set Leaves
              </span>
              <button
                type='button'
                onClick={() => openSetLeaveModal()}
                className='inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition-all'
              >
                <span>+ Set Leave / Holiday</span>
              </button>
            </div>
          ) : (
            <div className='inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200'>
              <span className='mr-1.5'>👁</span> Viewing Mode · Leaves are set by Higher Management
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>Active Month</p>
          <p className='text-xl font-bold text-gray-900 mt-1'>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
          <p className='text-xs text-purple-600 mt-0.5 font-medium'>
            {isAtCurrentMonth ? 'Current Month' : 'Upcoming Month'}
          </p>
        </div>

        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>Company Holidays & Offs</p>
          <p className='text-2xl font-bold text-purple-600 mt-1'>
            {loading ? '—' : totalHolidaysThisMonth}
          </p>
          <p className='text-xs text-gray-500 mt-0.5'>Official scheduled leaves</p>
        </div>

        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>Approved Team Leaves</p>
          <p className='text-2xl font-bold text-blue-600 mt-1'>
            {loading ? '—' : totalEmployeeLeavesThisMonth}
          </p>
          <p className='text-xs text-gray-500 mt-0.5'>Staff out of office</p>
        </div>

        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>Calendar Scope</p>
          <p className='text-sm font-semibold text-gray-900 mt-1.5 flex items-center gap-1.5'>
            <span className='w-2 h-2 rounded-full bg-green-500'></span>
            Current & Future Months
          </p>
          <p className='text-xs text-gray-500 mt-0.5'>Past months locked</p>
        </div>
      </div>

      {/* Calendar Controls & Month Switcher */}
      <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4'>
        {/* Month Navigation */}
        <div className='flex items-center gap-3'>
          <div className='inline-flex items-center rounded-lg border border-gray-200 bg-gray-50 p-1'>
            <button
              type='button'
              onClick={handlePrevMonth}
              disabled={isAtCurrentMonth}
              title={isAtCurrentMonth ? 'Viewing restricted to current and upcoming months only' : 'Previous month'}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                isAtCurrentMonth
                  ? 'text-gray-300 cursor-not-allowed bg-transparent'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-white shadow-xs'
              }`}
            >
              ← Prev Month
            </button>
            <button
              type='button'
              onClick={handleJumpToCurrent}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                isAtCurrentMonth
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-700 hover:text-gray-900 hover:bg-white'
              }`}
            >
              Current Month
            </button>
            <button
              type='button'
              onClick={handleNextMonth}
              title='Next month'
              className='px-3 py-1.5 text-xs font-semibold rounded-md text-gray-700 hover:text-gray-900 hover:bg-white shadow-xs transition-colors'
            >
              Next Month →
            </button>
          </div>

          <h2 className='text-lg font-bold text-gray-900 ml-1'>
            {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>
        </div>

        {/* Select Dropdown & View Mode Switch */}
        <div className='flex flex-wrap items-center gap-3'>
          <div className='flex items-center gap-2'>
            <label htmlFor='monthJump' className='text-xs font-medium text-gray-500'>
              Jump to:
            </label>
            <select
              id='monthJump'
              value={`${viewYear}-${viewMonth}`}
              onChange={(e) => {
                const [y, m] = e.target.value.split('-').map(Number)
                setViewYear(y)
                setViewMonth(m)
              }}
              className='border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500'
            >
              {upcomingMonthOptions.map((opt) => (
                <option key={`${opt.year}-${opt.month}`} value={`${opt.year}-${opt.month}`}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Filter options */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className='border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-purple-500'
          >
            <option value='ALL'>All Events ({holidays.length + employeeLeaves.length})</option>
            <option value='HOLIDAYS'>Company Holidays Only ({holidays.length})</option>
            <option value='LEAVES'>Team Leaves Only ({employeeLeaves.length})</option>
          </select>

          {/* View toggle */}
          <div className='inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5'>
            <button
              type='button'
              onClick={() => setActiveTab('grid')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'grid' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Grid View
            </button>
            <button
              type='button'
              onClick={() => setActiveTab('list')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${
                activeTab === 'list' ? 'bg-white text-gray-900 shadow-xs' : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Agenda List
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className='bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-6'>
          <p className='font-semibold'>Error loading leave calendar</p>
          <p className='text-xs mt-1'>{error}</p>
        </div>
      ) : null}

      {/* Main Content Area */}
      {loading ? (
        <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center'>
          <div className='inline-block animate-spin rounded-full h-8 w-8 border-4 border-purple-500 border-t-transparent mb-3'></div>
          <p className='text-sm text-gray-600'>Loading leave calendar for {MONTH_NAMES[viewMonth]} {viewYear}…</p>
        </div>
      ) : activeTab === 'grid' ? (
        /* Calendar Grid View */
        <div className='grid grid-cols-1 lg:grid-cols-4 gap-6'>
          {/* Main 7-Column Grid */}
          <div className='lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-5'>
            {/* Days of Week Header */}
            <div className='grid grid-cols-7 gap-2 mb-2'>
              {DAYS_OF_WEEK.map((d, idx) => (
                <div
                  key={d}
                  className={`text-center font-bold text-xs py-2 uppercase tracking-wider ${
                    idx === 0 || idx === 6 ? 'text-rose-500' : 'text-gray-600'
                  }`}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar Cells */}
            <div className='grid grid-cols-7 gap-2'>
              {/* Empty padding cells before first day */}
              {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                <div
                  key={`pad-${idx}`}
                  className='min-h-[105px] border border-dashed border-gray-100 rounded-xl bg-gray-50/50'
                />
              ))}

              {/* Day cells */}
              {Array.from({ length: daysInViewMonth }, (_, i) => i + 1).map((day) => {
                const dateKey = formatDateKey(viewYear, viewMonth, day)
                const isToday = isAtCurrentMonth && day === now.getDate()
                const isPastDay = isAtCurrentMonth && day < now.getDate()
                const allEventsOnDay = eventsByDate[dateKey] || []

                const filteredEventsOnDay = allEventsOnDay.filter((ev) => {
                  if (typeFilter === 'HOLIDAYS') return ev.isHoliday
                  if (typeFilter === 'LEAVES') return ev.isEmployeeLeave
                  return true
                })

                const dayOfWeek = (firstDayOfWeek + day - 1) % 7
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

                return (
                  <div
                    key={day}
                    onClick={() => handleDayClick(day)}
                    className={`min-h-[105px] border rounded-xl p-2 flex flex-col justify-between transition-all select-none ${
                      isToday
                        ? 'border-purple-500 bg-purple-50/40 ring-2 ring-purple-400 ring-opacity-40'
                        : isPastDay
                        ? 'border-gray-200 bg-gray-50/60 opacity-80'
                        : isWeekend
                        ? 'border-gray-200 bg-gray-50/30 hover:border-purple-300 hover:shadow-xs cursor-pointer'
                        : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-xs cursor-pointer'
                    }`}
                  >
                    {/* Day number & today pill */}
                    <div className='flex items-center justify-between'>
                      <span
                        className={`text-xs font-bold ${
                          isToday
                            ? 'w-6 h-6 rounded-full bg-purple-600 text-white flex items-center justify-center'
                            : isWeekend
                            ? 'text-rose-500'
                            : isPastDay
                            ? 'text-gray-400'
                            : 'text-gray-800'
                        }`}
                      >
                        {day}
                      </span>

                      {isToday && (
                        <span className='text-[10px] uppercase font-bold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded'>
                          Today
                        </span>
                      )}

                      {/* Click to add prompt for higher position users */}
                      {canSetLeaves && !isPastDay && filteredEventsOnDay.length === 0 && (
                        <span className='text-[10px] text-gray-300 hover:text-purple-600 transition-colors' title='Click to set leave'>
                          +
                        </span>
                      )}
                    </div>

                    {/* Events list inside day cell */}
                    <div className='mt-1.5 space-y-1 overflow-hidden flex-1'>
                      {filteredEventsOnDay.slice(0, 2).map((ev, idx) => (
                        <div
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedEventDetails(ev)
                          }}
                          style={{
                            borderLeftColor: ev.color || '#8b5cf6',
                          }}
                          className={`text-[11px] leading-tight px-1.5 py-1 rounded truncate border-l-2 font-medium cursor-pointer transition-transform hover:scale-[1.02] ${
                            ev.isHoliday
                              ? 'bg-purple-100/80 text-purple-900'
                              : 'bg-blue-100/80 text-blue-900'
                          }`}
                          title={`${ev.title} (${ev.displayType})`}
                        >
                          <span className='font-semibold mr-1'>
                            {ev.isHoliday ? '🏖' : '👤'}
                          </span>
                          {ev.title}
                        </div>
                      ))}

                      {filteredEventsOnDay.length > 2 && (
                        <div
                          onClick={(e) => {
                            e.stopPropagation()
                            setSelectedEventDetails(filteredEventsOnDay[2])
                          }}
                          className='text-[10px] font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 px-1.5 py-0.5 rounded text-center cursor-pointer'
                        >
                          +{filteredEventsOnDay.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Sidebar Info & Upcoming Holidays */}
          <div className='space-y-5'>
            {/* Upcoming Holidays Card */}
            <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-5'>
              <div className='flex items-center justify-between mb-3'>
                <h3 className='text-sm font-bold text-gray-900'>Upcoming Holidays</h3>
                <span className='text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded'>
                  {upcomingHolidaysList.length} scheduled
                </span>
              </div>

              {upcomingHolidaysList.length === 0 ? (
                <p className='text-xs text-gray-500 py-3 text-center'>
                  No upcoming company holidays in this month.
                  {canSetLeaves ? ' Click "+ Set Leave" to add one!' : ''}
                </p>
              ) : (
                <div className='space-y-2.5'>
                  {upcomingHolidaysList.map((h) => {
                    const start = new Date(h.startDate)
                    const end = new Date(h.endDate || h.startDate)
                    const isMulti = start.toDateString() !== end.toDateString()

                    return (
                      <div
                        key={h._id}
                        onClick={() => setSelectedEventDetails({ ...h, isHoliday: true })}
                        className='p-2.5 rounded-lg border border-gray-100 hover:border-purple-200 hover:bg-purple-50/40 cursor-pointer transition-all'
                      >
                        <div className='flex items-start justify-between gap-2'>
                          <p className='text-xs font-bold text-gray-900 leading-snug'>{h.title}</p>
                          <span
                            className='text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0'
                            style={{ backgroundColor: `${h.color || '#8b5cf6'}20`, color: h.color || '#8b5cf6' }}
                          >
                            {h.type || 'Holiday'}
                          </span>
                        </div>
                        <p className='text-[11px] text-gray-500 mt-1'>
                          📅 {start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          {isMulti ? ` - ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : ''}
                        </p>
                        {h.applicableTo && h.applicableTo !== 'All' && (
                          <p className='text-[10px] text-amber-600 mt-0.5'>
                            Dept: {h.department || h.applicableTo}
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Calendar Legend */}
            <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-5'>
              <h3 className='text-sm font-bold text-gray-900 mb-3'>Legend</h3>
              <div className='space-y-2 text-xs'>
                <div className='flex items-center gap-2'>
                  <span className='w-3 h-3 rounded-full bg-purple-500'></span>
                  <span className='text-gray-700 font-medium'>Company Holiday / Leave</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='w-3 h-3 rounded-full bg-emerald-500'></span>
                  <span className='text-gray-700 font-medium'>Public Holiday</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='w-3 h-3 rounded-full bg-blue-500'></span>
                  <span className='text-gray-700 font-medium'>Approved Team Leave</span>
                </div>
                <div className='flex items-center gap-2'>
                  <span className='w-3 h-3 rounded-full bg-amber-500'></span>
                  <span className='text-gray-700 font-medium'>Optional / Team Day Off</span>
                </div>
              </div>

              {canSetLeaves && (
                <div className='mt-4 pt-3 border-t border-gray-100'>
                  <button
                    type='button'
                    onClick={() => openSetLeaveModal()}
                    className='w-full text-center text-xs font-semibold text-purple-700 hover:text-purple-900 py-1.5 rounded-lg hover:bg-purple-50 transition-colors'
                  >
                    + Set New Leave on Calendar
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Agenda List View */
        <div className='bg-white rounded-xl shadow-sm border border-gray-100 p-6'>
          <h2 className='text-base font-bold text-gray-900 mb-4'>
            Scheduled Leaves for {MONTH_NAMES[viewMonth]} {viewYear}
          </h2>

          {holidays.length === 0 && employeeLeaves.length === 0 ? (
            <div className='text-center py-12 text-gray-500 text-sm'>
              No leaves or holidays scheduled for this month.
            </div>
          ) : (
            <div className='divide-y divide-gray-100'>
              {/* Company Holidays */}
              {holidays.map((h) => {
                const start = new Date(h.startDate)
                const end = new Date(h.endDate || h.startDate)
                return (
                  <div key={h._id} className='py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                    <div className='flex items-start gap-3'>
                      <div className='w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-sm shrink-0'>
                        {start.getDate()}
                      </div>
                      <div>
                        <div className='flex items-center gap-2'>
                          <h4 className='font-bold text-gray-900 text-sm'>{h.title}</h4>
                          <span
                            className='px-2 py-0.5 rounded text-[10px] font-semibold'
                            style={{ backgroundColor: `${h.color || '#8b5cf6'}20`, color: h.color || '#8b5cf6' }}
                          >
                            {h.type || 'Company Holiday'}
                          </span>
                        </div>
                        <p className='text-xs text-gray-500 mt-0.5'>
                          {start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          {start.toDateString() !== end.toDateString() &&
                            ` to ${end.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`}
                          {h.applicableTo && h.applicableTo !== 'All' ? ` · Dept: ${h.department || h.applicableTo}` : ' · All Staff'}
                        </p>
                        {h.description && <p className='text-xs text-gray-600 mt-1'>{h.description}</p>}
                      </div>
                    </div>

                    <div className='flex items-center gap-2 self-end sm:self-center'>
                      <button
                        type='button'
                        onClick={() => setSelectedEventDetails({ ...h, isHoliday: true })}
                        className='text-xs font-semibold text-gray-600 hover:text-gray-900 px-2.5 py-1 rounded border border-gray-200 hover:bg-gray-50'
                      >
                        Details
                      </button>
                      {canSetLeaves && (
                        <>
                          <button
                            type='button'
                            onClick={() => openEditModal({ ...h, isHoliday: true })}
                            className='text-xs font-semibold text-purple-600 hover:text-purple-900 px-2.5 py-1 rounded border border-purple-200 hover:bg-purple-50'
                          >
                            Edit
                          </button>
                          <button
                            type='button'
                            onClick={() => handleDeleteLeave(h._id)}
                            className='text-xs font-semibold text-red-600 hover:text-red-900 px-2.5 py-1 rounded border border-red-200 hover:bg-red-50'
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Employee Leaves */}
              {employeeLeaves.map((l) => {
                const start = new Date(l.startDate)
                const end = new Date(l.endDate || l.startDate)
                return (
                  <div key={l._id} className='py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3'>
                    <div className='flex items-start gap-3'>
                      <div className='w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm shrink-0'>
                        {start.getDate()}
                      </div>
                      <div>
                        <div className='flex items-center gap-2'>
                          <h4 className='font-bold text-gray-900 text-sm'>
                            {l.employee?.name || 'Employee'}
                          </h4>
                          <span className='px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200'>
                            {l.leaveType || 'Leave'}
                          </span>
                        </div>
                        <p className='text-xs text-gray-500 mt-0.5'>
                          {start.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                          {start.toDateString() !== end.toDateString() &&
                            ` to ${end.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`}
                          {l.employee?.department ? ` · Dept: ${l.employee.department}` : ''}
                        </p>
                        {l.reason && <p className='text-xs text-gray-600 mt-1 italic'>"{l.reason}"</p>}
                      </div>
                    </div>

                    <button
                      type='button'
                      onClick={() =>
                        setSelectedEventDetails({
                          ...l,
                          isEmployeeLeave: true,
                          title: `${l.employee?.name || 'Employee'} (${l.leaveType || 'Leave'})`,
                        })
                      }
                      className='text-xs font-semibold text-gray-600 hover:text-gray-900 px-2.5 py-1 rounded border border-gray-200 hover:bg-gray-50 self-end sm:self-center'
                    >
                      Details
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Set / Edit Leave on Calendar (Higher position only) */}
      {isModalOpen && canSetLeaves && (
        <div className='fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto'>
          <div className='bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full p-6 my-8 animate-in fade-in zoom-in-95 duration-150'>
            <div className='flex items-center justify-between pb-3 border-b border-gray-100'>
              <h3 className='text-lg font-bold text-gray-900'>
                {editingEvent ? 'Edit Calendar Leave' : 'Set Leave / Holiday on Calendar'}
              </h3>
              <button
                type='button'
                onClick={() => setIsModalOpen(false)}
                className='text-gray-400 hover:text-gray-600 text-xl font-bold leading-none'
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className='mt-3 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs'>
                {formError}
              </div>
            )}
            {formSuccess && (
              <div className='mt-3 bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-xs'>
                {formSuccess}
              </div>
            )}

            <form onSubmit={handleSaveLeave} className='mt-4 space-y-4'>
              <div>
                <label className='block text-xs font-bold text-gray-700 mb-1'>
                  Holiday / Leave Title <span className='text-red-500'>*</span>
                </label>
                <input
                  type='text'
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder='e.g., Diwali Holiday, Republic Day, Company Annual Day'
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
                />
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div>
                  <label className='block text-xs font-bold text-gray-700 mb-1'>Leave Category</label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      setFormType(e.target.value)
                      const preset = LEAVE_TYPES.find((t) => t.value === e.target.value)
                      if (preset) setFormColor(preset.color)
                    }}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
                  >
                    {LEAVE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className='block text-xs font-bold text-gray-700 mb-1'>Applicable To</label>
                  <select
                    value={formApplicableTo}
                    onChange={(e) => setFormApplicableTo(e.target.value)}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
                  >
                    <option value='All'>All Employees (Company-wide)</option>
                    <option value='Department'>Specific Department</option>
                  </select>
                </div>
              </div>

              {formApplicableTo === 'Department' && (
                <div>
                  <label className='block text-xs font-bold text-gray-700 mb-1'>Department Name</label>
                  <input
                    type='text'
                    value={formDepartment}
                    onChange={(e) => setFormDepartment(e.target.value)}
                    placeholder='e.g., Engineering, Sales, HR'
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
                  />
                </div>
              )}

              <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                <div>
                  <label className='block text-xs font-bold text-gray-700 mb-1'>
                    Start Date <span className='text-red-500'>*</span>
                  </label>
                  <input
                    type='date'
                    required
                    min={toDateInputString(new Date(currentYear, currentMonth, 1))}
                    value={formStartDate}
                    onChange={(e) => {
                      setFormStartDate(e.target.value)
                      if (formEndDate < e.target.value) {
                        setFormEndDate(e.target.value)
                      }
                    }}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
                  />
                  <span className='text-[10px] text-gray-400'>Current or upcoming month</span>
                </div>

                <div>
                  <label className='block text-xs font-bold text-gray-700 mb-1'>
                    End Date <span className='text-red-500'>*</span>
                  </label>
                  <input
                    type='date'
                    required
                    min={formStartDate || toDateInputString(new Date(currentYear, currentMonth, 1))}
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
                  />
                </div>
              </div>

              <div>
                <label className='block text-xs font-bold text-gray-700 mb-1.5'>Theme Color</label>
                <div className='flex items-center gap-2'>
                  {COLOR_PRESETS.map((p) => (
                    <button
                      key={p.hex}
                      type='button'
                      onClick={() => setFormColor(p.hex)}
                      className={`w-7 h-7 rounded-full ${p.bg} transition-all ${
                        formColor === p.hex ? 'ring-2 ring-offset-2 ring-purple-600 scale-110' : 'opacity-70 hover:opacity-100'
                      }`}
                      title={p.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className='block text-xs font-bold text-gray-700 mb-1'>Description / Note (Optional)</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder='Additional details about this leave or holiday…'
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500'
                />
              </div>

              <div className='pt-3 flex items-center justify-end gap-3 border-t border-gray-100'>
                <button
                  type='button'
                  onClick={() => setIsModalOpen(false)}
                  className='px-4 py-2 text-sm font-semibold text-gray-600 hover:text-gray-800'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={formSubmitting}
                  className='bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-semibold transition-colors'
                >
                  {formSubmitting ? 'Saving…' : editingEvent ? 'Save Changes' : 'Set on Calendar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Event Details */}
      {selectedEventDetails && (
        <div className='fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4'>
          <div className='bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-150'>
            <div className='flex items-start justify-between pb-3 border-b border-gray-100'>
              <div>
                <span
                  className='text-[10px] font-bold px-2 py-0.5 rounded'
                  style={{
                    backgroundColor: `${selectedEventDetails.color || '#8b5cf6'}20`,
                    color: selectedEventDetails.color || '#8b5cf6',
                  }}
                >
                  {selectedEventDetails.displayType || selectedEventDetails.type || 'Leave Event'}
                </span>
                <h3 className='text-lg font-bold text-gray-900 mt-1'>{selectedEventDetails.title}</h3>
              </div>
              <button
                type='button'
                onClick={() => setSelectedEventDetails(null)}
                className='text-gray-400 hover:text-gray-600 text-xl font-bold leading-none'
              >
                ✕
              </button>
            </div>

            <div className='py-4 space-y-3 text-sm'>
              <div>
                <p className='text-xs text-gray-500 font-semibold'>Date Range</p>
                <p className='text-gray-900 font-medium mt-0.5'>
                  {new Date(selectedEventDetails.startDate).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                  {selectedEventDetails.endDate &&
                    new Date(selectedEventDetails.startDate).toDateString() !==
                      new Date(selectedEventDetails.endDate).toDateString() &&
                    ` — ${new Date(selectedEventDetails.endDate).toLocaleDateString('en-IN', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}`}
                </p>
              </div>

              {selectedEventDetails.applicableTo && (
                <div>
                  <p className='text-xs text-gray-500 font-semibold'>Applicable Audience</p>
                  <p className='text-gray-900 font-medium mt-0.5'>
                    {selectedEventDetails.applicableTo === 'All'
                      ? 'Company-wide (All Staff)'
                      : `Department: ${selectedEventDetails.department || selectedEventDetails.applicableTo}`}
                  </p>
                </div>
              )}

              {selectedEventDetails.createdByName && (
                <div>
                  <p className='text-xs text-gray-500 font-semibold'>Set By</p>
                  <p className='text-gray-900 font-medium mt-0.5'>
                    {selectedEventDetails.createdByName} ({selectedEventDetails.createdByRole || 'Higher Management'})
                  </p>
                </div>
              )}

              {selectedEventDetails.description && (
                <div>
                  <p className='text-xs text-gray-500 font-semibold'>Details</p>
                  <p className='text-gray-700 text-xs mt-0.5 whitespace-pre-wrap bg-gray-50 p-2.5 rounded-lg border border-gray-100'>
                    {selectedEventDetails.description}
                  </p>
                </div>
              )}

              {selectedEventDetails.reason && (
                <div>
                  <p className='text-xs text-gray-500 font-semibold'>Leave Reason</p>
                  <p className='text-gray-700 text-xs mt-0.5 italic bg-gray-50 p-2.5 rounded-lg border border-gray-100'>
                    "{selectedEventDetails.reason}"
                  </p>
                </div>
              )}
            </div>

            <div className='pt-3 flex items-center justify-between border-t border-gray-100'>
              <button
                type='button'
                onClick={() => setSelectedEventDetails(null)}
                className='text-xs font-semibold text-gray-600 hover:text-gray-800'
              >
                Close
              </button>

              {canSetLeaves && selectedEventDetails.isHoliday && (
                <div className='flex items-center gap-2'>
                  <button
                    type='button'
                    onClick={() => openEditModal(selectedEventDetails)}
                    className='text-xs font-semibold text-purple-600 hover:text-purple-800 px-3 py-1.5 rounded-lg border border-purple-200 hover:bg-purple-50'
                  >
                    Edit
                  </button>
                  <button
                    type='button'
                    onClick={() => handleDeleteLeave(selectedEventDetails._id)}
                    className='text-xs font-semibold text-red-600 hover:text-red-800 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50'
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CalendarView
