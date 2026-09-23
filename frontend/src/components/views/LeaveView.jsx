import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const LEAVE_TYPES = ['Sick', 'Casual', 'Annual', 'Unpaid', 'Other']
const PAGE_SIZE = 7

const LEAVE_TYPE_LABELS = {
  Sick: 'Sick Leave',
  Casual: 'Casual Leave',
  Annual: 'Earned Leave',
  Unpaid: 'Unpaid Leave',
  Other: 'Other',
}

const leaveTypeStyles = {
  Casual: 'bg-blue-50 text-blue-700 border-blue-200',
  Sick: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Annual: 'bg-violet-50 text-violet-700 border-violet-200',
  Unpaid: 'bg-slate-50 text-slate-700 border-slate-200',
  Other: 'bg-gray-50 text-gray-700 border-gray-200',
}

const statusStyles = {
  Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Pending: 'bg-amber-50 text-amber-700 border-amber-200',
  Rejected: 'bg-red-50 text-red-700 border-red-200',
}

const STAGE_LABELS = {
  team_leader: 'Team Leader / Reporting Manager',
  hr: 'HR Manager',
  admin: 'Admin',
  central_admin: 'Centralized Admin',
  completed: 'Completed',
}

const getUserApprovalRole = (user) => {
  const accessRole = String(user?.designation?.accessRole || '').toLowerCase()
  const title = String(user?.designation?.title || '').toLowerCase()
  if (title === 'team leader' || title.includes('team lead')) return 'team_leader'
  if (title === 'hr manager' || title === 'hr') return 'hr'
  if (title === 'admin') return 'admin'
  if (title.includes('manager')) return 'manager'
  if (accessRole) return accessRole
  return 'employee'
}

const canRoleActAtStage = (role, stage) => {
  if (stage === 'team_leader') return role === 'team_leader' || role === 'manager'
  if (stage === 'hr') return role === 'hr'
  if (stage === 'admin') return role === 'admin'
  return false
}

const startOfDay = (d) => {
  const x = new Date(d)
  if (Number.isNaN(x.getTime())) return NaN
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

const formatLeaveDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', weekday: 'short' })
}

const formatAppliedOn = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const isObjectIdLike = (value) => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value.trim())

const getDesignation = (employee) => {
  const nested = employee?.designation?.title || employee?.designation?.name
  if (nested) return nested
  const raw = employee?.designation
  if (typeof raw === 'string' && raw.trim() && !isObjectIdLike(raw)) return raw.trim()
  return employee?.department || '—'
}

const leaveInDateRange = (leave, from, to) => {
  if (!from && !to) return true
  const leaveStart = startOfDay(leave.startDate)
  const leaveEnd = startOfDay(leave.endDate)
  if (Number.isNaN(leaveStart) || Number.isNaN(leaveEnd)) return false
  const rangeStart = from ? startOfDay(from) : -Infinity
  const rangeEnd = to ? startOfDay(to) : Infinity
  return leaveEnd >= rangeStart && leaveStart <= rangeEnd
}

