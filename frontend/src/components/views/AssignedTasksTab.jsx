import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'

const STATUS_OPTIONS = ['All', 'Pending', 'In Progress', 'Paused', 'Completed', 'Cancelled']

const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateTime = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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

const statusClass = (status) => {
  switch (status) {
    case 'Completed': return 'bg-green-100 text-green-800'
    case 'In Progress': return 'bg-blue-100 text-blue-800'
    case 'Paused': return 'bg-violet-100 text-violet-800'
    case 'Cancelled': return 'bg-gray-100 text-gray-600'
    default: return 'bg-amber-100 text-amber-800'
  }
}

const priorityClass = (priority) => {
  switch (priority) {
    case 'Urgent': return 'bg-red-100 text-red-800'
    case 'High': return 'bg-orange-100 text-orange-800'
    case 'Low': return 'bg-green-100 text-green-800'
    default: return 'bg-yellow-100 text-yellow-800'
  }
}

const StarRating = ({ value, onChange, disabled }) => (
  <div className='flex items-center gap-1'>
    {[1, 2, 3, 4, 5].map((star) => (
      <button
        key={star}
        type='button'
        disabled={disabled}
        onClick={() => onChange?.(star)}
        className={`text-2xl leading-none transition-colors disabled:cursor-default ${
          star <= value ? 'text-amber-400' : 'text-gray-300 hover:text-amber-200'
        }`}
        aria-label={`${star} star`}
      >
        ★
      </button>
    ))}
  </div>
)

