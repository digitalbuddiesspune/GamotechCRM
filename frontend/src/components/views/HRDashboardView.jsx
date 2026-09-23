import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DEPT_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#6366f1', '#ec4899']

const KpiCard = ({ title, value, subtitle, icon, color, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    className={`text-left bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md transition-shadow w-full ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className='flex items-start justify-between gap-3'>
      <div>
        <p className='text-sm text-gray-500 font-medium'>{title}</p>
        <p className='text-3xl font-bold text-gray-900 mt-1'>{value}</p>
        {subtitle && <p className='text-xs text-gray-500 mt-1'>{subtitle}</p>}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl ${color}`}>{icon}</div>
    </div>
  </button>
)

const Panel = ({ title, actionLabel, onAction, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
    <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100'>
      <h3 className='text-sm font-semibold text-gray-900'>{title}</h3>
      {actionLabel && (
        <button type='button' onClick={onAction} className='text-xs font-medium text-blue-600 hover:text-blue-700'>
          {actionLabel}
        </button>
      )}
    </div>
    <div className='p-5'>{children}</div>
  </div>
)

const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const daysUntil = (date) => {
  if (!date) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24))
  if (diff === 0) return 'Today'
  if (diff === 1) return 'In 1 day'
  if (diff > 1) return `In ${diff} days`
  return `${Math.abs(diff)} days ago`
}

