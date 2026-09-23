import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const TASK_COLORS = {
  Completed: '#10b981',
  'In Progress': '#3b82f6',
  'To Do': '#f59e0b',
  Overdue: '#ef4444',
}

const PROGRESS_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ec4899']

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?'

const isToday = (d) => {
  if (!d) return false
  return new Date(d).toDateString() === new Date().toDateString()
}

const isThisWeek = (d) => {
  if (!d) return false
  const dt = new Date(d)
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)
  return dt >= weekStart && dt < weekEnd
}

const relativeTime = (d) => {
  if (!d) return ''
  const diffMs = Date.now() - new Date(d).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

const dueLabel = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (dt.toDateString() === today.toDateString()) return 'Today'
  if (dt.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const timeLabel = (d) =>
  new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })

const PRIORITY_STYLES = {
  Urgent: 'bg-red-100 text-red-700',
  High: 'bg-red-50 text-red-600',
  Medium: 'bg-amber-50 text-amber-700',
  Low: 'bg-emerald-50 text-emerald-700',
}

const StatCard = ({ icon, iconBg, label, value, sub, subClass, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    className='text-left bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow w-full'
  >
    <div className='flex items-center gap-2 mb-2'>
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-base ${iconBg}`}>{icon}</div>
      <p className='text-xs text-gray-500 font-medium'>{label}</p>
    </div>
    <p className='text-2xl font-bold text-gray-900'>{value}</p>
    {sub && <p className={`text-[11px] font-medium mt-1 ${subClass || 'text-gray-500'}`}>{sub}</p>}
  </button>
)

const Panel = ({ title, action, onAction, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col ${className}`}>
    <div className='flex items-center justify-between px-5 py-3.5 border-b border-gray-50'>
      <h3 className='text-sm font-semibold text-gray-900'>{title}</h3>
      {action && (
        <button type='button' onClick={onAction} className='text-xs font-medium text-blue-600 hover:text-blue-700'>
          {action}
        </button>
      )}
    </div>
    <div className='p-5 flex-1'>{children}</div>
  </div>
)