const AssignedTasksTab = () => {
  const { user, canRateTask } = useAuth()
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedId, setSelectedId] = useState(null)
  const [ratingForm, setRatingForm] = useState({ score: 0, comments: '' })
  const [savingRating, setSavingRating] = useState(false)
  const [ratingError, setRatingError] = useState(null)
  const [ratingSaved, setRatingSaved] = useState(false)

  const fetchTasks = useCallback(async () => {
    if (!user?._id) return
    try {
      setLoading(true)
      setError(null)
      const res = await api.get('/tasks', { params: { assignedBy: user._id } })
      const list = Array.isArray(res.data) ? res.data : []
      setTasks(list.filter((t) => !String(t._id).startsWith('social-media-')))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load assigned tasks')
      setTasks([])
    } finally {
      setLoading(false)
    }
  }, [user?._id])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  const filteredTasks = useMemo(() => {
    if (statusFilter === 'All') return tasks
    return tasks.filter((t) => t.status === statusFilter)
  }, [tasks, statusFilter])

  const selectedTask = useMemo(
    () => filteredTasks.find((t) => String(t._id) === String(selectedId)) || null,
    [filteredTasks, selectedId],
  )

  useEffect(() => {
    if (!selectedTask) {
      setRatingForm({ score: 0, comments: '' })
      return
    }
    setRatingForm({
      score: selectedTask.rating?.score || 0,
      comments: selectedTask.rating?.comments || '',
    })
    setRatingError(null)
    setRatingSaved(false)
  }, [selectedTask?._id, selectedTask?.rating?.score, selectedTask?.rating?.comments])

  useEffect(() => {
    if (!selectedId && filteredTasks.length) {
      setSelectedId(filteredTasks[0]._id)
    }
  }, [filteredTasks, selectedId])

  const handleSaveRating = async () => {
    if (!selectedTask?._id || !canRateTask()) return
    if (!ratingForm.score) {
      setRatingError('Please select a rating from 1 to 5 stars')
      return
    }
    setSavingRating(true)
    setRatingError(null)
    setRatingSaved(false)
    try {
      const res = await api.put(`/tasks/${selectedTask._id}`, {
        rating: {
          score: ratingForm.score,
          comments: ratingForm.comments,
          ratedBy: user?._id,
        },
      })
      const updated = res.data?.task || res.data
      setTasks((prev) => prev.map((t) => (String(t._id) === String(updated._id) ? updated : t)))
      setRatingSaved(true)
    } catch (err) {
      setRatingError(err.response?.data?.message || err.message || 'Failed to save rating')
    } finally {
      setSavingRating(false)
    }
  }

  const counts = useMemo(() => {
    const base = { All: tasks.length, Pending: 0, 'In Progress': 0, Paused: 0, Completed: 0, Cancelled: 0 }
    tasks.forEach((t) => {
      if (base[t.status] !== undefined) base[t.status] += 1
    })
    return base
  }, [tasks])

  if (loading) {
    return <div className='p-8 text-sm text-gray-600'>Loading assigned tasks…</div>
  }

  return (
    <div className='p-6 md:p-8 w-full bg-[#f8f9fa] min-h-full'>
      <div className='flex flex-wrap items-start justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Assigned Tasks</h1>
          <p className='text-gray-600 mt-1 text-sm'>
            Track tasks you assigned to your team and rate employee performance.
          </p>
        </div>
        <button
          type='button'
          onClick={() => navigate('/assign-task?scope=my-projects')}
          className='px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700'
        >
          + Assign Task
        </button>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700'>
          {error}
        </div>
      )}

      <div className='flex flex-wrap gap-2 mb-5'>
        {STATUS_OPTIONS.map((status) => (
          <button
            key={status}
            type='button'
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              statusFilter === status
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {status} ({counts[status] ?? 0})
          </button>
        ))}
      </div>

      <div className='grid grid-cols-1 xl:grid-cols-5 gap-6'>
        <div className='xl:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
          <div className='px-5 py-4 border-b border-gray-100'>
            <h2 className='text-sm font-semibold text-gray-900'>Tasks you assigned ({filteredTasks.length})</h2>
          </div>
          <div className='overflow-x-auto max-h-[calc(100vh-16rem)] overflow-y-auto'>
            <table className='w-full text-sm'>
              <thead className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide sticky top-0'>
                <tr>
                  <th className='px-4 py-3'>Task</th>
                  <th className='px-4 py-3'>Assignee</th>
                  <th className='px-4 py-3'>Status</th>
                  <th className='px-4 py-3'>Due</th>
                  <th className='px-4 py-3'>Rating</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-gray-100'>
                {filteredTasks.length ? filteredTasks.map((task) => (
                  <tr
                    key={task._id}
                    onClick={() => setSelectedId(task._id)}
                    className={`cursor-pointer hover:bg-blue-50/50 transition-colors ${
                      String(selectedId) === String(task._id) ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className='px-4 py-3'>
                      <p className='font-medium text-gray-900 truncate max-w-[12rem]'>{task.title}</p>
                      <p className='text-xs text-gray-500 truncate max-w-[12rem]'>
                        {task.project?.projectName || '—'}
                      </p>
                    </td>
                    <td className='px-4 py-3 text-gray-700'>{task.assignedTo?.name || '—'}</td>
                    <td className='px-4 py-3'>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusClass(task.status)}`}>
                        {task.status}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-gray-600 whitespace-nowrap'>{formatDate(task.dueDate)}</td>
                    <td className='px-4 py-3'>
                      {task.status !== 'Completed' ? (
                        <span title='Not completed'>❌</span>
                      ) : task.rating?.score ? (
                        <span className='text-amber-500 font-semibold' title={task.rating?.auto ? 'Auto-rated from completion time' : 'Manager rating'}>
                          ★ {task.rating.score}/5
                          {task.rating?.auto ? <span className='text-xs text-gray-500 font-normal ml-1'>auto</span> : null}
                        </span>
                      ) : (
                        <span className='text-gray-400'>—</span>
                      )}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className='px-4 py-12 text-center text-gray-500'>
                      No assigned tasks{statusFilter !== 'All' ? ` with status "${statusFilter}"` : ''}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className='xl:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
          <div className='px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-2'>
            <h2 className='text-sm font-semibold text-gray-900'>Task details</h2>
            {selectedTask?._id && (
              <div className='flex items-center gap-3'>
                <button
                  type='button'
                  onClick={() => navigate(`/assign-task?taskId=${selectedTask._id}`)}
                  className='text-xs font-medium text-indigo-600 hover:text-indigo-700'
                >
                  Edit Task
                </button>
                <button
                  type='button'
                  onClick={() => navigate(`/tasks/${selectedTask._id}`)}
                  className='text-xs font-medium text-blue-600 hover:text-blue-700'
                >
                  Open full page
                </button>
              </div>
            )}
          </div>

          {!selectedTask ? (
            <p className='p-8 text-sm text-gray-500 text-center'>Select a task to view details and rate performance.</p>
          ) : (
            <div className='p-5 space-y-4 max-h-[calc(100vh-16rem)] overflow-y-auto'>
              <div>
                <h3 className='text-lg font-bold text-gray-900'>{selectedTask.title}</h3>
                {selectedTask.description && (
                  <p className='text-sm text-gray-600 mt-2 whitespace-pre-wrap'>{selectedTask.description}</p>
                )}
              </div>

              <dl className='space-y-2 text-sm'>
                {[
                  ['Project', selectedTask.project?.projectName || '—'],
                  ['Assignee', selectedTask.assignedTo?.name || '—'],
                  ['Priority', selectedTask.priority || '—'],
                  ['Status', selectedTask.status || '—'],
                  ['Duration', formatDuration(selectedTask.estimatedDurationMinutes)],
                  ['Due date', formatDate(selectedTask.dueDate)],
                  ['Assigned on', formatDateTime(selectedTask.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} className='flex justify-between gap-3 py-1.5 border-b border-gray-50'>
                    <dt className='text-gray-500 shrink-0'>{label}</dt>
                    <dd className='font-medium text-gray-900 text-right'>{value}</dd>
                  </div>
                ))}
              </dl>

              {canRateTask() && (
                <div className='pt-4 border-t border-gray-200'>
                  <h4 className='text-sm font-semibold text-gray-900 mb-1'>Rate employee performance</h4>
                  <p className='text-xs text-gray-500 mb-3'>
                    Give a rating for {selectedTask.assignedTo?.name || 'the assignee'} on this task.
                  </p>

                  {selectedTask.rating?.score > 0 && (
                    <div className='mb-4 rounded-lg bg-amber-50 border border-amber-100 p-3'>
                      <p className='text-xs font-medium text-amber-800 mb-1'>Current rating</p>
                      <StarRating value={selectedTask.rating.score} disabled />
                      {selectedTask.rating.comments && (
                        <p className='text-sm text-gray-700 mt-2'>{selectedTask.rating.comments}</p>
                      )}
                    </div>
                  )}

                  <div className='mb-3'>
                    <p className='text-xs font-medium text-gray-500 mb-2'>
                      {selectedTask.rating?.score ? 'Update rating' : 'Rating'}
                    </p>
                    <StarRating
                      value={ratingForm.score}
                      onChange={(score) => {
                        setRatingForm((prev) => ({ ...prev, score }))
                        setRatingSaved(false)
                      }}
                      disabled={savingRating}
                    />
                  </div>

                  <textarea
                    value={ratingForm.comments}
                    onChange={(e) => {
                      setRatingForm((prev) => ({ ...prev, comments: e.target.value }))
                      setRatingSaved(false)
                    }}
                    rows={3}
                    placeholder='Comments on quality, timeliness, communication…'
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-3'
                  />

                  {ratingError && <p className='text-red-600 text-sm mb-2'>{ratingError}</p>}
                  {ratingSaved && <p className='text-green-600 text-sm mb-2'>Rating saved successfully.</p>}

                  <button
                    type='button'
                    onClick={handleSaveRating}
                    disabled={savingRating || !ratingForm.score}
                    className='w-full px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50'
                  >
                    {savingRating ? 'Saving…' : selectedTask.rating?.score ? 'Update Rating' : 'Save Rating'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default AssignedTasksTab
