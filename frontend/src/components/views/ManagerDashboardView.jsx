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
} from 'recharts'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const PROJECT_COLORS = {
  'In Progress': '#3b82f6',
  Completed: '#10b981',
  'On Hold': '#f59e0b',
  'Not Started': '#9ca3af',
  Cancelled: '#ef4444',
}

const TASK_COLORS = {
  Completed: '#10b981',
  'In Progress': '#3b82f6',
  Pending: '#f59e0b',
  Cancelled: '#9ca3af',
}

const ACTIVITY_COLORS = ['bg-blue-500', 'bg-green-500', 'bg-orange-500', 'bg-purple-500', 'bg-pink-500', 'bg-cyan-500']

const formatINR = (n) => `₹ ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`

const isThisMonth = (d) => {
  if (!d) return false
  const dt = new Date(d)
  const now = new Date()
  return dt.getMonth() === now.getMonth() && dt.getFullYear() === now.getFullYear()
}

const isLastMonth = (d) => {
  if (!d) return false
  const dt = new Date(d)
  const now = new Date()
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return dt.getMonth() === lm.getMonth() && dt.getFullYear() === lm.getFullYear()
}

const growthPct = (current, previous) => {
  if (!previous) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 1000) / 10
}

const formatTime = (date) => {
  if (!date) return ''
  const dt = new Date(date)
  const now = new Date()
  const isToday = dt.toDateString() === now.toDateString()
  if (isToday) return dt.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (dt.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const getMonthRangeLabel = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(start)} – ${fmt(now)}`
}

const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase() || '?'

const KpiCard = ({ title, value, change, positive, icon, iconBg, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    className='text-left bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow w-full'
  >
    <div className='flex items-start justify-between gap-3'>
      <div className='min-w-0 flex-1'>
        <p className='text-sm text-gray-500 font-medium'>{title}</p>
        <p className='text-2xl font-bold text-gray-900 mt-1 truncate'>{value}</p>
        {change != null && (
          <p className={`text-xs font-semibold mt-1.5 flex items-center gap-1 ${positive ? 'text-green-600' : 'text-red-600'}`}>
            <span>{positive ? '↑' : '↓'}</span>
            {Math.abs(change)}% vs last month
          </p>
        )}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 ${iconBg}`}>{icon}</div>
    </div>
  </button>
)

