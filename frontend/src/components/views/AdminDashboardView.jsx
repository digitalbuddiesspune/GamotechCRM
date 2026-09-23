import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Area,
  AreaChart,
} from 'recharts'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const CHART_COLORS = ['#2563EB', '#7C3AED', '#0891B2', '#D97706', '#059669', '#DB2777', '#4F46E5']
const TASK_COLORS = { Completed: '#059669', 'In Progress': '#2563EB', Pending: '#D97706', Cancelled: '#94A3B8' }

const formatINR = (n) => `₹ ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`
const formatCompactINR = (n) => {
  const v = Number(n) || 0
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`
  if (v >= 1000) return `₹${(v / 1000).toFixed(0)}k`
  return `₹${v}`
}

const timeAgo = (date) => {
  if (!date) return ''
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${Math.max(1, mins)} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days > 1 ? 's' : ''} ago`
}

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

const ChartTooltip = ({ active, payload, label, valueFormatter, labelFormatter }) => {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const displayLabel = labelFormatter ? labelFormatter(label, payload) : label
  const displayValue = valueFormatter ? valueFormatter(item.value) : item.value
  return (
    <div className='rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-lg'>
      {displayLabel && <p className='text-[11px] font-medium text-gray-500 mb-1'>{displayLabel}</p>}
      <p className='text-sm font-bold text-gray-900'>{displayValue}</p>
    </div>
  )
}

const Sparkline = ({ data, color }) => {
  if (!data?.length) return null
  const max = Math.max(...data, 1)
  const points = data.map((v, i) => `${(i / Math.max(data.length - 1, 1)) * 100},${28 - (v / max) * 22}`).join(' ')
  const areaPoints = `0,28 ${points} 100,28`
  return (
    <svg viewBox='0 0 100 28' className='w-full h-7 mt-3' preserveAspectRatio='none'>
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor={color} stopOpacity={0.25} />
          <stop offset='100%' stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon fill={`url(#spark-${color.replace('#', '')})`} points={areaPoints} />
      <polyline fill='none' stroke={color} strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' points={points} />
    </svg>
  )
}