const TeamLeaderDashboardView = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState([])
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [attendance, setAttendance] = useState([])
  const [leaves, setLeaves] = useState([])
  const [leads, setLeads] = useState([])

  useEffect(() => {
    if (!user?._id) return
    const load = async () => {
      try {
        setLoading(true)
        const [empRes, taskRes, projRes, attRes, leaveRes, leadRes] = await Promise.all([
          api.get('/employees').catch(() => ({ data: [] })),
          api.get('/tasks').catch(() => ({ data: [] })),
          api.get('/projects').catch(() => ({ data: [] })),
          api.get('/attendance/today').catch(() => ({ data: [] })),
          api.get('/leave').catch(() => ({ data: [] })),
          api.get('/leads').catch(() => ({ data: [] })),
        ])
        const list = (res) => (Array.isArray(res.data) ? res.data : res.data?.data || [])

        // Scope everything to the leader's team: employees whose reportingManager is this user.
        const allEmployees = list(empRes)
        const leaderId = String(user._id)
        const teamIds = new Set(
          allEmployees
            .filter((e) => String(e.reportingManager?._id || e.reportingManager || '') === leaderId)
            .map((e) => String(e._id))
        )
        const refId = (v) => String(v?._id || v || '')
        const inTeam = (v) => teamIds.has(refId(v))
        const inTeamOrSelf = (v) => inTeam(v) || refId(v) === leaderId

        setEmployees(allEmployees.filter((e) => teamIds.has(String(e._id))))
        setTasks(list(taskRes).filter((t) => inTeam(t.assignedTo)))
        setProjects(
          list(projRes).filter(
            (p) => inTeamOrSelf(p.projectManager) || (p.teamMembers || []).some(inTeamOrSelf)
          )
        )
        setAttendance(list(attRes).filter((a) => inTeam(a.employee)))
        setLeaves(list(leaveRes).filter((l) => inTeam(l.employee)))
        setLeads(list(leadRes).filter((l) => inTeamOrSelf(l.generatedBy)))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?._id])

  const stats = useMemo(() => {
    const now = new Date()
    const activeEmployees = employees.filter((e) => e.status === 'Active')
    const presentToday = attendance.filter((a) => a.checkIn && a.status !== 'Absent').length

    const isOverdue = (t) =>
      t.status !== 'Completed' && t.dueDate && new Date(t.dueDate) < new Date(now.toDateString())

    const taskStatusMap = { Completed: 0, 'In Progress': 0, 'To Do': 0, Overdue: 0 }
    tasks.forEach((t) => {
      if (isOverdue(t)) taskStatusMap.Overdue += 1
      else if (t.status === 'Completed') taskStatusMap.Completed += 1
      else if (t.status === 'In Progress') taskStatusMap['In Progress'] += 1
      else taskStatusMap['To Do'] += 1
    })
    const taskChart = Object.entries(taskStatusMap)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: TASK_COLORS[name] }))

    const pendingTasks = tasks.filter((t) => t.status === 'Pending').length
    const overdueTasks = taskStatusMap.Overdue
    const completedToday = tasks.filter((t) => t.status === 'Completed' && isToday(t.completedAt || t.updatedAt)).length

    // Tasks per member for the performance bar chart
    const perMember = {}
    tasks.forEach((t) => {
      const emp = typeof t.assignedTo === 'object' ? t.assignedTo : null
      const id = String(emp?._id || t.assignedTo || '')
      if (!id) return
      if (!perMember[id]) {
        perMember[id] = {
          employee: emp || activeEmployees.find((e) => String(e._id) === id),
          total: 0,
          completed: 0,
        }
      }
      perMember[id].total += 1
      if (t.status === 'Completed') perMember[id].completed += 1
    })
    const performance = Object.values(perMember)
      .filter((m) => m.employee)
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
      .map((m) => ({
        name: (m.employee.name || '').split(' ')[0],
        tasks: m.total,
      }))

    // Project progress from task completion per project
    const perProject = {}
    tasks.forEach((t) => {
      const id = String(t.project?._id || t.project || '')
      if (!id) return
      if (!perProject[id]) perProject[id] = { total: 0, completed: 0 }
      perProject[id].total += 1
      if (t.status === 'Completed') perProject[id].completed += 1
    })
    const projectProgress = projects
      .filter((p) => p.status !== 'Cancelled')
      .map((p) => {
        const counts = perProject[String(p._id)]
        const pct = p.status === 'Completed'
          ? 100
          : counts?.total
            ? Math.round((counts.completed / counts.total) * 100)
            : 0
        return { id: p._id, name: p.projectName, pct }
      })
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5)

    // Today's schedule from scheduled tasks + lead meetings
    const schedule = [
      ...tasks
        .filter((t) => t.scheduledStartAt && isToday(t.scheduledStartAt))
        .map((t) => ({
          time: new Date(t.scheduledStartAt),
          title: t.title,
          subtitle: t.assignedTo?.name || '',
          duration: t.estimatedDurationMinutes ? `${t.estimatedDurationMinutes} mins` : '',
          color: 'bg-indigo-500',
        })),
      ...leads
        .filter((l) => l.status === 'Meeting Schedule' && l.meetingTime && isToday(l.meetingTime))
        .map((l) => ({
          time: new Date(l.meetingTime),
          title: 'Client Meeting',
          subtitle: l.businessName || l.name || '',
          duration: '1 hour',
          color: 'bg-purple-500',
        })),
    ]
      .sort((a, b) => a.time - b.time)
      .slice(0, 5)

    const recentTasks = [...tasks]
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
      .slice(0, 5)

    // Team members table with attendance status + progress
    const teamRows = activeEmployees.slice(0, 6).map((e) => {
      const att = attendance.find((a) => String(a.employee?._id || a.employee) === String(e._id))
      const onLeave = leaves.some(
        (l) =>
          String(l.employee?._id || l.employee) === String(e._id) &&
          l.status === 'Approved' &&
          new Date(l.startDate) <= now &&
          new Date(l.endDate) >= new Date(now.toDateString())
      )
      let status = 'Offline'
      if (onLeave) status = 'On Leave'
      else if (att?.checkOut) status = 'Away'
      else if (att?.checkIn) status = 'Online'
      const m = perMember[String(e._id)]
      const openCount = m ? m.total - m.completed : 0
      const progress = m?.total ? Math.round((m.completed / m.total) * 100) : 0
      return {
        id: e._id,
        name: e.name,
        role: e.designation?.title || '—',
        status,
        tasks: openCount,
        progress,
      }
    })

    // Activity feed: completed tasks, new leaves, project updates
    const activity = [
      ...tasks
        .filter((t) => t.status === 'Completed' && (t.completedAt || t.updatedAt))
        .slice(0, 4)
        .map((t) => ({
          icon: '✅',
          iconBg: 'bg-emerald-50',
          text: `${t.assignedTo?.name || 'Someone'} completed task`,
          detail: t.title,
          date: t.completedAt || t.updatedAt,
        })),
      ...leaves
        .filter((l) => l.status === 'Pending')
        .slice(0, 2)
        .map((l) => ({
          icon: '📋',
          iconBg: 'bg-blue-50',
          text: `${l.employee?.name || 'Someone'} submitted leave request`,
          detail: `${new Date(l.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${new Date(l.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`,
          date: l.createdAt,
        })),
      ...projects
        .slice(0, 2)
        .map((p) => ({
          icon: '📁',
          iconBg: 'bg-purple-50',
          text: `Project updated`,
          detail: p.projectName,
          date: p.updatedAt || p.createdAt,
        })),
    ]
      .filter((a) => a.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)

    const pendingLeaves = leaves.filter((l) => l.status === 'Pending').length
    const followUpsThisWeek = leads.filter(
      (l) => l.status === 'Meeting Schedule' && l.meetingTime && isThisWeek(l.meetingTime)
    ).length
    const meetingsToday = leads.filter(
      (l) => l.status === 'Meeting Schedule' && l.meetingTime && isToday(l.meetingTime)
    ).length

    const productivity = tasks.length
      ? Math.round((taskStatusMap.Completed / tasks.length) * 100)
      : 0
    const productivityTrend = []
    for (let i = 6; i >= 0; i--) {
      const day = new Date()
      day.setDate(day.getDate() - i)
      const dayTasks = tasks.filter(
        (t) => new Date(t.updatedAt || t.createdAt).toDateString() === day.toDateString()
      )
      const done = dayTasks.filter((t) => t.status === 'Completed').length
      productivityTrend.push({
        day: day.toLocaleDateString('en-IN', { weekday: 'short' }),
        value: dayTasks.length ? Math.round((done / dayTasks.length) * 100) : 0,
      })
    }

    const activeProjects = projects.filter((p) => p.status === 'In Progress').length
    const newProjectsThisMonth = projects.filter((p) => {
      const c = new Date(p.createdAt)
      return c.getMonth() === now.getMonth() && c.getFullYear() === now.getFullYear()
    }).length

    return {
      teamCount: activeEmployees.length,
      presentToday,
      activeProjects,
      newProjectsThisMonth,
      totalTasks: tasks.length,
      completedToday,
      pendingTasks,
      overdueTasks,
      taskChart,
      taskStatusMap,
      performance,
      projectProgress,
      schedule,
      recentTasks,
      teamRows,
      activity,
      pendingLeaves,
      followUpsThisWeek,
      meetingsToday,
      productivity,
      productivityTrend,
    }
  }, [employees, tasks, projects, attendance, leaves, leads])

  if (loading) {
    return <div className='p-8 text-sm text-gray-600'>Loading dashboard...</div>
  }

  const attendancePct = stats.teamCount ? Math.round((stats.presentToday / stats.teamCount) * 100) : 0

  return (
    <div className='p-6 md:p-8 w-full bg-[#f4f6f9] min-h-full'>
      <div className='flex flex-wrap items-start justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Dashboard</h1>
          <p className='text-gray-600 mt-1 text-sm'>Overview of your team's performance and progress</p>
        </div>
        <div className='flex items-center gap-3'>
          <div className='text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm flex items-center gap-2'>
            <span>📅</span>
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
          <button
            type='button'
            onClick={() => navigate('/assign-task')}
            className='bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg px-4 py-2 shadow-sm flex items-center gap-2'
          >
            <span>+</span> Create Task
          </button>
        </div>
      </div>

      <div className='grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4 mb-6'>
        <StatCard
          icon='👥'
          iconBg='bg-blue-50'
          label='Team Members'
          value={stats.teamCount}
          sub='Active members'
          subClass='text-green-600'
          onClick={() => navigate('/employees')}
        />
        <StatCard
          icon='🗓️'
          iconBg='bg-emerald-50'
          label='Present Today'
          value={`${stats.presentToday} / ${stats.teamCount}`}
          sub={`${attendancePct}% attendance`}
          subClass='text-gray-500'
          onClick={() => navigate('/attendance')}
        />
        <StatCard
          icon='📁'
          iconBg='bg-indigo-50'
          label='Active Projects'
          value={stats.activeProjects}
          sub={stats.newProjectsThisMonth ? `${stats.newProjectsThisMonth} new this month` : 'No new this month'}
          subClass='text-blue-600'
          onClick={() => navigate('/projects')}
        />
        <StatCard
          icon='✅'
          iconBg='bg-green-50'
          label='Total Tasks'
          value={stats.totalTasks}
          sub={stats.completedToday ? `${stats.completedToday} completed today` : 'None completed today'}
          subClass='text-green-600'
          onClick={() => navigate('/tasks')}
        />
        <StatCard
          icon='🕓'
          iconBg='bg-amber-50'
          label='Pending Tasks'
          value={stats.pendingTasks}
          sub='Awaiting start'
          subClass='text-amber-600'
          onClick={() => navigate('/tasks')}
        />
        <StatCard
          icon='⚠️'
          iconBg='bg-red-50'
          label='Overdue Tasks'
          value={stats.overdueTasks}
          sub={stats.overdueTasks ? 'Needs attention' : 'All on track'}
          subClass={stats.overdueTasks ? 'text-red-600' : 'text-green-600'}
          onClick={() => navigate('/tasks')}
        />
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4 mb-6'>
        <Panel title='Team Performance' action='View All' onAction={() => navigate('/employees')}>
          {stats.performance.length ? (
            <div className='h-56'>
              <ResponsiveContainer width='100%' height='100%'>
                <BarChart data={stats.performance} barSize={26}>
                  <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' vertical={false} />
                  <XAxis dataKey='name' tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} />
                  <Bar dataKey='tasks' name='Tasks' fill='#3b82f6' radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className='text-sm text-gray-500 text-center py-16'>No task data yet</p>
          )}
        </Panel>

        <Panel title='Task Status'>
          {stats.taskChart.length ? (
            <>
              <div className='h-40 relative'>
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie data={stats.taskChart} dataKey='value' cx='50%' cy='50%' innerRadius={46} outerRadius={64} paddingAngle={3}>
                      {stats.taskChart.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
                  <div className='text-center'>
                    <p className='text-xl font-bold text-gray-900'>{stats.totalTasks}</p>
                    <p className='text-[10px] text-gray-500'>Total Tasks</p>
                  </div>
                </div>
              </div>
              <div className='mt-3 space-y-2'>
                {stats.taskChart.map((d) => {
                  const pct = stats.totalTasks ? Math.round((d.value / stats.totalTasks) * 100) : 0
                  return (
                    <div key={d.name} className='flex items-center justify-between text-xs'>
                      <span className='flex items-center gap-2'>
                        <span className='w-2.5 h-2.5 rounded-full' style={{ background: d.color }} />
                        {d.name}
                      </span>
                      <span className='font-semibold text-gray-700'>{d.value} ({pct}%)</span>
                    </div>
                  )
                })}
              </div>
            </>
          ) : (
            <p className='text-sm text-gray-500 text-center py-16'>No tasks yet</p>
          )}
        </Panel>

        <Panel title='Project Progress' action='View All' onAction={() => navigate('/projects')}>
          {stats.projectProgress.length ? (
            <div className='space-y-4'>
              {stats.projectProgress.map((p, i) => (
                <button
                  key={p.id}
                  type='button'
                  onClick={() => navigate(`/projects/${p.id}/dashboard`)}
                  className='w-full text-left'
                >
                  <div className='flex items-center justify-between text-xs mb-1.5'>
                    <span className='text-gray-700 font-medium truncate'>{p.name}</span>
                    <span className='font-bold text-gray-900 shrink-0 ml-2'>{p.pct}%</span>
                  </div>
                  <div className='h-2 bg-gray-100 rounded-full overflow-hidden'>
                    <div
                      className='h-full rounded-full transition-all'
                      style={{ width: `${p.pct}%`, background: PROGRESS_COLORS[i % PROGRESS_COLORS.length] }}
                    />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className='text-sm text-gray-500 text-center py-16'>No projects yet</p>
          )}
        </Panel>

        <Panel title="Today's Schedule" action='View All' onAction={() => navigate('/calendar')}>
          {stats.schedule.length ? (
            <div className='space-y-4'>
              {stats.schedule.map((ev, i) => (
                <div key={`${ev.title}-${i}`} className='flex gap-3 items-start'>
                  <span className='text-[11px] font-semibold text-gray-500 w-14 shrink-0 pt-0.5'>{timeLabel(ev.time)}</span>
                  <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${ev.color}`} />
                  <div className='min-w-0'>
                    <p className='text-sm font-semibold text-gray-900 truncate'>{ev.title}</p>
                    <p className='text-[11px] text-gray-500 truncate'>{ev.subtitle}{ev.duration ? ` · ${ev.duration}` : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-sm text-gray-500 text-center py-16'>Nothing scheduled today</p>
          )}
        </Panel>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6'>
        <Panel title='Recent Tasks' action='View All' onAction={() => navigate('/tasks')}>
          {stats.recentTasks.length ? (
            <div className='space-y-4'>
              {stats.recentTasks.map((t) => (
                <button
                  key={t._id}
                  type='button'
                  onClick={() => t.source !== 'social_media' && navigate(`/tasks/${t._id}`)}
                  className='w-full flex items-center gap-3 text-left hover:bg-gray-50 rounded-lg p-1 -mx-1 transition-colors'
                >
                  <span
                    className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center text-[9px] ${
                      t.status === 'Completed'
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-gray-300 text-transparent'
                    }`}
                  >
                    ✓
                  </span>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium text-gray-900 truncate'>{t.title}</p>
                    <p className='text-[11px] text-gray-500 truncate'>Assigned to {t.assignedTo?.name || '—'}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.Medium}`}>
                    {t.priority || 'Medium'}
                  </span>
                  <span className='text-[11px] text-gray-400 shrink-0 w-16 text-right'>{dueLabel(t.dueDate)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className='text-sm text-gray-500 text-center py-12'>No tasks yet</p>
          )}
        </Panel>

        <Panel title='Team Members' action='View All' onAction={() => navigate('/employees')}>
          {stats.teamRows.length ? (
            <div className='overflow-x-auto -mx-2'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-[11px] uppercase tracking-wide text-gray-400'>
                    <th className='text-left font-semibold px-2 pb-2'>Member</th>
                    <th className='text-left font-semibold px-2 pb-2'>Status</th>
                    <th className='text-right font-semibold px-2 pb-2'>Tasks</th>
                    <th className='text-left font-semibold px-2 pb-2 w-24'>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.teamRows.map((m) => (
                    <tr key={m.id} className='border-t border-gray-50'>
                      <td className='px-2 py-2.5'>
                        <div className='flex items-center gap-2 min-w-0'>
                          <div className='w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-[10px] font-bold shrink-0'>
                            {initials(m.name)}
                          </div>
                          <div className='min-w-0'>
                            <p className='font-medium text-gray-900 truncate text-xs'>{m.name}</p>
                            <p className='text-[10px] text-gray-500 truncate'>{m.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className='px-2 py-2.5'>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            m.status === 'Online'
                              ? 'bg-emerald-50 text-emerald-700'
                              : m.status === 'Away'
                                ? 'bg-amber-50 text-amber-700'
                                : m.status === 'On Leave'
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {m.status}
                        </span>
                      </td>
                      <td className='px-2 py-2.5 text-right text-xs font-semibold text-gray-700'>{m.tasks}</td>
                      <td className='px-2 py-2.5'>
                        <div className='flex items-center gap-1.5'>
                          <div className='h-1.5 flex-1 bg-gray-100 rounded-full overflow-hidden'>
                            <div className='h-full bg-blue-500 rounded-full' style={{ width: `${m.progress}%` }} />
                          </div>
                          <span className='text-[10px] text-gray-500 w-7 text-right'>{m.progress}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className='text-sm text-gray-500 text-center py-12'>No team members</p>
          )}
        </Panel>

        <Panel title='Activity Feed' action='View All' onAction={() => navigate('/tasks')}>
          {stats.activity.length ? (
            <div className='space-y-4'>
              {stats.activity.map((a, i) => (
                <div key={`${a.detail}-${i}`} className='flex gap-3'>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${a.iconBg}`}>{a.icon}</div>
                  <div className='min-w-0 flex-1'>
                    <p className='text-xs text-gray-900'>{a.text}</p>
                    <p className='text-xs text-blue-600 truncate mt-0.5'>"{a.detail}"</p>
                    <p className='text-[10px] text-gray-400 mt-0.5'>{relativeTime(a.date)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className='text-sm text-gray-500 text-center py-12'>No recent activity</p>
          )}
        </Panel>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4'>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3'>
          <div className='flex items-center gap-3 min-w-0'>
            <div className='w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center text-base shrink-0'>📋</div>
            <div className='min-w-0'>
              <p className='text-xs text-gray-500 font-medium'>Leave Requests</p>
              <p className='text-xl font-bold text-gray-900'>{stats.pendingLeaves}</p>
              <p className='text-[10px] text-gray-400'>Pending approvals</p>
            </div>
          </div>
          <button
            type='button'
            onClick={() => navigate('/leave')}
            className='text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 shrink-0'
          >
            Review
          </button>
        </div>

        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3'>
          <div className='flex items-center gap-3 min-w-0'>
            <div className='w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-base shrink-0'>📞</div>
            <div className='min-w-0'>
              <p className='text-xs text-gray-500 font-medium'>Client Follow-ups</p>
              <p className='text-xl font-bold text-gray-900'>{stats.followUpsThisWeek}</p>
              <p className='text-[10px] text-gray-400'>Due this week</p>
            </div>
          </div>
          <button
            type='button'
            onClick={() => navigate('/leads')}
            className='text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 shrink-0'
          >
            View
          </button>
        </div>

        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <div className='flex items-center justify-between gap-3'>
            <div className='flex items-center gap-3 min-w-0'>
              <div className='w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-base shrink-0'>📈</div>
              <div className='min-w-0'>
                <p className='text-xs text-gray-500 font-medium'>Team Productivity</p>
                <p className='text-xl font-bold text-gray-900'>{stats.productivity}%</p>
                <p className='text-[10px] text-gray-400'>Tasks completed</p>
              </div>
            </div>
            <div className='w-20 h-10 shrink-0'>
              <ResponsiveContainer width='100%' height='100%'>
                <AreaChart data={stats.productivityTrend}>
                  <Area type='monotone' dataKey='value' stroke='#3b82f6' fill='#dbeafe' strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-center justify-between gap-3'>
          <div className='flex items-center gap-3 min-w-0'>
            <div className='w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-base shrink-0'>📹</div>
            <div className='min-w-0'>
              <p className='text-xs text-gray-500 font-medium'>Meetings</p>
              <p className='text-xl font-bold text-gray-900'>{stats.meetingsToday}</p>
              <p className='text-[10px] text-gray-400'>Scheduled today</p>
            </div>
          </div>
          <button
            type='button'
            onClick={() => navigate('/calendar')}
            className='text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg px-3 py-1.5 shrink-0'
          >
            View
          </button>
        </div>
      </div>
    </div>
  )
}

export default TeamLeaderDashboardView