const Panel = ({ title, actionLabel, onAction, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden ${className}`}>
    <div className='flex items-center justify-between px-5 py-4 border-b border-gray-50'>
      <h3 className='text-sm font-semibold text-gray-900'>{title}</h3>
      {actionLabel && (
        <button type='button' onClick={onAction} className='text-xs font-medium text-gray-500 hover:text-blue-600 border border-gray-200 rounded-lg px-2.5 py-1'>
          {actionLabel}
        </button>
      )}
    </div>
    <div className='p-5'>{children}</div>
  </div>
)

const ProgressRow = ({ label, value, total, color }) => {
  const pct = total ? Math.round((value / total) * 1000) / 10 : 0
  return (
    <div>
      <div className='flex items-center justify-between text-sm mb-1.5'>
        <span className='text-gray-600'>{label}</span>
        <span className='font-semibold text-gray-900'>
          {value} <span className='text-gray-400 font-normal'>({pct}%)</span>
        </span>
      </div>
      <div className='h-2 bg-gray-100 rounded-full overflow-hidden'>
        <div className='h-full rounded-full transition-all' style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

const ManagerDashboardView = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [leads, setLeads] = useState([])
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [billings, setBillings] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [cliRes, projRes, leadRes, taskRes, empRes, billRes] = await Promise.all([
          api.get('/clients'),
          api.get('/projects'),
          api.get('/leads').catch(() => ({ data: [] })),
          api.get('/tasks').catch(() => ({ data: [] })),
          api.get('/employees'),
          api.get('/billing').catch(() => ({ data: [] })),
        ])
        const list = (res) => (Array.isArray(res.data) ? res.data : res.data?.data || [])
        setClients(list(cliRes))
        setProjects(list(projRes))
        setLeads(list(leadRes))
        setTasks(list(taskRes))
        setEmployees(list(empRes))
        setBillings(list(billRes))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const leadsThisMonth = leads.filter((l) => isThisMonth(l.createdAt)).length
    const leadsLastMonth = leads.filter((l) => isLastMonth(l.createdAt)).length

    const activeProjects = projects.filter((p) => p.status === 'In Progress').length
    const activeThisMonth = projects.filter((p) => p.status === 'In Progress' && isThisMonth(p.updatedAt || p.createdAt)).length
    const activeLastMonth = projects.filter((p) => p.status === 'In Progress' && isLastMonth(p.updatedAt || p.createdAt)).length

    const clientsThisMonth = clients.filter((c) => isThisMonth(c.createdAt)).length
    const clientsLastMonth = clients.filter((c) => isLastMonth(c.createdAt)).length

    const revenueThisMonth = billings
      .filter((b) => isThisMonth(b.paymentDetails?.paymentDate || b.createdAt))
      .reduce((s, b) => s + (Number(b.paymentDetails?.amount) || 0), 0)
    const revenueLastMonth = billings
      .filter((b) => isLastMonth(b.paymentDetails?.paymentDate || b.createdAt))
      .reduce((s, b) => s + (Number(b.paymentDetails?.amount) || 0), 0)

    const leadsTrend = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setDate(1)
      d.setMonth(d.getMonth() - i)
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
      const monthLeads = leads.filter((l) => {
        const created = new Date(l.createdAt)
        return created >= monthStart && created <= monthEnd
      })
      leadsTrend.push({
        month: d.toLocaleDateString('en-IN', { month: 'short' }),
        newLeads: monthLeads.length,
        qualified: monthLeads.filter((l) => l.status === 'Interested').length,
        converted: monthLeads.filter((l) => l.status === 'Meeting Schedule').length,
      })
    }

    const projectStatusMap = { 'In Progress': 0, Completed: 0, 'On Hold': 0, 'Not Started': 0 }
    projects.forEach((p) => {
      const key = projectStatusMap[p.status] !== undefined ? p.status : 'Not Started'
      projectStatusMap[key] += 1
    })
    const projectChart = Object.entries(projectStatusMap)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: PROJECT_COLORS[name] }))

    const taskStatusMap = { Completed: 0, 'In Progress': 0, Pending: 0, Cancelled: 0 }
    tasks.forEach((t) => {
      const key = taskStatusMap[t.status] !== undefined ? t.status : 'Pending'
      taskStatusMap[key] += 1
    })

    const taskCountByEmployee = {}
    tasks.forEach((t) => {
      const id = t.assignedTo?._id || t.assignedTo
      if (!id) return
      const key = String(id)
      if (!taskCountByEmployee[key]) {
        taskCountByEmployee[key] = {
          employee: typeof t.assignedTo === 'object' ? t.assignedTo : employees.find((e) => String(e._id) === key),
          completed: 0,
          total: 0,
        }
      }
      taskCountByEmployee[key].total += 1
      if (t.status === 'Completed') taskCountByEmployee[key].completed += 1
    })

    const topTeam = Object.values(taskCountByEmployee)
      .sort((a, b) => b.completed - a.completed)
      .slice(0, 4)
      .map((item, i) => {
        const target = Math.max(5, item.total)
        const pct = Math.round((item.completed / target) * 100)
        return {
          rank: i + 1,
          name: item.employee?.name || 'Team Member',
          role: item.employee?.designation?.title || item.employee?.department || 'Employee',
          completed: item.completed,
          targetPct: pct,
          onTarget: pct >= 100,
        }
      })

    const activities = [
      ...leads.slice(0, 5).map((l) => ({
        name: l.generatedBy?.name || 'Team',
        action: 'created a new lead',
        detail: l.businessName || l.name,
        date: l.createdAt,
        path: `/leads/view/${l._id}`,
      })),
      ...tasks.filter((t) => t.status === 'Completed').slice(0, 3).map((t) => ({
        name: t.assignedBy?.name || t.assignedTo?.name || 'Team',
        action: 'completed task',
        detail: t.title,
        date: t.completedAt || t.updatedAt,
        path: '/tasks',
      })),
      ...projects.slice(0, 3).map((p) => ({
        name: p.projectManager?.name || 'Team',
        action: 'updated project',
        detail: p.projectName,
        date: p.updatedAt || p.createdAt,
        path: `/projects/${p._id}/dashboard`,
      })),
    ]
      .filter((a) => a.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)

    const upcomingEvents = leads
      .filter((l) => l.status === 'Meeting Schedule' && l.meetingTime)
      .sort((a, b) => new Date(a.meetingTime) - new Date(b.meetingTime))
      .slice(0, 4)
      .map((l) => ({
        date: new Date(l.meetingTime),
        title: l.meetingType === 'Online' ? 'Online Meeting' : 'Client Meeting',
        subtitle: l.businessName || l.name,
        time: new Date(l.meetingTime).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
        endTime: new Date(new Date(l.meetingTime).getTime() + 60 * 60 * 1000).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }),
        attendees: [l.generatedBy?.name, l.meetingPersonName].filter(Boolean),
      }))

    return {
      leadGrowth: growthPct(leadsThisMonth, leadsLastMonth),
      projectGrowth: growthPct(activeThisMonth, activeLastMonth),
      clientGrowth: growthPct(clientsThisMonth, clientsLastMonth),
      revenueGrowth: growthPct(revenueThisMonth, revenueLastMonth),
      revenueThisMonth,
      activeProjects,
      leadsTrend,
      projectChart,
      taskStatusMap,
      topTeam,
      activities,
      upcomingEvents,
    }
  }, [clients, projects, leads, tasks, employees, billings])

  if (loading) {
    return <div className='p-8 text-sm text-gray-600'>Loading dashboard...</div>
  }

  const firstName = (user?.name || 'Manager').split(' ')[0]
  const designation = user?.designation?.title || 'Manager'
  const totalTasks = tasks.length

  return (
    <div className='p-6 md:p-8 w-full bg-[#f8f9fa] min-h-full'>
      <div className='flex flex-wrap items-start justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Dashboard</h1>
          <p className='text-gray-600 mt-1 text-sm'>
            Welcome back, {firstName} 👋
            <span className='text-gray-400 ml-2'>· {designation}</span>
          </p>
        </div>
        <div className='flex items-center gap-2'>
          <div className='text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm'>
            {getMonthRangeLabel()}
          </div>
          <button
            type='button'
            className='text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm hover:bg-gray-50 flex items-center gap-2'
          >
            <span>⚙</span> Filters
          </button>
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6'>
        <KpiCard
          title='Total Leads'
          value={leads.length.toLocaleString('en-IN')}
          change={stats.leadGrowth}
          positive={stats.leadGrowth >= 0}
          icon='🎯'
          iconBg='bg-blue-50 text-blue-600'
          onClick={() => navigate('/leads')}
        />
        <KpiCard
          title='Active Projects'
          value={stats.activeProjects}
          change={stats.projectGrowth}
          positive={stats.projectGrowth >= 0}
          icon='📁'
          iconBg='bg-green-50 text-green-600'
          onClick={() => navigate('/projects')}
        />
        <KpiCard
          title='Total Clients'
          value={clients.length.toLocaleString('en-IN')}
          change={stats.clientGrowth}
          positive={stats.clientGrowth >= 0}
          icon='🏢'
          iconBg='bg-purple-50 text-purple-600'
          onClick={() => navigate('/clients')}
        />
        <KpiCard
          title='Revenue (This Month)'
          value={formatINR(stats.revenueThisMonth)}
          change={stats.revenueGrowth}
          positive={stats.revenueGrowth >= 0}
          icon='💰'
          iconBg='bg-orange-50 text-orange-600'
          onClick={() => navigate('/revenue')}
        />
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6'>
        <Panel title='Leads Overview' actionLabel='This Month' onAction={() => navigate('/leads')} className='xl:col-span-1'>
          <div className='h-52'>
            <ResponsiveContainer width='100%' height='100%'>
              <LineChart data={stats.leadsTrend}>
                <CartesianGrid strokeDasharray='3 3' stroke='#f0f0f0' />
                <XAxis dataKey='month' tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Line type='monotone' dataKey='newLeads' name='New Leads' stroke='#3b82f6' strokeWidth={2} dot={{ r: 3 }} />
                <Line type='monotone' dataKey='qualified' name='Qualified' stroke='#10b981' strokeWidth={2} dot={{ r: 3 }} />
                <Line type='monotone' dataKey='converted' name='Converted' stroke='#f59e0b' strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className='flex flex-wrap gap-4 mt-3 text-xs text-gray-500'>
            <span className='flex items-center gap-1.5'><span className='w-2.5 h-2.5 rounded-full bg-blue-500' /> New Leads</span>
            <span className='flex items-center gap-1.5'><span className='w-2.5 h-2.5 rounded-full bg-green-500' /> Qualified</span>
            <span className='flex items-center gap-1.5'><span className='w-2.5 h-2.5 rounded-full bg-orange-500' /> Converted</span>
          </div>
        </Panel>

        <Panel title='Projects Status' actionLabel='View All' onAction={() => navigate('/projects')}>
          {stats.projectChart.length ? (
            <>
              <div className='h-44 relative'>
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie data={stats.projectChart} dataKey='value' cx='50%' cy='50%' innerRadius={48} outerRadius={68} paddingAngle={3}>
                      {stats.projectChart.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
                  <div className='text-center'>
                    <p className='text-2xl font-bold text-gray-900'>{projects.length}</p>
                    <p className='text-[11px] text-gray-500'>Total</p>
                  </div>
                </div>
              </div>
              <div className='mt-3 space-y-2'>
                {stats.projectChart.map((d) => (
                  <div key={d.name} className='flex items-center justify-between text-xs'>
                    <span className='flex items-center gap-2'>
                      <span className='w-2.5 h-2.5 rounded-full' style={{ background: d.color }} />
                      {d.name}
                    </span>
                    <span className='font-semibold text-gray-700'>{d.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className='text-sm text-gray-500 text-center py-16'>No projects yet</p>
          )}
        </Panel>

        <Panel title='Tasks Overview' actionLabel='This Week' onAction={() => navigate('/tasks')}>
          <div className='space-y-4'>
            <div className='flex items-center justify-between pb-2 border-b border-gray-100'>
              <span className='text-sm text-gray-600'>Total Tasks</span>
              <span className='text-lg font-bold text-gray-900'>{totalTasks}</span>
            </div>
            <ProgressRow label='Completed' value={stats.taskStatusMap.Completed} total={totalTasks} color={TASK_COLORS.Completed} />
            <ProgressRow label='In Progress' value={stats.taskStatusMap['In Progress']} total={totalTasks} color={TASK_COLORS['In Progress']} />
            <ProgressRow label='Pending' value={stats.taskStatusMap.Pending} total={totalTasks} color={TASK_COLORS.Pending} />
          </div>
        </Panel>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <Panel title='Recent Activities'>
          <div className='space-y-4'>
            {stats.activities.length ? (
              stats.activities.map((a, i) => (
                <button
                  key={`${a.detail}-${i}`}
                  type='button'
                  onClick={() => navigate(a.path)}
                  className='w-full flex gap-3 text-left hover:bg-gray-50 rounded-lg p-1 -mx-1 transition-colors'
                >
                  <div className={`w-9 h-9 rounded-full ${ACTIVITY_COLORS[i % ACTIVITY_COLORS.length]} text-white flex items-center justify-center text-xs font-bold shrink-0`}>
                    {initials(a.name)}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm text-gray-900'>
                      <span className='font-semibold'>{a.name}</span>{' '}
                      <span className='text-gray-600'>{a.action}</span>
                    </p>
                    <p className='text-xs text-blue-600 truncate mt-0.5'>{a.detail}</p>
                    <p className='text-[11px] text-gray-400 mt-0.5'>{formatTime(a.date)}</p>
                  </div>
                </button>
              ))
            ) : (
              <p className='text-sm text-gray-500 text-center py-8'>No recent activity</p>
            )}
          </div>
        </Panel>

        <Panel title='Top Performing Team Members' actionLabel='This Month' onAction={() => navigate('/employees')}>
          <div className='space-y-4'>
            {stats.topTeam.length ? (
              stats.topTeam.map((m) => (
                <div key={m.name + m.rank} className='flex items-center gap-3'>
                  <span className='w-5 text-sm font-bold text-gray-400'>{m.rank}</span>
                  <div className='w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 text-white flex items-center justify-center text-xs font-bold shrink-0'>
                    {initials(m.name)}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-semibold text-gray-900 truncate'>{m.name}</p>
                    <p className='text-xs text-gray-500 truncate'>{m.completed} Tasks Completed</p>
                  </div>
                  <span className={`text-xs font-bold shrink-0 ${m.onTarget ? 'text-green-600' : 'text-orange-500'}`}>
                    {m.targetPct}% of target
                  </span>
                </div>
              ))
            ) : (
              <p className='text-sm text-gray-500 text-center py-8'>No team performance data yet</p>
            )}
          </div>
        </Panel>

        <Panel title='Upcoming Events' actionLabel='View Calendar' onAction={() => navigate('/calendar')}>
          <div className='space-y-4'>
            {stats.upcomingEvents.length ? (
              stats.upcomingEvents.map((ev, i) => (
                <div key={`${ev.title}-${i}`} className='flex gap-3 items-start'>
                  <div className='w-12 h-12 rounded-lg bg-blue-50 border border-blue-100 flex flex-col items-center justify-center shrink-0'>
                    <span className='text-[10px] font-bold text-blue-600 uppercase'>
                      {ev.date.toLocaleDateString('en-IN', { month: 'short' })}
                    </span>
                    <span className='text-lg font-bold text-blue-700 leading-none'>
                      {ev.date.getDate()}
                    </span>
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-semibold text-gray-900'>{ev.title}</p>
                    <p className='text-xs text-gray-500 truncate'>{ev.subtitle}</p>
                    <p className='text-[11px] text-gray-400 mt-1'>
                      {ev.time} – {ev.endTime}
                    </p>
                    {ev.attendees.length > 0 && (
                      <div className='flex items-center mt-2 -space-x-2'>
                        {ev.attendees.slice(0, 3).map((name, j) => (
                          <div
                            key={name + j}
                            className='w-6 h-6 rounded-full bg-gray-200 border-2 border-white text-[9px] font-bold text-gray-600 flex items-center justify-center'
                            title={name}
                          >
                            {initials(name)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className='text-sm text-gray-500 text-center py-8'>No upcoming events</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

export default ManagerDashboardView