const KpiCard = ({ title, value, change, positive, icon, iconBg, sparkData, sparkColor, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    className='text-left bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:shadow-md hover:border-gray-300 transition-all w-full group'
  >
    <div className='flex items-start justify-between gap-3'>
      <div className='min-w-0 flex-1'>
        <p className='text-sm text-gray-500 font-medium'>{title}</p>
        <p className='text-2xl font-bold text-gray-900 mt-1 truncate tracking-tight'>{value}</p>
        {change != null && (
          <p className={`text-xs font-semibold mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
            <span>{positive ? '↑' : '↓'}</span>
            {Math.abs(change)}% this month
          </p>
        )}
      </div>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 group-hover:scale-105 transition-transform ${iconBg}`}>{icon}</div>
    </div>
    {sparkData?.length > 0 && <Sparkline data={sparkData} color={sparkColor} />}
  </button>
)

const Panel = ({ title, subtitle, actionLabel, onAction, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ${className}`}>
    <div className='flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-white to-slate-50/80'>
      <div>
        <h3 className='text-sm font-semibold text-gray-900'>{title}</h3>
        {subtitle && <p className='text-xs text-gray-500 mt-0.5'>{subtitle}</p>}
      </div>
      {actionLabel && (
        <button type='button' onClick={onAction} className='text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0'>
          {actionLabel}
        </button>
      )}
    </div>
    <div className='p-5'>{children}</div>
  </div>
)

const DonutLegend = ({ data, total, colors, valueSuffix = '' }) => (
  <div className='mt-4 space-y-2.5'>
    {data.map((d, i) => {
      const pct = total ? Math.round((d.value / total) * 100) : 0
      const color = d.color || colors[i % colors.length]
      return (
        <div key={d.name}>
          <div className='flex items-center justify-between text-xs mb-1'>
            <span className='flex items-center gap-2 truncate text-gray-600'>
              <span className='w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-white shadow-sm' style={{ background: color }} />
              <span className='font-medium text-gray-700 truncate'>{d.name}</span>
            </span>
            <span className='font-semibold text-gray-900 shrink-0 ml-2'>
              {d.value}{valueSuffix} · {pct}%
            </span>
          </div>
          <div className='h-1.5 rounded-full bg-gray-100 overflow-hidden'>
            <div className='h-full rounded-full transition-all duration-500' style={{ width: `${pct}%`, background: color }} />
          </div>
        </div>
      )
    })}
  </div>
)

const DonutChart = ({ data, total, centerLabel, centerValue, colors }) => (
  <div className='flex flex-col sm:flex-row items-center gap-4'>
    <div className='h-44 w-44 relative shrink-0'>
      <ResponsiveContainer width='100%' height='100%'>
        <PieChart>
          <Pie
            data={data}
            dataKey='value'
            cx='50%'
            cy='50%'
            innerRadius={52}
            outerRadius={72}
            paddingAngle={3}
            cornerRadius={4}
            stroke='none'
          >
            {data.map((d, i) => (
              <Cell key={d.name} fill={d.color || colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v}`} />} />
        </PieChart>
      </ResponsiveContainer>
      <div className='absolute inset-0 flex items-center justify-center pointer-events-none'>
        <div className='text-center'>
          <p className='text-2xl font-bold text-gray-900 leading-none'>{centerValue}</p>
          <p className='text-[10px] uppercase tracking-wide text-gray-400 mt-1 font-medium'>{centerLabel}</p>
        </div>
      </div>
    </div>
    <div className='flex-1 w-full min-w-0'>
      <DonutLegend data={data} total={total} colors={colors} />
    </div>
  </div>
)

const MiniStat = ({ title, value, change, icon, iconBg, onClick }) => (
  <button type='button' onClick={onClick} className='bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-gray-300 transition-all text-left w-full'>
    <div className='flex items-center justify-between gap-2'>
      <div>
        <p className='text-xs text-gray-500 font-medium'>{title}</p>
        <p className='text-xl font-bold text-gray-900 mt-1 tracking-tight'>{value}</p>
        {change != null && (
          <p className={`text-[11px] font-semibold mt-1 ${change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {change >= 0 ? '+' : ''}{change}%
          </p>
        )}
      </div>
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${iconBg}`}>{icon}</div>
    </div>
  </button>
)

const ChartSkeleton = () => (
  <div className='p-6 md:p-8 w-full bg-gray-50 min-h-full animate-pulse'>
    <div className='h-8 w-48 bg-gray-200 rounded-lg mb-6' />
    <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6'>
      {[1, 2, 3, 4, 5].map((i) => <div key={i} className='h-28 bg-gray-200 rounded-xl' />)}
    </div>
    <div className='grid grid-cols-1 xl:grid-cols-3 gap-6'>
      <div className='xl:col-span-2 h-80 bg-gray-200 rounded-xl' />
      <div className='h-80 bg-gray-200 rounded-xl' />
    </div>
  </div>
)

const getWeekRangeLabel = () => {
  const now = new Date()
  const start = new Date(now)
  start.setDate(now.getDate() - 6)
  const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(start)} – ${fmt(now)}`
}

const AdminDashboardView = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState([])
  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [leads, setLeads] = useState([])
  const [tasks, setTasks] = useState([])
  const [billings, setBillings] = useState([])
  const [leaves, setLeaves] = useState([])

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [empRes, cliRes, projRes, leadRes, taskRes, billRes, leaveRes] = await Promise.all([
          api.get('/employees'),
          api.get('/clients'),
          api.get('/projects'),
          api.get('/leads').catch(() => ({ data: [] })),
          api.get('/tasks').catch(() => ({ data: [] })),
          api.get('/billing').catch(() => ({ data: [] })),
          api.get('/leave').catch(() => ({ data: [] })),
        ])
        const list = (res) => (Array.isArray(res.data) ? res.data : res.data?.data || [])
        setEmployees(list(empRes))
        setClients(list(cliRes))
        setProjects(list(projRes))
        setLeads(list(leadRes))
        setTasks(list(taskRes))
        setBillings(list(billRes))
        setLeaves(list(leaveRes))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const revenue = billings.reduce((s, b) => s + (Number(b.paymentDetails?.amount) || 0), 0)
    const revenueThisMonth = billings
      .filter((b) => isThisMonth(b.paymentDetails?.paymentDate || b.createdAt))
      .reduce((s, b) => s + (Number(b.paymentDetails?.amount) || 0), 0)
    const revenueLastMonth = billings
      .filter((b) => isLastMonth(b.paymentDetails?.paymentDate || b.createdAt))
      .reduce((s, b) => s + (Number(b.paymentDetails?.amount) || 0), 0)

    const newLeadsThisMonth = leads.filter((l) => isThisMonth(l.createdAt)).length
    const newLeadsLastMonth = leads.filter((l) => isLastMonth(l.createdAt)).length
    const openDeals = leads.filter((l) => ['Interested', 'Meeting Schedule', 'Call You After Sometime'].includes(l.status)).length
    const openDealsThisMonth = leads.filter((l) => ['Interested', 'Meeting Schedule'].includes(l.status) && isThisMonth(l.updatedAt || l.createdAt)).length
    const openDealsLastMonth = leads.filter((l) => ['Interested', 'Meeting Schedule'].includes(l.status) && isLastMonth(l.updatedAt || l.createdAt)).length

    const completedTasks = tasks.filter((t) => t.status === 'Completed')
    const completedThisMonth = completedTasks.filter((t) => isThisMonth(t.completedAt || t.updatedAt)).length
    const completedLastMonth = completedTasks.filter((t) => isLastMonth(t.completedAt || t.updatedAt)).length

    const employeesThisMonth = employees.filter((e) => isThisMonth(e.createdAt || e.dateOfJoining)).length
    const employeesLastMonth = employees.filter((e) => isLastMonth(e.createdAt || e.dateOfJoining)).length

    const activeProjects = projects.filter((p) => p.status === 'In Progress').length
    const pendingInvoices = billings.filter((b) => !b.paymentDetails?.amount || Number(b.paymentDetails.amount) === 0).length
    const openTickets = leaves.filter((l) => l.status === 'Pending').length

    const revenueByDay = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(0, 0, 0, 0)
      const next = new Date(d)
      next.setDate(next.getDate() + 1)
      const dayTotal = billings
        .filter((b) => {
          const pd = new Date(b.paymentDetails?.paymentDate || b.createdAt)
          return pd >= d && pd < next
        })
        .reduce((s, b) => s + (Number(b.paymentDetails?.amount) || 0), 0)
      revenueByDay.push({
        day: d.toLocaleDateString('en-IN', { weekday: 'short' }),
        revenue: dayTotal,
        label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      })
    }

    const weekRevenue = revenueByDay.reduce((s, d) => s + d.revenue, 0)
    const weekAvg = Math.round(weekRevenue / Math.max(revenueByDay.length, 1))
    const peakDay = revenueByDay.reduce((best, d) => (d.revenue > best.revenue ? d : best), revenueByDay[0] || { day: '—', revenue: 0 })

    const sourceMap = {}
    leads.forEach((l) => {
      const src = (l.leadSource || 'Other').trim() || 'Other'
      sourceMap[src] = (sourceMap[src] || 0) + 1
    })
    const leadsBySource = Object.entries(sourceMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const taskStatusMap = { Completed: 0, 'In Progress': 0, Pending: 0, Cancelled: 0 }
    tasks.forEach((t) => {
      const s = taskStatusMap[t.status] !== undefined ? t.status : 'Pending'
      taskStatusMap[s] += 1
    })
    const taskChart = Object.entries(taskStatusMap)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value, color: TASK_COLORS[name] || '#94A3B8' }))

    const leadCountByEmployee = {}
    leads.forEach((l) => {
      const id = l.generatedBy?._id || l.generatedBy
      if (!id) return
      const key = String(id)
      if (!leadCountByEmployee[key]) {
        leadCountByEmployee[key] = {
          employee: typeof l.generatedBy === 'object' ? l.generatedBy : employees.find((e) => String(e._id) === key),
          count: 0,
        }
      }
      leadCountByEmployee[key].count += 1
    })
    const topEmployees = Object.values(leadCountByEmployee)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item) => ({
        name: item.employee?.name || 'Employee',
        designation: item.employee?.designation?.title || item.employee?.department || '—',
        count: item.count,
        value: item.count * 50000,
      }))

    const activities = [
      ...projects.map((p) => ({ type: 'Project', icon: '📁', title: `Project "${p.projectName}" updated`, date: p.updatedAt || p.createdAt, path: `/projects?focus=${p._id}` })),
      ...clients.map((c) => ({ type: 'Client', icon: '🏢', title: `Client "${c.clientName}" added`, date: c.createdAt, path: `/clients?focus=${c._id}` })),
      ...employees.map((e) => ({ type: 'Employee', icon: '👤', title: `Employee "${e.name}" joined`, date: e.createdAt || e.dateOfJoining, path: `/employees/${e._id}/profile` })),
      ...leads.map((l) => ({ type: 'Lead', icon: '🎯', title: `New lead "${l.businessName || l.name}"`, date: l.createdAt, path: `/leads/view/${l._id}` })),
      ...tasks.filter((t) => t.status === 'Completed').map((t) => ({ type: 'Task', icon: '✅', title: `Task completed: ${t.title}`, date: t.completedAt || t.updatedAt, path: '/tasks' })),
    ]
      .filter((a) => a.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 8)

    const spark = (arr) => arr.map((_, i) => Math.max(1, i + 2))

    return {
      revenue,
      revenueGrowth: growthPct(revenueThisMonth, revenueLastMonth),
      employeeGrowth: growthPct(employeesThisMonth, employeesLastMonth),
      leadGrowth: growthPct(newLeadsThisMonth, newLeadsLastMonth),
      dealGrowth: growthPct(openDealsThisMonth, openDealsLastMonth),
      taskGrowth: growthPct(completedThisMonth, completedLastMonth),
      newLeadsThisMonth,
      openDeals,
      completedTasks: completedTasks.length,
      activeProjects,
      pendingInvoices,
      openTickets,
      revenueByDay,
      weekRevenue,
      weekAvg,
      peakDay,
      leadsBySource,
      taskChart,
      topEmployees,
      activities,
      sparks: {
        users: spark(employees),
        revenue: revenueByDay.map((d) => d.revenue),
        leads: spark(leads),
        deals: spark([openDeals]),
        tasks: spark(completedTasks),
      },
    }
  }, [employees, clients, projects, leads, tasks, billings, leaves])

  if (loading) return <ChartSkeleton />

  const firstName = (user?.name || 'Admin').split(' ')[0]

  return (
    <div className='p-6 md:p-8 w-full bg-gray-50 min-h-full'>
      <div className='flex flex-wrap items-start justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900 tracking-tight'>Dashboard</h1>
          <p className='text-gray-600 mt-1 text-sm'>Welcome back, {firstName}! Here&apos;s your organization overview.</p>
        </div>
        <div className='text-sm text-gray-600 bg-white border border-gray-200 rounded-lg px-4 py-2 shadow-sm'>
          <span className='text-gray-400 text-xs block'>Reporting period</span>
          {getWeekRangeLabel()}
        </div>
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6'>
        <KpiCard title='Total Users' value={employees.length} change={stats.employeeGrowth} positive={stats.employeeGrowth >= 0} icon='👥' iconBg='bg-violet-50' sparkData={stats.sparks.users} sparkColor='#7C3AED' onClick={() => navigate('/employees')} />
        <KpiCard title='Total Revenue' value={formatINR(stats.revenue)} change={stats.revenueGrowth} positive={stats.revenueGrowth >= 0} icon='💰' iconBg='bg-emerald-50' sparkData={stats.sparks.revenue} sparkColor='#059669' onClick={() => navigate('/revenue')} />
        <KpiCard title='New Leads' value={stats.newLeadsThisMonth} change={stats.leadGrowth} positive={stats.leadGrowth >= 0} icon='🎯' iconBg='bg-amber-50' sparkData={stats.sparks.leads} sparkColor='#D97706' onClick={() => navigate('/leads')} />
        <KpiCard title='Open Deals' value={stats.openDeals} change={stats.dealGrowth} positive={stats.dealGrowth >= 0} icon='💼' iconBg='bg-blue-50' sparkData={stats.sparks.deals} sparkColor='#2563EB' onClick={() => navigate('/lead-management')} />
        <KpiCard title='Tasks Completed' value={stats.completedTasks} change={stats.taskGrowth} positive={stats.taskGrowth >= 0} icon='✅' iconBg='bg-pink-50' sparkData={stats.sparks.tasks} sparkColor='#DB2777' onClick={() => navigate('/tasks')} />
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6'>
        <Panel
          title='Revenue Overview'
          subtitle={`${formatINR(stats.weekRevenue)} this week · avg ${formatCompactINR(stats.weekAvg)}/day`}
          className='xl:col-span-2'
          actionLabel='View Revenue'
          onAction={() => navigate('/revenue')}
        >
          <div className='grid grid-cols-3 gap-3 mb-4'>
            <div className='rounded-lg bg-blue-50/80 border border-blue-100 px-3 py-2.5'>
              <p className='text-[10px] uppercase tracking-wide text-blue-600 font-semibold'>Week Total</p>
              <p className='text-lg font-bold text-gray-900 mt-0.5'>{formatCompactINR(stats.weekRevenue)}</p>
            </div>
            <div className='rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5'>
              <p className='text-[10px] uppercase tracking-wide text-slate-500 font-semibold'>Daily Avg</p>
              <p className='text-lg font-bold text-gray-900 mt-0.5'>{formatCompactINR(stats.weekAvg)}</p>
            </div>
            <div className='rounded-lg bg-emerald-50/80 border border-emerald-100 px-3 py-2.5'>
              <p className='text-[10px] uppercase tracking-wide text-emerald-600 font-semibold'>Peak Day</p>
              <p className='text-lg font-bold text-gray-900 mt-0.5 truncate'>{stats.peakDay?.day}</p>
            </div>
          </div>
          <div className='h-56 -mx-1'>
            <ResponsiveContainer width='100%' height='100%'>
              <AreaChart data={stats.revenueByDay} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id='revenueGrad' x1='0' y1='0' x2='0' y2='1'>
                    <stop offset='0%' stopColor='#2563EB' stopOpacity={0.35} />
                    <stop offset='95%' stopColor='#2563EB' stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray='4 4' stroke='#E2E8F0' vertical={false} />
                <XAxis dataKey='day' tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} dy={8} />
                <YAxis tickFormatter={formatCompactINR} tick={{ fontSize: 11, fill: '#64748B' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip
                  content={(
                    <ChartTooltip
                      valueFormatter={(v) => formatINR(v)}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.label}
                    />
                  )}
                  cursor={{ stroke: '#2563EB', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                  type='monotone'
                  dataKey='revenue'
                  stroke='#2563EB'
                  fill='url(#revenueGrad)'
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#2563EB', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 5, fill: '#3B82F6', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel title='Leads by Source' subtitle={`${leads.length} total leads`} actionLabel='View Leads' onAction={() => navigate('/leads')}>
          {stats.leadsBySource.length ? (
            <DonutChart
              data={stats.leadsBySource}
              total={leads.length}
              centerValue={leads.length}
              centerLabel='Total Leads'
              colors={CHART_COLORS}
            />
          ) : (
            <div className='flex flex-col items-center justify-center py-14 text-center'>
              <div className='w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl mb-3'>🎯</div>
              <p className='text-sm font-medium text-gray-700'>No lead data yet</p>
              <p className='text-xs text-gray-400 mt-1'>Leads will appear here once added</p>
            </div>
          )}
        </Panel>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6'>
        <Panel title='Recent Activities'>
          <div className='space-y-1 max-h-80 overflow-y-auto pr-1'>
            {stats.activities.length ? stats.activities.map((a, i) => (
              <button key={`${a.type}-${i}`} type='button' onClick={() => navigate(a.path)} className='w-full flex gap-3 text-left hover:bg-slate-50 rounded-xl p-2.5 transition-colors border border-transparent hover:border-slate-100'>
                <span className='w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-base shrink-0'>{a.icon}</span>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-medium text-gray-900 line-clamp-2'>{a.title}</p>
                  <p className='text-xs text-gray-400 mt-0.5'>{timeAgo(a.date)}</p>
                </div>
              </button>
            )) : (
              <p className='text-sm text-gray-500 text-center py-6'>No recent activity</p>
            )}
          </div>
        </Panel>

        <Panel title='Top Performing Employees' actionLabel='View All' onAction={() => navigate('/employees')}>
          <div className='space-y-3'>
            {stats.topEmployees.length ? stats.topEmployees.map((e, i) => (
              <div key={e.name + i} className='flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors'>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                  {i + 1}
                </span>
                <div className='w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm'>
                  {e.name.charAt(0)}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-semibold text-gray-900 truncate'>{e.name}</p>
                  <p className='text-xs text-gray-500 truncate'>{e.designation}</p>
                </div>
                <div className='text-right shrink-0'>
                  <p className='text-xs font-bold text-gray-900'>{formatCompactINR(e.value)}</p>
                  <p className='text-[10px] text-emerald-600 font-medium'>{e.count} leads</p>
                </div>
              </div>
            )) : (
              <p className='text-sm text-gray-500 text-center py-6'>No performance data yet</p>
            )}
          </div>
        </Panel>

        <Panel title='Tasks Overview' subtitle={`${tasks.length} total tasks`} actionLabel='View All' onAction={() => navigate('/tasks')}>
          {stats.taskChart.length ? (
            <DonutChart
              data={stats.taskChart}
              total={tasks.length}
              centerValue={tasks.length}
              centerLabel='Total Tasks'
              colors={stats.taskChart.map((d) => d.color)}
            />
          ) : (
            <div className='flex flex-col items-center justify-center py-14 text-center'>
              <div className='w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-2xl mb-3'>✅</div>
              <p className='text-sm font-medium text-gray-700'>No tasks yet</p>
              <p className='text-xs text-gray-400 mt-1'>Task breakdown will show here</p>
            </div>
          )}
        </Panel>
      </div>

      <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4'>
        <MiniStat title='Total Projects' value={projects.length} change={growthPct(projects.filter((p) => isThisMonth(p.createdAt)).length, projects.filter((p) => isLastMonth(p.createdAt)).length)} icon='📁' iconBg='bg-violet-50' onClick={() => navigate('/projects')} />
        <MiniStat title='Active Projects' value={stats.activeProjects} change={8.4} icon='🚀' iconBg='bg-emerald-50' onClick={() => navigate('/projects')} />
        <MiniStat title='Total Clients' value={clients.length} change={growthPct(clients.filter((c) => isThisMonth(c.createdAt)).length, clients.filter((c) => isLastMonth(c.createdAt)).length)} icon='🏢' iconBg='bg-indigo-50' onClick={() => navigate('/clients')} />
        <MiniStat title='Pending Leave' value={stats.openTickets} change={-5.6} icon='🎫' iconBg='bg-amber-50' onClick={() => navigate('/leave')} />
        <MiniStat title='Pending Invoices' value={stats.pendingInvoices} change={7.3} icon='📄' iconBg='bg-blue-50' onClick={() => navigate('/billings')} />
      </div>
    </div>
  )
}

export default AdminDashboardView