const HRDashboardView = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState([])
  const [leaves, setLeaves] = useState([])
  const [todayAttendance, setTodayAttendance] = useState([])

  const now = new Date()
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [empRes, leaveRes, attRes] = await Promise.all([
          api.get('/employees'),
          api.get('/leave').catch(() => ({ data: [] })),
          api.get('/attendance/today').catch(() => ({ data: [] })),
        ])
        setEmployees(Array.isArray(empRes.data) ? empRes.data : empRes.data?.data || [])
        setLeaves(Array.isArray(leaveRes.data) ? leaveRes.data : [])
        setTodayAttendance(Array.isArray(attRes.data) ? attRes.data : [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const activeEmployees = employees.filter((e) => (e.employmentStatus || e.status || 'Active') === 'Active')
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()
    const newJoinees = employees.filter((e) => {
      const d = new Date(e.dateOfJoining || e.createdAt)
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear
    })
    const departments = [...new Set(employees.map((e) => e.department).filter(Boolean))]

    const presentToday = todayAttendance.filter((a) => ['Full Day', 'Half Day', 'In Progress'].includes(a.status)).length
    const onLeaveToday = leaves.filter((l) => {
      if (l.status !== 'Approved') return false
      const start = new Date(l.startDate)
      const end = new Date(l.endDate)
      const today = new Date()
      today.setHours(12, 0, 0, 0)
      return today >= start && today <= end
    }).length
    const absentToday = Math.max(0, activeEmployees.length - presentToday - onLeaveToday)

    const deptMap = {}
    employees.forEach((e) => {
      const dept = e.department || 'Unassigned'
      deptMap[dept] = (deptMap[dept] || 0) + 1
    })
    const deptChart = Object.entries(deptMap).map(([name, value]) => ({ name, value }))

    const monthlyTrend = MONTH_NAMES.map((month, idx) => ({
      month,
      employees: employees.filter((e) => {
        const d = new Date(e.dateOfJoining || e.createdAt)
        return d.getMonth() === idx && d.getFullYear() === thisYear
      }).length,
    }))

    const recentJoinees = [...employees]
      .sort((a, b) => new Date(b.dateOfJoining || b.createdAt) - new Date(a.dateOfJoining || a.createdAt))
      .slice(0, 5)

    const upcomingBirthdays = employees
      .filter((e) => e.dateOfBirth)
      .map((e) => {
        const dob = new Date(e.dateOfBirth)
        const next = new Date(thisYear, dob.getMonth(), dob.getDate())
        if (next < now) next.setFullYear(thisYear + 1)
        return { ...e, nextBirthday: next }
      })
      .sort((a, b) => a.nextBirthday - b.nextBirthday)
      .slice(0, 5)

    const leaveStats = {
      total: leaves.length,
      approved: leaves.filter((l) => l.status === 'Approved').length,
      pending: leaves.filter((l) => l.status === 'Pending').length,
      rejected: leaves.filter((l) => l.status === 'Rejected').length,
    }

    const docRequests = employees.flatMap((e) =>
      (e.notes?.documentUploadHistory || []).map((d) => ({
        employee: e.name,
        document: d.document,
        date: d.date,
        id: `${e._id}-${d.document}`,
      }))
    ).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)

    const presentPct = activeEmployees.length
      ? ((presentToday / activeEmployees.length) * 100).toFixed(1)
      : '0.0'

    return {
      activeEmployees,
      newJoinees,
      departments,
      presentToday,
      onLeaveToday,
      absentToday,
      deptChart,
      monthlyTrend,
      recentJoinees,
      upcomingBirthdays,
      leaveStats,
      docRequests,
      presentPct,
      exits: employees.filter((e) => ['Resigned', 'Terminated', 'Inactive'].includes(e.employmentStatus || e.status)).length,
    }
  }, [employees, leaves, todayAttendance, now])

  const attendancePie = [
    { name: 'Present', value: stats.presentToday, color: '#10b981' },
    { name: 'Absent', value: stats.absentToday, color: '#ef4444' },
    { name: 'On Leave', value: stats.onLeaveToday, color: '#f59e0b' },
  ].filter((d) => d.value > 0)

  const quickActions = [
    { label: 'Add Employee', icon: '👤', path: '/add-employee', color: 'bg-blue-50 text-blue-700' },
    { label: 'Mark Attendance', icon: '📅', path: '/attendance', color: 'bg-green-50 text-green-700' },
    { label: 'Apply Leave', icon: '🏖️', path: '/leave', color: 'bg-orange-50 text-orange-700' },
    { label: 'View Payroll', icon: '💰', path: '/salaries', color: 'bg-purple-50 text-purple-700' },
    { label: 'Employees', icon: '👥', path: '/employees', color: 'bg-cyan-50 text-cyan-700' },
    { label: 'Reports', icon: '📊', path: '/reports', color: 'bg-pink-50 text-pink-700' },
  ]

  if (loading) {
    return <div className='p-8 text-sm text-gray-600'>Loading HR dashboard...</div>
  }

  return (
    <div className='p-6 md:p-8 w-full bg-gray-50 min-h-full'>
      <div className='flex flex-wrap items-start justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Dashboard</h1>
          <p className='text-gray-600 mt-1 text-sm'>
            Welcome back, {user?.name || 'Admin'}! Here&apos;s what&apos;s happening in your organization.
          </p>
        </div>
        <div className='text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-4 py-2'>
          {formatDate(now)} · {monthKey}
        </div>
      </div>

      {/* KPI Row */}
      <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6'>
        <KpiCard title='Total Employees' value={stats.activeEmployees.length} subtitle={`${employees.length} total records`} icon='👥' color='bg-blue-50' onClick={() => navigate('/employees')} />
        <KpiCard title='New Joinees' value={stats.newJoinees.length} subtitle='This month' icon='✨' color='bg-green-50' onClick={() => navigate('/employees')} />
        <KpiCard title='Present Today' value={stats.presentToday} subtitle={`${stats.presentPct}% of active`} icon='✅' color='bg-emerald-50' onClick={() => navigate('/attendance')} />
        <KpiCard title='On Leave Today' value={stats.onLeaveToday} subtitle={`${stats.absentToday} absent`} icon='🏖️' color='bg-orange-50' onClick={() => navigate('/leave')} />
        <KpiCard title='Departments' value={stats.departments.length} subtitle='Active departments' icon='🏢' color='bg-purple-50' onClick={() => navigate('/employees')} />
      </div>

      {/* Charts Row */}
      <div className='grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6'>
        <Panel title='Employee Overview' className='xl:col-span-1'>
          <p className='text-xs text-gray-500 mb-3'>New joinees per month ({now.getFullYear()})</p>
          <div className='h-52'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={stats.monthlyTrend}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                <XAxis dataKey='month' tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type='monotone' dataKey='employees' name='Joinees' stroke='#3b82f6' strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className='grid grid-cols-2 gap-3 mt-4 text-center'>
            <div className='bg-gray-50 rounded-lg p-2'><p className='text-xs text-gray-500'>Total</p><p className='font-bold'>{employees.length}</p></div>
            <div className='bg-gray-50 rounded-lg p-2'><p className='text-xs text-gray-500'>New</p><p className='font-bold text-green-600'>+{stats.newJoinees.length}</p></div>
            <div className='bg-gray-50 rounded-lg p-2'><p className='text-xs text-gray-500'>Exits</p><p className='font-bold text-red-600'>{stats.exits}</p></div>
            <div className='bg-gray-50 rounded-lg p-2'><p className='text-xs text-gray-500'>Retention</p><p className='font-bold'>{employees.length ? Math.round((stats.activeEmployees.length / employees.length) * 100) : 0}%</p></div>
          </div>
        </Panel>

        <Panel title='Employees by Department'>
          <div className='h-52'>
            {stats.deptChart.length ? (
              <ResponsiveContainer width='100%' height='100%'>
                <PieChart>
                  <Pie data={stats.deptChart} dataKey='value' nameKey='name' cx='50%' cy='50%' innerRadius={45} outerRadius={70} paddingAngle={2}>
                    {stats.deptChart.map((_, i) => <Cell key={i} fill={DEPT_COLORS[i % DEPT_COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className='text-sm text-gray-500 text-center py-16'>No department data</p>
            )}
          </div>
          <p className='text-center text-sm text-gray-600 mt-2'>{employees.length} employees across {stats.departments.length} departments</p>
        </Panel>

        <Panel title='Attendance Summary'>
          <div className='flex items-center gap-4'>
            <div className='h-40 w-40 shrink-0'>
              {attendancePie.length ? (
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie data={attendancePie} dataKey='value' cx='50%' cy='50%' innerRadius={35} outerRadius={55}>
                      {attendancePie.map((d) => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className='h-full flex items-center justify-center text-gray-400 text-sm'>No data</div>
              )}
            </div>
            <div className='flex-1 space-y-2'>
              <p className='text-2xl font-bold text-gray-900'>{stats.presentPct}%</p>
              <p className='text-xs text-gray-500 mb-3'>Present today</p>
              {attendancePie.map((d) => (
                <div key={d.name} className='flex items-center justify-between text-sm'>
                  <span className='flex items-center gap-2'><span className='w-2 h-2 rounded-full' style={{ background: d.color }} />{d.name}</span>
                  <span className='font-semibold'>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {/* Lists Row */}
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6'>
        <Panel title='Leave Summary' actionLabel='View Leave Calendar' onAction={() => navigate('/leave')}>
          <div className='space-y-3'>
            {[
              ['Total Leaves', stats.leaveStats.total, 'text-gray-900'],
              ['Approved', stats.leaveStats.approved, 'text-green-600'],
              ['Pending', stats.leaveStats.pending, 'text-orange-600'],
              ['Rejected', stats.leaveStats.rejected, 'text-red-600'],
            ].map(([label, count, color]) => (
              <div key={label} className='flex items-center justify-between py-2 border-b border-gray-50 last:border-0'>
                <span className='text-sm text-gray-600'>{label}</span>
                <span className={`text-lg font-bold ${color}`}>{count}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title='Recent Joinees' actionLabel='View All' onAction={() => navigate('/employees')}>
          <div className='space-y-3'>
            {stats.recentJoinees.length ? stats.recentJoinees.map((e) => (
              <button key={e._id} type='button' onClick={() => navigate(`/employees/${e._id}/profile`)} className='w-full flex items-center gap-3 text-left hover:bg-gray-50 rounded-lg p-2 -mx-2'>
                <div className='w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold shrink-0 overflow-hidden'>
                  {e.profilePhoto ? <img src={e.profilePhoto} alt='' className='w-full h-full object-cover' /> : (e.name || '?').charAt(0)}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-semibold text-gray-900 truncate'>{e.name}</p>
                  <p className='text-xs text-gray-500 truncate'>{e.designation?.title || e.department}</p>
                </div>
                <span className='text-xs text-gray-400 shrink-0'>{formatDate(e.dateOfJoining)}</span>
              </button>
            )) : <p className='text-sm text-gray-500'>No employees yet</p>}
          </div>
        </Panel>

        <Panel title='Upcoming Birthdays'>
          <div className='space-y-3'>
            {stats.upcomingBirthdays.length ? stats.upcomingBirthdays.map((e) => (
              <div key={e._id} className='flex items-center gap-3'>
                <div className='w-10 h-10 rounded-full bg-pink-100 text-pink-700 flex items-center justify-center font-bold shrink-0'>
                  {(e.name || '?').charAt(0)}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-semibold text-gray-900 truncate'>{e.name}</p>
                  <p className='text-xs text-gray-500'>{formatDate(e.dateOfBirth)}</p>
                </div>
                <span className='text-xs font-medium text-pink-600 shrink-0'>{daysUntil(e.nextBirthday)}</span>
              </div>
            )) : <p className='text-sm text-gray-500'>No birthdays on file</p>}
          </div>
        </Panel>
      </div>

      {/* Bottom Row */}
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
        <Panel title='Quick Actions'>
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
            {quickActions.map((action) => (
              <button
                key={action.label}
                type='button'
                onClick={() => navigate(action.path)}
                className={`flex flex-col items-center gap-2 p-4 rounded-xl border border-gray-100 hover:shadow-sm transition-shadow ${action.color}`}
              >
                <span className='text-2xl'>{action.icon}</span>
                <span className='text-xs font-semibold text-center'>{action.label}</span>
              </button>
            ))}
          </div>
        </Panel>

        <Panel title='Document Upload History' actionLabel='View Employees' onAction={() => navigate('/employees')}>
          {stats.docRequests.length ? (
            <div className='space-y-3'>
              {stats.docRequests.map((d) => (
                <div key={d.id} className='flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0'>
                  <div className='min-w-0'>
                    <p className='text-sm font-medium text-gray-900 truncate'>{d.document}</p>
                    <p className='text-xs text-gray-500'>{d.employee}</p>
                  </div>
                  <span className='text-xs text-gray-400 shrink-0'>{formatDate(d.date)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-sm text-gray-500'>No document uploads recorded yet. Uploads appear when employee profiles are updated.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}

export default HRDashboardView
