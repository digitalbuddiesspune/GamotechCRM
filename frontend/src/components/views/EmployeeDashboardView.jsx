import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import {
  formatTaskDuration,
  getTaskRemainingMinutes,
  getTaskStatusColor,
  normalizeTaskStatus,
} from '../../utils/taskStatus'

const KpiCard = ({ title, value, subtitle, icon, color, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    className={`text-left bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow w-full min-w-0 ${onClick ? 'cursor-pointer' : ''}`}
  >
    <div className='flex items-center justify-between gap-2'>
      <div className='min-w-0 flex-1'>
        <p className='text-sm text-gray-500 font-medium truncate'>{title}</p>
        <div className='flex items-baseline gap-2 mt-1 min-w-0'>
          <span className='text-2xl font-bold text-gray-900 tabular-nums leading-none shrink-0'>{value}</span>
          {subtitle && <span className='text-xs text-gray-500 truncate'>{subtitle}</span>}
        </div>
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${color}`}>{icon}</div>
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

const leadStatusClass = (status) => {
  if (status === 'Interested') return 'bg-orange-100 text-orange-700'
  if (status === 'Meeting Schedule') return 'bg-blue-100 text-blue-700'
  if (status === 'Call not Received') return 'bg-green-100 text-green-700'
  if (status === 'Not Interested') return 'bg-gray-100 text-gray-600'
  return 'bg-purple-100 text-purple-700'
}

const leadStatusLabel = (status) => {
  if (status === 'Call not Received') return 'New'
  if (status === 'Call You After Sometime') return 'Follow-up'
  if (status === 'Meeting Schedule') return 'Meeting'
  return status || 'Lead'
}

const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatTime = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

const getWeekRangeLabel = (date = new Date()) => {
  const start = new Date(date)
  const day = start.getDay()
  const diff = day === 0 ? -6 : 1 - day
  start.setDate(start.getDate() + diff)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
}

const localYmd = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const isSameDay = (a, b) => {
  const d1 = new Date(a)
  const d2 = new Date(b)
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate()
}

const startOfDay = (date = new Date()) => {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

const isPastDay = (date, ref = new Date()) => {
  if (!date) return false
  return startOfDay(date) < startOfDay(ref)
}

const isIncompleteTask = (task) => ['Pending', 'In Progress', 'Paused'].includes(task?.status)

const isThisMonth = (d, ref = new Date()) => {
  if (!d) return false
  const dt = new Date(d)
  return dt.getMonth() === ref.getMonth() && dt.getFullYear() === ref.getFullYear()
}

const getProjectName = (task) => {
  if (!task?.project) return 'General'
  if (typeof task.project === 'object') return task.project.projectName || task.project.name || 'Project'
  return 'Project'
}

const isRealTask = (task) => task?._id && !String(task._id).startsWith('social-media-')

const StarDisplay = ({ score, size = 'sm' }) => {
  const s = Number(score) || 0
  if (!s) return null
  const textSize = size === 'lg' ? 'text-xl' : 'text-sm'
  return (
    <span className={`inline-flex items-center gap-0.5 text-amber-500 font-semibold ${textSize}`} title={`${s}/5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= s ? 'text-amber-400' : 'text-gray-300'}>★</span>
      ))}
      <span className='text-gray-600 font-medium ml-1'>{s}/5</span>
    </span>
  )
}