const csvEscape = (value) => {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const StatCard = ({ title, value, subtitle, icon, iconBg }) => (
  <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5'>
    <div className='flex items-start justify-between gap-3'>
      <div>
        <p className='text-sm text-gray-500'>{title}</p>
        <p className='text-3xl font-bold text-gray-900 mt-1'>{value}</p>
        {subtitle && <p className='text-xs text-gray-400 mt-1'>{subtitle}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 ${iconBg}`}>{icon}</div>
    </div>
  </div>
)

const EmployeeAvatar = ({ employee }) => {
  const [imgError, setImgError] = useState(false)
  const name = employee?.name || '?'
  const photo = employee?.profilePhoto
  const showPhoto = Boolean(photo) && !imgError
  return (
    <div className='w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden border border-gray-200'>
      {showPhoto ? (
        <img src={photo} alt={name} className='w-full h-full object-cover' onError={() => setImgError(true)} />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  )
}

const StatusBadge = ({ status }) => (
  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusStyles[status] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
    {status}
  </span>
)

const LeaveTypeBadge = ({ type }) => (
  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${leaveTypeStyles[type] || leaveTypeStyles.Other}`}>
    {LEAVE_TYPE_LABELS[type] || type || '—'}
  </span>
)

const MoreVerticalIcon = () => (
  <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='currentColor' className='size-4'>
    <path d='M12 7.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Zm0 6a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z' />
  </svg>
)

const buildPageNumbers = (page, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => ({ type: 'page', value: i + 1 }))
  const items = []
  const addPage = (value) => items.push({ type: 'page', value })
  const addEllipsis = (key) => items.push({ type: 'ellipsis', key })
  addPage(1)
  if (page > 3) addEllipsis('start')
  const start = Math.max(2, page - 1)
  const end = Math.min(totalPages - 1, page + 1)
  for (let i = start; i <= end; i += 1) addPage(i)
  if (page < totalPages - 2) addEllipsis('end')
  addPage(totalPages)
  return items
}

