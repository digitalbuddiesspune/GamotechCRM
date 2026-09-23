import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  formatTaskDuration,
  getEditableStatusOptions,
  getTaskRemainingMinutes,
  getTaskStatusColor,
  hasOpenUrgentTask,
  normalizeTaskStatus,
  taskStatusToSocialStatus,
} from '../../utils/taskStatus'

const VALID_STATUSES = ['All', 'Pending', 'In Progress', 'Paused', 'Completed', 'Cancelled', 'Delayed']

const parseStatusParam = (raw) => {
  if (!raw) return null
  const decoded = decodeURIComponent(String(raw).replace(/\+/g, ' ')).trim()
  return VALID_STATUSES.includes(decoded) ? decoded : null
}

const TaskStatCard = ({ title, value, subtitle, icon, color, accentClass, onClick }) => (
  <button
    type='button'
    onClick={onClick}
    className={`text-left bg-white rounded-xl border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow w-full min-w-0 border-t-[3px] ${accentClass} ${onClick ? 'cursor-pointer' : ''}`}
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

const formatShortName = (name) => {
  if (!name || typeof name !== 'string') return '—'
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '—'
  if (parts.length === 1) return parts[0]
  const firstName = parts[0]
  const surname = parts[parts.length - 1]
  return `${firstName} ${surname}`
}

const PersonShortName = ({ name }) => (
  <span className='text-sm text-gray-900 font-medium whitespace-nowrap' title={name || undefined}>
    {formatShortName(name)}
  </span>
)

const localYmd = (d) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * True if task dueDate falls on the same calendar day as filterYmd (YYYY-MM-DD from date input).
 * Checks both UTC date (how date-only form values are stored) and local date (scheduled times).
 */
const matchesDueDateFilter = (dueDateVal, filterYmd) => {
  if (!filterYmd) return true
  if (dueDateVal == null || dueDateVal === '') return false
  const d = new Date(dueDateVal)
  if (Number.isNaN(d.getTime())) return false
  const utcKey = d.toISOString().slice(0, 10)
  const localKey = localYmd(d)
  return utcKey === filterYmd || localKey === filterYmd
}

const TasksView = ({ isMyTasks = false }) => {
  const { user, canAssignTask } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState(() => parseStatusParam(searchParams.get('status')) || 'All')
  const [filterDate, setFilterDate] = useState(() =>
    searchParams.has('date') ? searchParams.get('date') || '' : ''
  )
  const [filterAssignee, setFilterAssignee] = useState('')
  const [projects, setProjects] = useState([])
  const [employees, setEmployees] = useState([])
  const navigate = useNavigate()

  // Sync filters when URL search params change (e.g. dashboard links with ?date=&status=)
  useEffect(() => {
    if (searchParams.has('status')) {
      setFilterStatus(parseStatusParam(searchParams.get('status')) || 'All')
    } else {
      setFilterStatus('All')
    }
    if (searchParams.has('date')) {
      setFilterDate(searchParams.get('date') || '')
    } else {
      setFilterDate('')
    }
  }, [searchParams])

  const clearAllFilters = () => {
    setFilterStatus('All')
    setFilterDate('')
    setFilterProject('')
    setFilterAssignee('')
    const next = new URLSearchParams(searchParams)
    next.delete('status')
    next.delete('date')
    setSearchParams(next, { replace: true })
  }

  const fetchTasks = async () => {
    try {
      const params = {}
      if (isMyTasks && user?._id) {
        params.employeeId = user._id
      } else if (canAssignTask()) {
        if (filterProject) params.projectId = filterProject
        if (filterAssignee) params.employeeId = filterAssignee
      } else if (user?._id) {
        params.employeeId = user._id
      }
      const res = await api.get('/tasks', { params })
      setTasks(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Failed to fetch tasks:', err)
      setTasks([])
    } finally {
      setLoading(false)
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await api.get('/projects')
      const list = Array.isArray(res.data) ? res.data : res.data?.data || res.data?.projects || []
      setProjects(Array.isArray(list) ? list : [])
    } catch (err) {
      console.error('Failed to fetch projects:', err)
    }
  }

  const canAssign = canAssignTask()

  useEffect(() => {
    if (canAssign || user?._id) fetchTasks()
  }, [filterProject, filterAssignee, canAssign, user?._id, isMyTasks])

  useEffect(() => {
    if (canAssign && !isMyTasks) {
      fetchProjects()
      const fetchEmployees = async () => {
        try {
          const res = await api.get('/employees')
          const list = Array.isArray(res.data) ? res.data : res.data?.data || []
          setEmployees(Array.isArray(list) ? list : [])
        } catch (err) {
          console.error('Failed to fetch employees:', err)
        }
      }
      fetchEmployees()
    }
  }, [canAssign, isMyTasks])

  const isDelayed = (t) => {
    if (!t?.dueDate) return false
    const status = normalizeTaskStatus(t.status)
    return new Date(t.dueDate) < new Date() && status !== 'Completed' && status !== 'Cancelled'
  }

  const tasksForStats = tasks.filter((t) => {
    if ((isMyTasks || !canAssignTask()) && filterProject) {
      const projectId = t.project?._id || t.project
      if (projectId !== filterProject) return false
    }
    if (filterDate && !matchesDueDateFilter(t.dueDate, filterDate)) return false
    return true
  })

  const filteredTasks = tasksForStats.filter((t) => {
    if (filterStatus === 'Delayed') {
      if (!isDelayed(t)) return false
    } else if (filterStatus !== 'All') {
      if (normalizeTaskStatus(t.status) !== filterStatus) return false
    }
    return true
  })

  const uniqueProjectsFromTasks = Array.from(
    new Map(
      tasks
        .filter((t) => t.project)
        .map((t) => {
          const p = t.project
          const id = p._id || p
          return [id, { _id: id, projectName: p.projectName || 'Project' }]
        })
    ).values()
  )

  const totalTasks = tasksForStats.length
  const completedTasks = tasksForStats.filter((t) => normalizeTaskStatus(t.status) === 'Completed').length
  const inProgressTasks = tasksForStats.filter((t) => normalizeTaskStatus(t.status) === 'In Progress').length
  const pendingTasks = tasksForStats.filter((t) => normalizeTaskStatus(t.status) === 'Pending').length
  const overdueTasks = tasksForStats.filter((t) => {
    if (!t.dueDate || normalizeTaskStatus(t.status) === 'Completed') return false
    return new Date(t.dueDate) < new Date(new Date().toDateString())
  }).length

  const urgentTasks = tasksForStats.filter((t) => t.priority === 'Urgent').length
  const completionPct = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-800'
      case 'High': return 'bg-orange-100 text-orange-800'
      case 'Medium': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-green-100 text-green-800'
    }
  }

  const fmtDateTime = (d) => {
    if (!d) return '—'
    const x = new Date(d)
    return Number.isNaN(x.getTime())
      ? '—'
      : x.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  const isImageUpload = (upload) => {
    const mime = (upload?.mimeType || '').toLowerCase()
    const name = (upload?.fileName || '').toLowerCase()
    return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)
  }

  const getPlatformSpecificReferenceLinks = (task) => {
    const selected = (task?.platform || '').toLowerCase()
    const links = Array.isArray(task?.uploadedLinks) ? task.uploadedLinks : []
    if (!selected) return links
    return links.filter((l) => (l?.platform || '').toLowerCase() === selected)
  }

  const getStatusColor = getTaskStatusColor

  const [viewTask, setViewTask] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [uploadingPostLink, setUploadingPostLink] = useState(false)
  const [socialUpload, setSocialUpload] = useState({ platform: '', url: '' })

  const canUpdateTaskStatus = (task) => {
    if (!task || !user?._id) return false
    if (task.source === 'social_media') return true
    const assigneeId = task.assignedTo?._id || task.assignedTo
    return assigneeId === user._id || canAssignTask()
  }

  const isPendingAssigneeAcceptance = (task) => {
    if (!task || !user?._id || task.source === 'social_media') return false
    const assigneeId = task.assignedTo?._id || task.assignedTo
    return String(assigneeId) === String(user._id) && normalizeTaskStatus(task.status) === 'Pending'
  }

  const hiddenByFilters = !loading && filteredTasks.length === 0 && tasksForStats.length > 0
  const hasActiveFilters = filterStatus !== 'All' || filterDate || filterProject || filterAssignee

  const handleStatusChange = async (task, newStatus) => {
    const taskId = task._id
    if (!taskId || !newStatus) return
    const resolvedStatus = normalizeTaskStatus(newStatus)
    setUpdatingStatus(true)
    try {
      if (task.source === 'social_media' && task.clientId && task.postId) {
        const socialStatus = taskStatusToSocialStatus(resolvedStatus)
        await api.put(`/social-calendars/client/${task.clientId}/posts/${task.postId}`, {
          status: socialStatus,
        })
        setViewTask((prev) => (
          prev?._id === taskId
            ? { ...prev, status: resolvedStatus, socialPostStatus: socialStatus }
            : prev
        ))
        setTasks((prev) =>
          prev.map((t) => {
            if (t.source === 'social_media' && t.clientId === task.clientId && t.postId === task.postId) {
              return { ...t, status: resolvedStatus, socialPostStatus: socialStatus }
            }
            if (t._id === taskId) return { ...t, status: resolvedStatus, socialPostStatus: socialStatus }
            return t
          })
        )
      } else {
        const res = await api.put(`/tasks/${taskId}`, { status: resolvedStatus })
        const updated = res.data?.task
        const status = normalizeTaskStatus(updated?.status || resolvedStatus)
        setViewTask((prev) => (prev?._id === taskId ? { ...prev, ...updated, status } : prev))
        setTasks((prev) =>
          prev.map((t) => (t._id === taskId ? { ...t, ...updated, status } : t))
        )
      }
      if (
        filterStatus !== 'All'
        && filterStatus !== 'Delayed'
        && normalizeTaskStatus(resolvedStatus) !== filterStatus
      ) {
        setFilterStatus('All')
        const next = new URLSearchParams(searchParams)
        next.delete('status')
        setSearchParams(next, { replace: true })
      }
    } catch (err) {
      console.error('Failed to update task status:', err)
    } finally {
      setUpdatingStatus(false)
    }
  }

    const SOCIAL_PLATFORMS = ['Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'YouTube', 'Other']

  const handleAddUploadedLink = async () => {
    if (!viewTask?.source || viewTask.source !== 'social_media') return
    if (!viewTask.clientId || !viewTask.postId) return
    if (!socialUpload.url.trim()) return

    setUploadingPostLink(true)
    try {
      const res = await api.post(
        `/social-calendars/client/${viewTask.clientId}/posts/${viewTask.postId}/upload-links`,
        {
          platform: socialUpload.platform || '',
          url: socialUpload.url.trim(),
          addedBy: user?._id || undefined,
        }
      )
      const updatedCalendar = res.data?.calendar
      const updatedPost = updatedCalendar?.posts?.find((p) => p._id === viewTask.postId)
      if (updatedPost) {
        setViewTask((prev) => (prev ? { ...prev, uploadedLinks: updatedPost.uploadedLinks || [] } : prev))
      } else {
        setViewTask((prev) => (prev
          ? {
              ...prev,
              uploadedLinks: [...(prev.uploadedLinks || []), { platform: socialUpload.platform || '', url: socialUpload.url.trim() }],
            }
          : prev))
      }
      setSocialUpload({ platform: '', url: '' })
    } catch (err) {
      console.error('Failed to add uploaded post link:', err)
    } finally {
      setUploadingPostLink(false)
    }
  }

  const openTaskFullPage = (task) => {
    const base = isMyTasks ? '/my-tasks' : '/tasks'
    navigate(`${base}/${encodeURIComponent(String(task._id))}`, { state: { task } })
    setViewTask(null)
    setSocialUpload({ platform: '', url: '' })
  }

  const closeTaskModal = () => {
    setViewTask(null)
    setSocialUpload({ platform: '', url: '' })
  }

  return (
    <div className='p-8'>
      <div className='mb-8 flex justify-between items-center'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900'>
            {isMyTasks ? 'My Tasks' : canAssignTask() ? 'Tasks' : 'My Tasks'}
          </h1>
          <p className='text-base text-gray-600 mt-2'>
            {isMyTasks
              ? 'Tasks assigned to you by project managers and team leads.'
              : canAssignTask()
              ? 'Manage team tasks and deadlines.'
              : 'Tasks assigned to you by project managers and team leads.'}
          </p>
        </div>
        {(canAssignTask() || isMyTasks) && (
          <button
            onClick={() => navigate(isMyTasks ? '/assign-task?self=1' : '/assign-task')}
            className='bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition-colors'
          >
            + New Task
          </button>
        )}
      </div>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
        <TaskStatCard
          title='Total Tasks'
          value={totalTasks}
          subtitle={`${pendingTasks} pending, ${inProgressTasks} in progress`}
          icon='📋'
          color='bg-indigo-50'
          accentClass='border-t-indigo-500'
          onClick={() => setFilterStatus('All')}
        />
        <TaskStatCard
          title='Completed'
          value={completedTasks}
          subtitle={`${completionPct}% completion`}
          icon='✅'
          color='bg-green-50'
          accentClass='border-t-green-500'
          onClick={() => setFilterStatus('Completed')}
        />
        <TaskStatCard
          title='Overdue'
          value={overdueTasks}
          subtitle='Attention needed'
          icon='⏳'
          color='bg-orange-50'
          accentClass='border-t-orange-500'
          onClick={() => setFilterStatus('Delayed')}
        />
        <TaskStatCard
          title='Urgent'
          value={urgentTasks}
          subtitle='High priority'
          icon='🔥'
          color='bg-red-50'
          accentClass='border-t-red-500'
        />
      </div>

      <div className='mb-6 flex flex-wrap items-center gap-4'>
        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium text-gray-700'>Date</label>
          <input
            type='date'
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
          />
          <button
            type='button'
            onClick={() => setFilterDate('')}
            className='px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg'
          >
            All
          </button>
        </div>
        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium text-gray-700'>Project</label>
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'>
              <option value=''>All Projects</option>
              {(canAssignTask() && !isMyTasks ? [{ _id: 'social-media', projectName: 'Social Media' }, ...projects] : uniqueProjectsFromTasks).map((p) => (
                <option key={p._id} value={p._id}>{p.projectName}</option>
              ))}
          </select>
        </div>
        {canAssignTask() && !isMyTasks && (
          <div className='flex items-center gap-2'>
            <label className='text-sm font-medium text-gray-700'>Assign to</label>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-[160px]'>
              <option value=''>All</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>{emp.name}</option>
              ))}
            </select>
          </div>
        )}
        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium text-gray-700'>Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'>
            <option value='All'>All status</option>
            <option value='Pending'>Pending</option>
            <option value='In Progress'>In Progress</option>
            <option value='Paused'>Paused</option>
            <option value='Completed'>Completed</option>
            <option value='Cancelled'>Cancelled</option>
            <option value='Delayed'>Delayed</option>
          </select>
        </div>
      </div>

      <div className='bg-white rounded-lg shadow-md overflow-x-auto'>
        <table className='w-full min-w-[1100px]'>
          <thead className='text-left border-b border-blue-700 bg-blue-600 text-white font-bold text-sm'>
            <tr>
              <th className='text-left py-4 px-6 border-b border-blue-700/30'>Task</th>
              <th className='text-left py-4 px-6 border-b border-blue-700/30'>Project</th>
              <th className='text-left py-4 px-6 border-b border-blue-700/30'>Assign to</th>
              <th className='text-left py-4 px-6 border-b border-blue-700/30'>Signed by</th>
              <th className='text-left py-4 px-6 border-b border-blue-700/30'>Assigned (date & time)</th>
              <th className='text-left py-4 px-6 border-b border-blue-700/30'>Updated (date & time)</th>
              <th className='text-left py-4 px-6 border-b border-blue-700/30'>Due Date</th>
              <th className='text-left py-4 px-6 border-b border-blue-700/30'>Priority</th>
              <th className='text-left py-4 px-6 border-b border-blue-700/30'>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className='py-12 text-center text-sm text-gray-500'>Loading...</td>
              </tr>
            ) : filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={9} className='py-12 text-center text-sm text-gray-500'>
                  {hiddenByFilters ? (
                    <div className='space-y-3'>
                      <p>No tasks match the current filters.</p>
                      {hasActiveFilters && (
                        <button
                          type='button'
                          onClick={clearAllFilters}
                          className='text-indigo-600 hover:text-indigo-700 font-medium'
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  ) : (
                    'No tasks found'
                  )}
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr
                  key={task._id}
                  onClick={() => setViewTask(task)}
                  className='border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer'
                >
                  <td className={`py-4 px-6 ${isMyTasks ? 'w-[300px] max-w-[300px]' : ''}`}>
                    <p className={`text-sm font-medium text-gray-900 ${isMyTasks ? 'line-clamp-2' : ''}`}>
                      {task.title}
                    </p>
                    {task.source === 'social_media' && (
                      <p className='text-xs text-indigo-700 mt-0.5'>
                        {task.contentType || 'Post'} • {task.platform || 'Platform'} • {task.socialPostStatus || 'Scheduled'}
                      </p>
                    )}
                    {task.description && (
                      <p className={`text-sm text-gray-500 mt-0.5 ${isMyTasks ? 'line-clamp-2' : 'line-clamp-1'}`}>
                        {task.description}
                      </p>
                    )}
                  </td>
                  <td className='py-4 px-6 text-gray-700 text-sm'>
                    {task.project?.projectName || '—'}
                  </td>
                  <td className='py-4 px-6'>
                    <PersonShortName name={task.assignedTo?.name} />
                  </td>
                  <td className='py-4 px-6'>
                    <PersonShortName name={task.assignedBy?.name} />
                  </td>
                  <td className='py-4 px-6 text-gray-700 text-sm whitespace-nowrap'>{fmtDateTime(task.createdAt)}</td>
                  <td className='py-4 px-6 text-gray-700 text-sm whitespace-nowrap'>{fmtDateTime(task.updatedAt)}</td>
                  <td className='py-4 px-6 text-gray-700 text-sm'>
                    {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
                  </td>
                  <td className='py-4 px-6'>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className='py-4 px-6'>
                    <div className='flex flex-col gap-0.5'>
                      <span className={`inline-flex w-fit px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                        {normalizeTaskStatus(task.status) || task.status}
                      </span>
                      {(normalizeTaskStatus(task.status) === 'In Progress' || normalizeTaskStatus(task.status) === 'Paused') && getTaskRemainingMinutes(task) != null && (
                        <span className='text-xs text-blue-700'>
                          {formatTaskDuration(getTaskRemainingMinutes(task))} left
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {viewTask && (
        <div
          className='fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
          onClick={closeTaskModal}
        >
          <div
            className='bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex justify-between items-start mb-4'>
              <h3 className='text-sm font-bold text-gray-900'>{viewTask.title}</h3>
              <button
                type='button'
                onClick={closeTaskModal}
                className='p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600'
              >
                <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                </svg>
              </button>
            </div>

            {viewTask.description && (
              <div className='mb-4'>
                <p className='text-sm font-medium text-gray-500 mb-1'>Description</p>
                <p className='text-sm text-gray-700 whitespace-pre-wrap'>{viewTask.description}</p>
              </div>
            )}

            <div className='space-y-3'>
              {viewTask.source === 'social_media' && (
                <>
                  <div className='py-2 border-b border-gray-100'>
                    <span className='text-sm text-gray-500'>Post Type</span>
                    <p className='text-sm font-medium text-gray-900 mt-1'>{viewTask.contentType || '—'}</p>
                  </div>
                  <div className='py-2 border-b border-gray-100'>
                    <span className='text-sm text-gray-500'>Platform</span>
                    <p className='text-sm font-medium text-gray-900 mt-1'>{viewTask.platform || '—'}</p>
                  </div>
                  <div className='py-2 border-b border-gray-100'>
                    <span className='text-sm text-gray-500'>Post Status</span>
                    <p className='text-sm font-medium text-gray-900 mt-1'>{viewTask.socialPostStatus || 'Scheduled'}</p>
                  </div>
                  <div className='py-2 border-b border-gray-100'>
                    <span className='text-sm text-gray-500'>Post Description</span>
                    <p className='text-sm font-medium text-gray-900 mt-1 whitespace-pre-wrap'>
                      {viewTask.description || 'No description'}
                    </p>
                  </div>
                  <div className='py-2 border-b border-gray-100'>
                    <span className='text-sm text-gray-500'>Reference</span>
                    <div className='mt-1'>
                      {viewTask.referenceLink ? (
                        <a href={viewTask.referenceLink} target='_blank' rel='noopener noreferrer' className='text-sm text-indigo-600 hover:underline break-all'>
                          {viewTask.referenceLink}
                        </a>
                      ) : viewTask.referenceUpload?.dataUrl ? (
                        <a href={viewTask.referenceUpload.dataUrl} target='_blank' rel='noopener noreferrer' className='text-sm text-indigo-600 hover:underline break-all'>
                          {viewTask.referenceUpload.fileName || 'Open uploaded reference'}
                        </a>
                      ) : (
                        <p className='text-sm text-gray-500'>No reference shared</p>
                      )}
                      {viewTask.referenceUpload?.dataUrl && isImageUpload(viewTask.referenceUpload) && (
                        <a href={viewTask.referenceUpload.dataUrl} target='_blank' rel='noopener noreferrer'>
                          <img
                            src={viewTask.referenceUpload.dataUrl}
                            alt={viewTask.referenceUpload.fileName || 'Reference preview'}
                            className='mt-2 max-h-28 rounded border border-gray-200 object-cover'
                          />
                        </a>
                      )}
                    </div>
                  </div>
                  {viewTask.contentType === 'Carousel' && Array.isArray(viewTask.carouselItems) && viewTask.carouselItems.length > 0 && (
                    <div className='py-2 border-b border-gray-100'>
                      <span className='text-sm text-gray-500'>Carousel Slide References</span>
                      <div className='mt-2 space-y-2'>
                        {viewTask.carouselItems.map((slide, idx) => (
                          <div key={`slide-ref-${idx}`} className='rounded border border-gray-200 p-2'>
                            <p className='text-xs font-semibold text-gray-600'>Slide {idx + 1}</p>
                            {slide?.referenceUpload?.dataUrl ? (
                              <div className='mt-1'>
                                <a href={slide.referenceUpload.dataUrl} target='_blank' rel='noopener noreferrer' className='text-xs text-indigo-600 hover:underline break-all'>
                                  {slide.referenceUpload.fileName || `Slide ${idx + 1} reference`}
                                </a>
                                {isImageUpload(slide.referenceUpload) && (
                                  <a href={slide.referenceUpload.dataUrl} target='_blank' rel='noopener noreferrer'>
                                    <img
                                      src={slide.referenceUpload.dataUrl}
                                      alt={slide.referenceUpload.fileName || `Slide ${idx + 1}`}
                                      className='mt-1 max-h-24 rounded border border-gray-200 object-cover'
                                    />
                                  </a>
                                )}
                              </div>
                            ) : (
                              <p className='text-xs text-gray-500 mt-1'>No reference upload</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className='py-2 border-b border-gray-100'>
                    <span className='text-sm text-gray-500'>Client Note</span>
                    <p className='text-sm font-medium text-gray-900 mt-1 whitespace-pre-wrap'>
                      {viewTask.clientNote || 'No client note'}
                    </p>
                  </div>
                  <div className='py-2 border-b border-gray-100'>
                    <span className='text-sm text-gray-500'>Uploaded Post Links</span>
                    {getPlatformSpecificReferenceLinks(viewTask).length > 0 ? (
                      <div className='mt-2 space-y-1.5'>
                        {getPlatformSpecificReferenceLinks(viewTask).map((link, idx) => (
                          <div key={`${link.url}-${idx}`} className='text-sm'>
                            <span className='text-gray-500'>{link.platform || 'Platform'}: </span>
                            <a href={link.url} target='_blank' rel='noopener noreferrer' className='text-indigo-600 hover:underline break-all'>
                              {link.url}
                            </a>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className='text-sm text-gray-500 mt-1'>No uploaded links for selected platform yet.</p>
                    )}
                    <div className='grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3'>
                      <select
                        value={socialUpload.platform}
                        onChange={(e) => setSocialUpload((p) => ({ ...p, platform: e.target.value }))}
                        className='border border-gray-300 rounded-lg px-2 py-1.5 text-sm'
                      >
                        <option value=''>Select platform</option>
                        {SOCIAL_PLATFORMS.map((platform) => (
                          <option key={platform} value={platform}>{platform}</option>
                        ))}
                      </select>
                      <input
                        type='url'
                        placeholder='https://uploaded-post-link'
                        value={socialUpload.url}
                        onChange={(e) => setSocialUpload((p) => ({ ...p, url: e.target.value }))}
                        className='sm:col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm'
                      />
                    </div>
                    <button
                      type='button'
                      onClick={handleAddUploadedLink}
                      disabled={uploadingPostLink || !socialUpload.url.trim()}
                      className='mt-2 px-3 py-1.5 rounded-lg text-sm font-medium border border-indigo-600 text-indigo-700 hover:bg-indigo-50 disabled:opacity-50'
                    >
                      {uploadingPostLink ? 'Adding...' : 'Add Uploaded Link'}
                    </button>
                  </div>
                </>
              )}
              <div className='flex justify-between items-center py-2 border-b border-gray-100'>
                <span className='text-sm text-gray-500'>Project</span>
                <span className='text-sm font-medium text-gray-900'>
                  {viewTask.project?.projectName || '—'}
                  {viewTask.source === 'social_media' && viewTask.clientName && ` (${viewTask.clientName})`}
                </span>
              </div>
              <div className='flex justify-between items-center py-2 border-b border-gray-100'>
                <span className='text-sm text-gray-500'>Assign to</span>
                <PersonShortName name={viewTask.assignedTo?.name} />
              </div>
              <div className='flex justify-between items-center py-2 border-b border-gray-100'>
                <span className='text-sm text-gray-500'>Signed by</span>
                <PersonShortName name={viewTask.assignedBy?.name} />
              </div>
              <div className='flex justify-between items-center py-2 border-b border-gray-100'>
                <span className='text-sm text-gray-500'>Status</span>
                {isPendingAssigneeAcceptance(viewTask) ? (
                  <div className='flex flex-col items-end gap-1'>
                    <button
                      type='button'
                      onClick={() => handleStatusChange(viewTask, 'In Progress')}
                      disabled={
                        updatingStatus
                        || (
                          String(viewTask.priority || '') !== 'Urgent'
                          && hasOpenUrgentTask(tasks, user?._id, viewTask._id)
                        )
                      }
                      className='px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50'
                      title={
                        String(viewTask.priority || '') !== 'Urgent'
                        && hasOpenUrgentTask(tasks, user?._id, viewTask._id)
                          ? 'Complete the urgent task before accepting other tasks'
                          : undefined
                      }
                    >
                      {updatingStatus ? 'Accepting...' : 'Accept Task'}
                    </button>
                    {String(viewTask.priority || '') !== 'Urgent'
                      && hasOpenUrgentTask(tasks, user?._id, viewTask._id) ? (
                      <span className='text-[11px] text-amber-700 max-w-[12rem] text-right'>
                        Urgent task in progress — finish it first
                      </span>
                    ) : null}
                  </div>
                ) : canUpdateTaskStatus(viewTask) ? (
                  <div className='flex flex-wrap items-center justify-end gap-2'>
                    {normalizeTaskStatus(viewTask.status) === 'In Progress'
                      && hasOpenUrgentTask(tasks, user?._id, viewTask._id)
                      && String(viewTask.priority || '') !== 'Urgent' ? (
                      <button
                        type='button'
                        onClick={() => handleStatusChange(viewTask, 'Paused')}
                        disabled={updatingStatus}
                        className='px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-50'
                      >
                        {updatingStatus ? 'Pausing…' : 'Pause'}
                      </button>
                    ) : null}
                    <select
                      value={normalizeTaskStatus(viewTask.status) || viewTask.status}
                      onChange={(e) => handleStatusChange(viewTask, e.target.value)}
                      disabled={updatingStatus}
                      className='text-sm font-semibold rounded-lg px-2 py-1 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50'
                    >
                      {getEditableStatusOptions(viewTask, {
                        hasOpenUrgent: hasOpenUrgentTask(tasks, user?._id, viewTask._id),
                      }).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(viewTask.status)}`}>
                    {normalizeTaskStatus(viewTask.status) || viewTask.status}
                  </span>
                )}
              </div>
              <div className='flex justify-between items-center py-2 border-b border-gray-100'>
                <span className='text-sm text-gray-500'>Priority</span>
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(viewTask.priority)}`}>
                  {viewTask.priority}
                </span>
              </div>
              <div className='flex justify-between items-center py-2 border-b border-gray-100'>
                <span className='text-sm text-gray-500'>Due Date</span>
                <span className='text-sm font-medium text-gray-900'>
                  {viewTask.dueDate ? new Date(viewTask.dueDate).toLocaleDateString() : '—'}
                </span>
              </div>
              <div className='flex justify-between items-center py-2 border-b border-gray-100'>
                <span className='text-sm text-gray-500'>Assigned (date & time)</span>
                <span className='text-sm text-gray-700'>
                  {viewTask.createdAt ? fmtDateTime(viewTask.createdAt) : '—'}
                </span>
              </div>
              <div className='flex justify-between items-center py-2'>
                <span className='text-sm text-gray-500'>Updated (date & time)</span>
                <span className='text-sm text-gray-700'>
                  {viewTask.updatedAt ? fmtDateTime(viewTask.updatedAt) : '—'}
                </span>
              </div>
            </div>

            <div className='mt-6 pt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-2'>
              <button
                type='button'
                onClick={() => openTaskFullPage(viewTask)}
                className='flex-1 py-2 px-4 rounded-lg text-sm font-medium border border-indigo-600 text-indigo-700 hover:bg-indigo-50'
              >
                Open full page
              </button>
              {viewTask.source !== 'social_media' && (
                <button
                  type='button'
                  onClick={() => {
                    const params = new URLSearchParams({ taskId: String(viewTask._id) })
                    if (isMyTasks) {
                      params.set('from', 'my-tasks')
                      params.set('self', '1')
                    }
                    navigate(`/assign-task?${params.toString()}`)
                  }}
                  className='flex-1 py-2 px-4 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700'
                >
                  Edit Task
                </button>
              )}
              <button
                type='button'
                onClick={closeTaskModal}
                className='flex-1 py-2 px-4 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50'
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default TasksView