const formatCountdown = (totalSeconds) => {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return '—'
  const sec = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const getRemainingSeconds = (task, nowMs = Date.now()) => {
  const estimated = Number(task?.estimatedDurationMinutes)
  if (!Number.isFinite(estimated) || estimated <= 0) return null
  const status = normalizeTaskStatus(task?.status)
  if ((status === 'In Progress' || status === 'Paused') && task?.startedAt) {
    const startedMs = new Date(task.startedAt).getTime()
    if (Number.isNaN(startedMs)) return estimated * 60
    const endMs =
      status === 'Paused' && task?.pausedAt
        ? new Date(task.pausedAt).getTime()
        : nowMs
    const refMs = Number.isNaN(endMs) ? nowMs : endMs
    const elapsedSec = Math.floor((refMs - startedMs) / 1000)
    return Math.max(0, estimated * 60 - elapsedSec)
  }
  return estimated * 60
}

const pickCurrentTask = (taskList = []) => {
  const real = (Array.isArray(taskList) ? taskList : []).filter(isRealTask)
  const byPriority = (status) =>
    real
      .filter((t) => normalizeTaskStatus(t.status) === status)
      .sort((a, b) => new Date(b.startedAt || b.updatedAt || 0) - new Date(a.startedAt || a.updatedAt || 0))
  return byPriority('In Progress')[0] || byPriority('Paused')[0] || null
}

const CurrentTaskTimer = ({ task, onOpen }) => {
  const [nowMs, setNowMs] = useState(Date.now())
  const status = normalizeTaskStatus(task?.status)
  const isLive = status === 'In Progress'

  useEffect(() => {
    if (!task || !isLive) return undefined
    const id = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(id)
  }, [task?._id, isLive])

  if (!task) {
    return (
      <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full'>
        <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100'>
          <h3 className='text-sm font-semibold text-gray-900'>Current Task Timer</h3>
        </div>
        <div className='p-8 text-center'>
          <p className='text-4xl font-bold tabular-nums text-gray-300'>--:--</p>
          <p className='text-sm text-gray-500 mt-3'>No task in progress</p>
          <p className='text-xs text-gray-400 mt-1'>Start a task from My Tasks to see the remaining timer here.</p>
        </div>
      </div>
    )
  }

  const remainingSec = getRemainingSeconds(task, nowMs)
  const remainingMins = getTaskRemainingMinutes(task, nowMs)
  const estimated = Number(task.estimatedDurationMinutes) || 0
  const elapsedMins =
    estimated > 0 && remainingMins != null ? Math.max(0, estimated - remainingMins) : null
  const progressPct =
    estimated > 0 && remainingMins != null
      ? Math.min(100, Math.round((elapsedMins / estimated) * 100))
      : 0
  const overtime = remainingSec === 0 && status === 'In Progress'

  return (
    <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full'>
      <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100 gap-2'>
        <h3 className='text-sm font-semibold text-gray-900'>Current Task Timer</h3>
        <button type='button' onClick={onOpen} className='text-xs font-medium text-blue-600 hover:text-blue-700 shrink-0'>
          Open Task
        </button>
      </div>
      <div className='p-5'>
        <div className='flex flex-wrap items-center gap-2 mb-3'>
          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${getTaskStatusColor(status)}`}>
            {status || task.status}
          </span>
          {task.priority ? (
            <span className='text-xs font-medium text-gray-500'>{task.priority} priority</span>
          ) : null}
        </div>
        <p className='text-sm font-semibold text-gray-900 line-clamp-2'>{task.title}</p>
        <p className='text-xs text-gray-500 mt-1'>{getProjectName(task)}</p>

        <div className='mt-6 text-center'>
          <p className='text-[11px] uppercase tracking-wide text-gray-400 font-medium mb-1'>
            {overtime ? 'Time up' : status === 'Paused' ? 'Time remaining (paused)' : 'Time remaining'}
          </p>
          <p
            className={`text-4xl sm:text-5xl font-bold tabular-nums tracking-tight ${
              overtime ? 'text-red-600' : status === 'Paused' ? 'text-violet-700' : 'text-blue-700'
            }`}
          >
            {formatCountdown(remainingSec)}
          </p>
          {remainingMins != null ? (
            <p className='text-xs text-gray-500 mt-2'>
              {formatTaskDuration(remainingMins) || '0m'} left
              {estimated ? ` of ${formatTaskDuration(estimated) || `${estimated}m`} estimate` : ''}
            </p>
          ) : (
            <p className='text-xs text-gray-500 mt-2'>No time estimate set for this task</p>
          )}
        </div>

        {estimated > 0 && (
          <div className='mt-5'>
            <div className='h-2 rounded-full bg-gray-100 overflow-hidden'>
              <div
                className={`h-full rounded-full transition-all ${overtime ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${Math.min(100, progressPct)}%` }}
              />
            </div>
            <div className='flex justify-between text-[11px] text-gray-400 mt-1.5'>
              <span>Elapsed {formatTaskDuration(elapsedMins) || '0m'}</span>
              <span>{progressPct}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const PerformanceRing = ({ percent }) => {
  const p = Math.min(100, Math.max(0, percent))
  const r = 52
  const c = 2 * Math.PI * r
  const offset = c - (p / 100) * c
  return (
    <div className='relative w-36 h-36 mx-auto'>
      <svg className='w-full h-full -rotate-90' viewBox='0 0 120 120'>
        <circle cx='60' cy='60' r={r} fill='none' stroke='#e5e7eb' strokeWidth='10' />
        <circle
          cx='60'
          cy='60'
          r={r}
          fill='none'
          stroke='#10b981'
          strokeWidth='10'
          strokeLinecap='round'
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className='absolute inset-0 flex flex-col items-center justify-center'>
        <span className='text-2xl font-bold text-gray-900'>{Math.round(p)}%</span>
        <span className='text-xs text-gray-500'>Target Achieved</span>
      </div>
    </div>
  )
}

const EmployeeDashboardView = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState([])
  const [myLeads, setMyLeads] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const now = new Date()
  const firstName = (user?.name || 'there').split(' ')[0]
  const designation = user?.designation?.title || user?.designation?.name || 'Employee'

  useEffect(() => {
    const load = async () => {
      if (!user?._id) return
      try {
        setLoading(true)
        const [tasksRes, leadsRes, announcementsRes] = await Promise.all([
          api.get('/tasks', { params: { employeeId: user._id } }),
          api.get('/leads').catch(() => ({ data: [] })),
          api.get('/announcements', { params: { active: 'true' } }).catch(() => ({ data: [] })),
        ])
        setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : [])
        const allLeads = Array.isArray(leadsRes.data) ? leadsRes.data : []
        const related = allLeads.filter((l) => {
          const generatedById = l.generatedBy?._id || l.generatedBy
          const meetingPerson = (l.meetingPersonName || '').toLowerCase()
          const userName = (user?.name || '').toLowerCase()
          return String(generatedById) === String(user._id) || (meetingPerson && meetingPerson === userName)
        })
        setMyLeads(related)
        const list = Array.isArray(announcementsRes.data) ? announcementsRes.data : []
        setAnnouncements(list.slice(0, 5))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?._id, user?.name])

  const stats = useMemo(() => {
    const pendingTasks = tasks.filter((t) => isIncompleteTask(t))
    const todaysTasks = pendingTasks.filter((t) => t.dueDate && isSameDay(t.dueDate, now))
    const pastIncompleteTasks = pendingTasks
      .filter((t) => t.dueDate && isPastDay(t.dueDate, now))
      .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    const completedTasks = tasks.filter((t) => t.status === 'Completed')
    const completedThisMonth = completedTasks.filter((t) => isThisMonth(t.completedAt || t.updatedAt, now))
    const openDeals = myLeads.filter((l) => ['Interested', 'Meeting Schedule', 'Call You After Sometime'].includes(l.status))
    const meetingsToday = myLeads.filter(
      (l) => l.status === 'Meeting Schedule' && l.meetingTime && isSameDay(l.meetingTime, now)
    )

    const currentTask = pickCurrentTask(tasks)

    const todaySchedule = [
      ...meetingsToday.map((m) => ({
        id: m._id,
        time: m.meetingTime,
        title: m.businessName || m.name,
        subtitle: `${m.meetingType || 'Meeting'} · ${m.meetingPersonName || 'Client'}`,
        duration: '60 min',
        color: 'bg-blue-500',
        path: `/leads/view/${m._id}`,
      })),
      ...tasks
        .filter((t) => t.dueDate && isSameDay(t.dueDate, now) && t.status !== 'Completed')
        .map((t) => ({
          id: t._id,
          time: t.dueDate,
          title: t.title,
          subtitle: getProjectName(t),
          duration: 'Task',
          color: 'bg-purple-500',
          path: `/my-tasks/${t._id}`,
        })),
    ].sort((a, b) => new Date(a.time) - new Date(b.time))

    const recentLeads = [...myLeads]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 5)

    const monthlyTarget = pendingTasks.length + completedThisMonth.length
    const performancePct = monthlyTarget ? (completedThisMonth.length / monthlyTarget) * 100 : 0

    const ratedTasks = tasks
      .filter((t) => isRealTask(t) && t.rating?.score)
      .sort((a, b) => new Date(b.rating?.ratedAt || b.updatedAt) - new Date(a.rating?.ratedAt || a.updatedAt))

    const ratingScores = ratedTasks.map((t) => Number(t.rating.score)).filter((s) => s > 0)
    const avgRating = ratingScores.length
      ? Math.round((ratingScores.reduce((a, b) => a + b, 0) / ratingScores.length) * 10) / 10
      : null

    return {
      pendingTasks,
      todaysTasks,
      pastIncompleteTasks,
      completedTasks,
      completedThisMonth,
      openDeals,
      meetingsToday,
      currentTask,
      todaySchedule,
      recentLeads,
      performancePct,
      ratedTasks,
      avgRating,
      followUps: myLeads.reduce((sum, l) => sum + (Array.isArray(l.followUps) ? l.followUps.length : 0), 0),
      dealsClosed: myLeads.filter((l) => l.meetingInfoSent === true).length,
    }
  }, [tasks, myLeads, now])

  const announcementIcons = { urgent: '🚨', high: '📢', normal: 'ℹ️' }

  if (loading) {
    return <div className='p-8 text-sm text-gray-600'>Loading your dashboard...</div>
  }

  return (
    <div className='p-6 md:p-8 w-full bg-gray-50 min-h-full'>
      <div className='flex flex-wrap items-start justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Welcome back, {firstName}! 👋</h1>
          <p className='text-gray-600 mt-1 text-sm'>Here&apos;s what&apos;s happening with your work today.</p>
          <p className='text-xs text-gray-400 mt-1'>{designation}</p>
        </div>
        <div className='text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-4 py-2'>
          {getWeekRangeLabel(now)}
        </div>
      </div>

      <div className='grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6'>
        <KpiCard title='My Tasks' value={stats.todaysTasks.length} subtitle="Today's Tasks" icon='📋' color='bg-blue-50' onClick={() => navigate(`/my-tasks?date=${localYmd(now)}`)} />
        <KpiCard title='Past Tasks' value={stats.pastIncompleteTasks.length} subtitle='Not Completed' icon='⏳' color='bg-red-50' onClick={() => navigate('/my-tasks?status=Delayed')} />
        <KpiCard title='Tasks Completed' value={stats.completedThisMonth.length} subtitle='This Month' icon='✅' color='bg-green-50' onClick={() => navigate('/my-tasks?status=Completed')} />
        <KpiCard title='My Leads' value={myLeads.length} subtitle='Total Leads' icon='🎯' color='bg-purple-50' onClick={() => navigate('/lead-management')} />
        <KpiCard title='My Deals' value={stats.openDeals.length} subtitle='Open Deals' icon='💼' color='bg-orange-50' onClick={() => navigate('/lead-management')} />
        <KpiCard title='Meetings Today' value={stats.meetingsToday.length} subtitle='Scheduled' icon='📅' color='bg-cyan-50' onClick={() => navigate('/lead-management')} />
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6'>
        <Panel title='My Performance'>
          <PerformanceRing percent={stats.performancePct} />
          <div className='mt-5 space-y-2'>
            {[
              ['Leads Assigned', myLeads.length],
              ['Deals Closed', stats.dealsClosed],
              ['Tasks Done (Month)', stats.completedThisMonth.length],
              ['Pending Tasks', stats.pendingTasks.length],
              ['Avg Task Rating', stats.avgRating != null ? `${stats.avgRating}/5` : '—'],
              ['Rated Tasks', stats.ratedTasks.length],
            ].map(([label, value]) => (
              <div key={label} className='flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0'>
                <span className='text-gray-600'>{label}</span>
                <span className='font-semibold text-gray-900'>{value}</span>
              </div>
            ))}
          </div>
        </Panel>

        <CurrentTaskTimer
          task={stats.currentTask}
          onOpen={() => {
            if (!stats.currentTask?._id) {
              navigate('/my-tasks')
              return
            }
            navigate(`/my-tasks/${stats.currentTask._id}`)
          }}
        />

        <Panel title="Today's Schedule" actionLabel='Add Meeting' onAction={() => navigate('/add-lead?meeting=1')}>
          {stats.todaySchedule.length ? (
            <div className='space-y-4'>
              {stats.todaySchedule.map((item) => (
                <button
                  key={item.id}
                  type='button'
                  onClick={() => navigate(item.path)}
                  className='w-full flex gap-3 text-left group'
                >
                  <div className='flex flex-col items-center'>
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color} ring-4 ring-white`} />
                    <span className='w-px flex-1 bg-gray-200 min-h-[2rem]' />
                  </div>
                  <div className='pb-4 flex-1 group-hover:bg-gray-50 rounded-lg px-2 -mx-2 py-1'>
                    <p className='text-xs font-semibold text-blue-600'>{formatTime(item.time)}</p>
                    <p className='text-sm font-medium text-gray-900'>{item.title}</p>
                    <p className='text-xs text-gray-500'>{item.subtitle}</p>
                    <p className='text-[10px] text-gray-400 mt-0.5'>{item.duration}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className='text-sm text-gray-500 py-8 text-center'>No meetings or tasks scheduled for today</p>
          )}
        </Panel>
      </div>

      <div className='grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6'>
        <Panel title='Recent Leads' actionLabel='View All' onAction={() => navigate('/lead-management')}>
          <div className='space-y-3'>
            {stats.recentLeads.length ? stats.recentLeads.map((lead) => (
              <button
                key={lead._id}
                type='button'
                onClick={() => navigate(`/leads/view/${lead._id}`)}
                className='w-full flex items-center gap-3 text-left hover:bg-gray-50 rounded-lg p-2 -mx-2'
              >
                <div className='w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0'>
                  {(lead.businessName || lead.name || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-semibold text-gray-900 truncate'>{lead.businessName || lead.name}</p>
                  <p className='text-xs text-gray-500 truncate'>{lead.businessType || lead.city || 'Lead'}</p>
                </div>
                <div className='text-right shrink-0'>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${leadStatusClass(lead.status)}`}>
                    {leadStatusLabel(lead.status)}
                  </span>
                  <p className='text-[10px] text-gray-400 mt-1'>{formatDate(lead.createdAt)}</p>
                </div>
              </button>
            )) : (
              <p className='text-sm text-gray-500 py-6 text-center'>No leads yet</p>
            )}
          </div>
        </Panel>

        <Panel title='Task Ratings' actionLabel='My Tasks' onAction={() => navigate('/my-tasks')}>
          <div className='space-y-3 max-h-80 overflow-y-auto'>
            {stats.ratedTasks.length ? stats.ratedTasks.slice(0, 6).map((task) => (
              <button
                key={task._id}
                type='button'
                onClick={() => navigate(`/my-tasks/${task._id}`)}
                className='w-full text-left p-3 rounded-lg border border-amber-100 bg-amber-50/40 hover:bg-amber-50 transition-colors'
              >
                <div className='flex items-start justify-between gap-2'>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-semibold text-gray-900 truncate'>{task.title}</p>
                    <p className='text-xs text-gray-500 truncate mt-0.5'>{getProjectName(task)}</p>
                  </div>
                  <StarDisplay score={task.rating.score} />
                </div>
                {task.rating.comments && (
                  <p className='text-xs text-gray-600 mt-2 line-clamp-2'>&ldquo;{task.rating.comments}&rdquo;</p>
                )}
                <p className='text-[10px] text-gray-400 mt-2'>
                  Rated by {task.rating.ratedBy?.name || task.assignedBy?.name || 'Manager'}
                  {task.rating.ratedAt ? ` · ${formatDate(task.rating.ratedAt)}` : ''}
                </p>
              </button>
            )) : (
              <p className='text-sm text-gray-500 py-6 text-center'>
                No task ratings yet. Complete tasks to receive feedback from your manager.
              </p>
            )}
          </div>
        </Panel>

        <Panel title='Announcements' actionLabel='View All' onAction={() => navigate('/module/announcements')}>
          <div className='space-y-4'>
            {announcements.length ? announcements.map((item) => (
              <button
                key={item._id}
                type='button'
                onClick={() => navigate('/module/announcements')}
                className='w-full flex gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0 text-left hover:bg-gray-50 rounded-lg -mx-1 px-1'
              >
                <span className='text-xl shrink-0'>{announcementIcons[item.priority] || '📢'}</span>
                <div className='min-w-0'>
                  <p className='text-sm font-semibold text-gray-900 truncate'>
                    {item.pinned ? '📌 ' : ''}{item.title}
                  </p>
                  <p className='text-xs text-gray-500 mt-0.5 line-clamp-2'>{item.message}</p>
                  <p className='text-[10px] text-gray-400 mt-1'>{formatDate(item.publishedAt || item.createdAt)}</p>
                </div>
              </button>
            )) : (
              <p className='text-sm text-gray-500 py-6 text-center'>No announcements right now</p>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}

export default EmployeeDashboardView