const LeaveView = () => {
  const { user, canApproveLeave } = useAuth()
  const isApprover = canApproveLeave()
  const approvalRole = getUserApprovalRole(user)

  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState(isApprover ? 'list' : 'my')

  const [searchQuery, setSearchQuery] = useState('')
  const [filterLeaveType, setFilterLeaveType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date()
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`
  })

  const [page, setPage] = useState(1)
  const [openMenuId, setOpenMenuId] = useState(null)
  const menuRef = useRef(null)

  const [showApplyForm, setShowApplyForm] = useState(false)
  const [applyForm, setApplyForm] = useState({ leaveType: 'Casual', startDate: '', endDate: '', reason: '' })
  const [submitting, setSubmitting] = useState(false)
  const [rejectingId, setRejectingId] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [viewLeave, setViewLeave] = useState(null)

  const fetchLeaves = async () => {
    try {
      setLoading(true)
      const params = {}
      if (!isApprover && user?._id) params.employeeId = user._id
      const res = await api.get('/leave', { params })
      setLeaves(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.message || 'Error fetching leaves')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLeaves()
  }, [isApprover, user?._id])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, filterLeaveType, filterStatus, dateFrom, dateTo, activeTab])

  useEffect(() => {
    const onClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setOpenMenuId(null)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  const tabLeaves = useMemo(() => {
    if (activeTab === 'my' && user?._id) {
      return leaves.filter((l) => String(l.employee?._id || l.employee) === String(user._id))
    }
    if (activeTab === 'list' || activeTab === 'calendar') return leaves
    return leaves
  }, [leaves, activeTab, user?._id])

  const filteredLeaves = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return tabLeaves.filter((leave) => {
      if (filterLeaveType && leave.leaveType !== filterLeaveType) return false
      if (filterStatus && leave.status !== filterStatus) return false
      if (!leaveInDateRange(leave, dateFrom, dateTo)) return false
      if (q) {
        const name = (leave.employee?.name || '').toLowerCase()
        const designation = getDesignation(leave.employee).toLowerCase()
        if (!name.includes(q) && !designation.includes(q)) return false
      }
      return true
    })
  }, [tabLeaves, searchQuery, filterLeaveType, filterStatus, dateFrom, dateTo])

  const stats = useMemo(() => {
    const total = tabLeaves.length
    const approved = tabLeaves.filter((l) => l.status === 'Approved').length
    const pending = tabLeaves.filter((l) => l.status === 'Pending').length
    const rejected = tabLeaves.filter((l) => l.status === 'Rejected').length
    const pct = (n) => (total ? `${((n / total) * 100).toFixed(2)}%` : '0%')
    return { total, approved, pending, rejected, approvedPct: pct(approved), pendingPct: pct(pending), rejectedPct: pct(rejected) }
  }, [tabLeaves])

  const totalPages = Math.max(1, Math.ceil(filteredLeaves.length / PAGE_SIZE))
  const paginatedLeaves = filteredLeaves.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const pageNumbers = buildPageNumbers(page, totalPages)

  const handleApplySubmit = async (e) => {
    e.preventDefault()
    if (!applyForm.startDate || !applyForm.endDate) {
      setError('Start date and end date are required')
      return
    }
    if (new Date(applyForm.endDate) < new Date(applyForm.startDate)) {
      setError('End date must be on or after start date')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await api.post('/leave', {
        employee: user._id,
        leaveType: applyForm.leaveType,
        startDate: applyForm.startDate,
        endDate: applyForm.endDate,
        reason: applyForm.reason || '',
      })
      setShowApplyForm(false)
      setApplyForm({ leaveType: 'Casual', startDate: '', endDate: '', reason: '' })
      fetchLeaves()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error submitting leave')
    } finally {
      setSubmitting(false)
    }
  }

  const handleForward = async (id) => {
    try {
      await api.patch(`/leave/${id}/status`, { action: 'Forward', actorId: user._id })
      setOpenMenuId(null)
      fetchLeaves()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error forwarding leave')
    }
  }

  const handleReject = async (id) => {
    if (rejectingId !== id) {
      setRejectingId(id)
      setRejectReason('')
      setOpenMenuId(null)
      return
    }
    try {
      await api.patch(`/leave/${id}/status`, {
        action: 'Reject',
        actorId: user._id,
        comment: rejectReason || '',
      })
      setRejectingId(null)
      setRejectReason('')
      fetchLeaves()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error rejecting leave')
    }
  }

  const exportLeaves = () => {
    const headers = ['Employee', 'Designation', 'Leave Type', 'From Date', 'To Date', 'Days', 'Reason', 'Status', 'Applied On']
    const lines = filteredLeaves.map((leave) => [
      leave.employee?.name || '',
      getDesignation(leave.employee),
      LEAVE_TYPE_LABELS[leave.leaveType] || leave.leaveType,
      formatLeaveDate(leave.startDate),
      formatLeaveDate(leave.endDate),
      leave.numberOfDays ?? '',
      leave.reason || '',
      leave.status || '',
      formatAppliedOn(leave.createdAt),
    ].map(csvEscape).join(','))
    const csv = `${headers.map(csvEscape).join(',')}\n${lines.join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `leave-report-${dateFrom}-to-${dateTo}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const tabs = isApprover
    ? [
        { id: 'list', label: 'Leave List' },
        { id: 'my', label: 'My Leave' },
        { id: 'calendar', label: 'Leave Calendar' },
        { id: 'settings', label: 'Leave Settings' },
      ]
    : [
        { id: 'my', label: 'My Leave' },
        { id: 'calendar', label: 'Leave Calendar' },
      ]

  const calendarMonth = useMemo(() => {
    const d = dateFrom ? new Date(`${dateFrom}T12:00:00`) : new Date()
    const y = d.getFullYear()
    const m = d.getMonth()
    const firstDay = new Date(y, m, 1)
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const startPad = firstDay.getDay()
    const cells = []
    for (let i = 0; i < startPad; i += 1) cells.push(null)
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day)
    return { y, m, cells, label: firstDay.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) }
  }, [dateFrom])

  const leavesOnDay = (day) => {
    if (!day) return []
    const key = `${calendarMonth.y}-${String(calendarMonth.m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const ts = startOfDay(`${key}T12:00:00`)
    return filteredLeaves.filter((l) => {
      const s = startOfDay(l.startDate)
      const e = startOfDay(l.endDate)
      return ts >= s && ts <= e
    })
  }

  return (
    <div className='min-h-full bg-[#f4f6f8]'>
      <div className='px-6 md:px-8 py-6 border-b border-gray-200 bg-white'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>Leave</h1>
            <p className='text-sm text-gray-500 mt-1'>
              {isApprover ? 'Manage team leave requests and approvals.' : 'Apply for leave and track your applications.'}
            </p>
          </div>
          <button
            type='button'
            onClick={() => setShowApplyForm(true)}
            className='inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 shadow-sm'
          >
            <span className='text-lg leading-none'>+</span>
            Apply Leave
          </button>
        </div>

        <div className='flex flex-wrap items-center gap-6 mt-6 border-b border-gray-100 -mb-px'>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type='button'
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className='p-6 md:px-8 md:py-6 space-y-6'>
        {error && (
          <div className='rounded-lg bg-red-50 border border-red-100 px-4 py-3'>
            <p className='text-red-600 text-sm'>{error}</p>
          </div>
        )}

        {(activeTab === 'list' || activeTab === 'my') && (
          <>
            <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'>
              <StatCard title='Total Leaves' value={stats.total} subtitle='All time' icon='📅' iconBg='bg-blue-50 text-blue-600' />
              <StatCard title='Approved' value={stats.approved} subtitle={stats.approvedPct} icon='✓' iconBg='bg-emerald-50 text-emerald-600' />
              <StatCard title='Pending' value={stats.pending} subtitle={stats.pendingPct} icon='⏰' iconBg='bg-amber-50 text-amber-600' />
              <StatCard title='Rejected' value={stats.rejected} subtitle={stats.rejectedPct} icon='✕' iconBg='bg-red-50 text-red-600' />
            </div>

            <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-4'>
              <div className='flex flex-wrap items-end gap-3'>
                <div className='flex-1 min-w-[200px]'>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>Search by employee name</label>
                  <input
                    type='search'
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder='Search employees…'
                    className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
                <div className='min-w-[140px]'>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>Leave Type</label>
                  <select
                    value={filterLeaveType}
                    onChange={(e) => setFilterLeaveType(e.target.value)}
                    className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>All</option>
                    {LEAVE_TYPES.map((t) => (
                      <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div className='min-w-[120px]'>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    <option value=''>All</option>
                    <option value='Pending'>Pending</option>
                    <option value='Approved'>Approved</option>
                    <option value='Rejected'>Rejected</option>
                  </select>
                </div>
                <div className='min-w-[130px]'>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>From</label>
                  <input
                    type='date'
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
                <div className='min-w-[130px]'>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>To</label>
                  <input
                    type='date'
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className='w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
                <button
                  type='button'
                  onClick={() => setPage(1)}
                  className='inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50'
                >
                  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='size-4'>
                    <path strokeLinecap='round' strokeLinejoin='round' d='M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.036a2.5 2.5 0 0 1-.659 1.591l-5.432 6.198a2.5 2.5 0 0 0-.659 1.591v2.927a.75.75 0 0 1-1.28.53l-3.18-3.18a.75.75 0 0 1-.22-.53v-2.717a2.5 2.5 0 0 0-.659-1.591L3.659 7.409A2.5 2.5 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z' />
                  </svg>
                  Filter
                </button>
                <button
                  type='button'
                  onClick={exportLeaves}
                  className='inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50'
                >
                  <span>↓</span>
                  Export
                </button>
              </div>
            </div>

            <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
              {loading ? (
                <p className='p-8 text-sm text-gray-500 text-center'>Loading leave applications…</p>
              ) : (
                <>
                  <div className='overflow-x-auto'>
                    <table className='w-full text-sm'>
                      <thead>
                        <tr className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100'>
                          {isApprover && activeTab === 'list' && <th className='px-5 py-3'>Employee</th>}
                          <th className='px-5 py-3'>Leave Type</th>
                          <th className='px-5 py-3'>From Date</th>
                          <th className='px-5 py-3'>To Date</th>
                          <th className='px-5 py-3'>Days</th>
                          <th className='px-5 py-3'>Reason</th>
                          <th className='px-5 py-3'>Status</th>
                          <th className='px-5 py-3'>Approval Stage</th>
                          <th className='px-5 py-3'>Applied On</th>
                          <th className='px-5 py-3 w-12'>Actions</th>
                        </tr>
                      </thead>
                      <tbody className='divide-y divide-gray-100'>
                        {paginatedLeaves.length === 0 ? (
                          <tr>
                            <td colSpan={isApprover && activeTab === 'list' ? 10 : 9} className='px-5 py-14 text-center text-gray-500'>
                              No leave applications found.
                            </td>
                          </tr>
                        ) : (
                          paginatedLeaves.map((leave) => (
                            <tr key={leave._id} className='hover:bg-gray-50/80'>
                              {isApprover && activeTab === 'list' && (
                                <td className='px-5 py-3'>
                                  <div className='flex items-center gap-3'>
                                    <EmployeeAvatar employee={leave.employee} />
                                    <div>
                                      <p className='font-medium text-gray-900'>{leave.employee?.name || '—'}</p>
                                      <p className='text-xs text-gray-400'>{getDesignation(leave.employee)}</p>
                                    </div>
                                  </div>
                                </td>
                              )}
                              <td className='px-5 py-3'><LeaveTypeBadge type={leave.leaveType} /></td>
                              <td className='px-5 py-3 whitespace-nowrap text-gray-700'>{formatLeaveDate(leave.startDate)}</td>
                              <td className='px-5 py-3 whitespace-nowrap text-gray-700'>{formatLeaveDate(leave.endDate)}</td>
                              <td className='px-5 py-3 font-medium text-gray-900'>{leave.numberOfDays ?? '—'}</td>
                              <td className='px-5 py-3 max-w-[180px] truncate text-gray-600' title={leave.reason || undefined}>
                                {leave.reason || '—'}
                              </td>
                              <td className='px-5 py-3'><StatusBadge status={leave.status} /></td>
                              <td className='px-5 py-3 whitespace-nowrap text-xs text-gray-600'>
                                {leave.status === 'Pending'
                                  ? STAGE_LABELS[leave.approvalStage || 'team_leader']
                                  : STAGE_LABELS.completed}
                              </td>
                              <td className='px-5 py-3 whitespace-nowrap text-gray-600 text-xs'>
                                {formatAppliedOn(leave.createdAt)}
                              </td>
                              <td className='px-5 py-3 relative'>
                                <button
                                  type='button'
                                  onClick={() => setOpenMenuId(openMenuId === leave._id ? null : leave._id)}
                                  className='p-1.5 rounded-lg hover:bg-gray-100 text-gray-500'
                                  aria-label='Actions'
                                >
                                  <MoreVerticalIcon />
                                </button>
                                {openMenuId === leave._id && (
                                  <div
                                    ref={menuRef}
                                    className='absolute right-5 top-10 z-20 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-sm'
                                  >
                                    <button
                                      type='button'
                                      onClick={() => { setViewLeave(leave); setOpenMenuId(null) }}
                                      className='w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700'
                                    >
                                      View Details
                                    </button>
                                    {isApprover &&
                                      leave.status === 'Pending' &&
                                      canRoleActAtStage(approvalRole, leave.approvalStage || 'team_leader') &&
                                      String(leave.employee?._id || leave.employee) !== String(user?._id) && (
                                      <>
                                        <button
                                          type='button'
                                          onClick={() => handleForward(leave._id)}
                                          className='w-full text-left px-3 py-2 hover:bg-emerald-50 text-emerald-700'
                                        >
                                          Forward
                                        </button>
                                        <button
                                          type='button'
                                          onClick={() => handleReject(leave._id)}
                                          className='w-full text-left px-3 py-2 hover:bg-red-50 text-red-700'
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className='px-5 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500'>
                    <span>
                      Showing {filteredLeaves.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filteredLeaves.length)} of {filteredLeaves.length} entries
                    </span>
                    <div className='flex items-center gap-1'>
                      <button
                        type='button'
                        disabled={page <= 1}
                        onClick={() => setPage((p) => p - 1)}
                        className='px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50'
                      >
                        Previous
                      </button>
                      {pageNumbers.map((item) =>
                        item.type === 'ellipsis' ? (
                          <span key={item.key} className='px-2 text-gray-400'>…</span>
                        ) : (
                          <button
                            key={item.value}
                            type='button'
                            onClick={() => setPage(item.value)}
                            className={`min-w-[2rem] px-2 py-1 rounded border text-sm ${
                              page === item.value
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            {item.value}
                          </button>
                        )
                      )}
                      <button
                        type='button'
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        className='px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50'
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {activeTab === 'calendar' && (
          <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5'>
            <h2 className='font-semibold text-gray-900 mb-4'>{calendarMonth.label}</h2>
            <div className='grid grid-cols-7 gap-1 text-center text-xs font-semibold text-gray-500 mb-2'>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className='py-2'>{d}</div>
              ))}
            </div>
            <div className='grid grid-cols-7 gap-1'>
              {calendarMonth.cells.map((day, idx) => {
                const dayLeaves = day ? leavesOnDay(day) : []
                return (
                  <div
                    key={idx}
                    className={`min-h-[72px] rounded-lg border p-1.5 text-left ${
                      day ? 'border-gray-100 bg-gray-50/50' : 'border-transparent'
                    }`}
                  >
                    {day && <span className='text-xs font-medium text-gray-700'>{day}</span>}
                    <div className='mt-1 space-y-0.5'>
                      {dayLeaves.slice(0, 2).map((l) => (
                        <div
                          key={l._id}
                          className={`text-[10px] truncate px-1 py-0.5 rounded ${
                            l.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' :
                            l.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                            'bg-red-100 text-red-800'
                          }`}
                          title={`${l.employee?.name || 'You'} · ${LEAVE_TYPE_LABELS[l.leaveType] || l.leaveType}`}
                        >
                          {l.employee?.name?.split(' ')[0] || 'Leave'}
                        </div>
                      ))}
                      {dayLeaves.length > 2 && (
                        <p className='text-[10px] text-gray-400'>+{dayLeaves.length - 2} more</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {activeTab === 'settings' && isApprover && (
          <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl'>
            <h2 className='font-semibold text-gray-900 mb-2'>Leave Settings</h2>
            <p className='text-sm text-gray-500 mb-6'>Configure leave types and policies for your organization.</p>
            <div className='space-y-3'>
              {LEAVE_TYPES.map((type) => (
                <div key={type} className='flex items-center justify-between p-3 rounded-lg border border-gray-100 bg-gray-50'>
                  <div className='flex items-center gap-3'>
                    <LeaveTypeBadge type={type} />
                    <span className='text-sm text-gray-600'>Enabled</span>
                  </div>
                  <span className='text-xs text-gray-400'>Default policy</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {rejectingId && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50'>
          <div className='bg-white rounded-xl shadow-xl max-w-md w-full p-5'>
            <h2 className='text-lg font-semibold text-gray-900 mb-3'>Reject Leave</h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder='Rejection reason (optional)'
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
            <div className='flex gap-2 mt-4'>
              <button
                type='button'
                onClick={() => handleReject(rejectingId)}
                className='flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700'
              >
                Confirm Reject
              </button>
              <button
                type='button'
                onClick={() => { setRejectingId(null); setRejectReason('') }}
                className='flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50'
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {viewLeave && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50' role='dialog' aria-modal='true'>
          <div className='bg-white rounded-xl shadow-xl max-w-lg w-full p-5 max-h-[90vh] overflow-y-auto'>
            <h2 className='text-lg font-semibold text-gray-900 mb-4'>Leave Details</h2>
            <div className='space-y-3 text-sm'>
              {isApprover && (
                <div>
                  <span className='font-medium text-gray-500 block'>Employee</span>
                  <p className='text-gray-900'>{viewLeave.employee?.name || '—'}</p>
                </div>
              )}
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <span className='font-medium text-gray-500 block'>Type</span>
                  <LeaveTypeBadge type={viewLeave.leaveType} />
                </div>
                <div>
                  <span className='font-medium text-gray-500 block'>Status</span>
                  <StatusBadge status={viewLeave.status} />
                </div>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <span className='font-medium text-gray-500 block'>From Date</span>
                  <p className='text-gray-900'>{formatLeaveDate(viewLeave.startDate)}</p>
                </div>
                <div>
                  <span className='font-medium text-gray-500 block'>To Date</span>
                  <p className='text-gray-900'>{formatLeaveDate(viewLeave.endDate)}</p>
                </div>
              </div>
              <div>
                <span className='font-medium text-gray-500 block'>Days</span>
                <p className='text-gray-900'>{viewLeave.numberOfDays ?? '—'}</p>
              </div>
              <div>
                <span className='font-medium text-gray-500 block'>Reason</span>
                <p className='text-gray-900 mt-1 whitespace-pre-wrap break-words bg-gray-50 rounded-lg p-3'>{viewLeave.reason || '—'}</p>
              </div>
              <div>
                <span className='font-medium text-gray-500 block'>Applied On</span>
                <p className='text-gray-900'>{formatAppliedOn(viewLeave.createdAt)}</p>
              </div>
              <div>
                <span className='font-medium text-gray-500 block'>Current Approval Stage</span>
                <p className='text-gray-900'>
                  {viewLeave.status === 'Pending'
                    ? STAGE_LABELS[viewLeave.approvalStage || 'team_leader']
                    : STAGE_LABELS.completed}
                </p>
              </div>
              {viewLeave.approvalHistory?.length > 0 && (
                <div>
                  <span className='font-medium text-gray-500 block mb-2'>Approval History</span>
                  <div className='space-y-2'>
                    {viewLeave.approvalHistory.map((entry, index) => (
                      <div key={entry._id || index} className='rounded-lg border border-gray-200 p-3'>
                        <div className='flex items-center justify-between gap-2'>
                          <p className='font-medium text-gray-900'>{entry.action}</p>
                          <p className='text-xs text-gray-400'>{formatAppliedOn(entry.actedAt)}</p>
                        </div>
                        <p className='text-xs text-gray-500 mt-0.5'>
                          {STAGE_LABELS[entry.stage] || entry.stage} · {entry.actorName || entry.actor?.name || 'System'}
                        </p>
                        {entry.comment && <p className='text-xs text-gray-700 mt-1'>{entry.comment}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type='button'
              onClick={() => setViewLeave(null)}
              className='w-full mt-5 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50'
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showApplyForm && (
        <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50' role='dialog' aria-modal='true'>
          <div className='bg-white rounded-xl shadow-xl max-w-md w-full p-5'>
            <h2 className='text-lg font-semibold text-gray-900 mb-4'>Apply for Leave</h2>
            <form onSubmit={handleApplySubmit} className='space-y-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Leave Type</label>
                <select
                  value={applyForm.leaveType}
                  onChange={(e) => setApplyForm((f) => ({ ...f, leaveType: e.target.value }))}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                >
                  {LEAVE_TYPES.map((t) => (
                    <option key={t} value={t}>{LEAVE_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className='grid grid-cols-2 gap-3'>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>From Date</label>
                  <input
                    type='date'
                    value={applyForm.startDate}
                    onChange={(e) => setApplyForm((f) => ({ ...f, startDate: e.target.value }))}
                    required
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>To Date</label>
                  <input
                    type='date'
                    value={applyForm.endDate}
                    onChange={(e) => setApplyForm((f) => ({ ...f, endDate: e.target.value }))}
                    required
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  />
                </div>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Reason</label>
                <textarea
                  value={applyForm.reason}
                  onChange={(e) => setApplyForm((f) => ({ ...f, reason: e.target.value }))}
                  rows={3}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='Brief reason for leave'
                />
              </div>
              <div className='flex gap-2 pt-2'>
                <button
                  type='submit'
                  disabled={submitting}
                  className='flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50'
                >
                  {submitting ? 'Submitting…' : 'Submit Application'}
                </button>
                <button
                  type='button'
                  onClick={() => { setShowApplyForm(false); setError(null) }}
                  className='flex-1 border border-gray-300 py-2 rounded-lg text-sm font-medium hover:bg-gray-50'
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default LeaveView
