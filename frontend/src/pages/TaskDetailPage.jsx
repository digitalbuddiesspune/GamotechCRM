import React, { useEffect, useState, useCallback } from 'react'
import api from '../api/axios'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  formatTaskDuration,
  getEditableStatusOptions,
  getTaskRemainingMinutes,
  getTaskStatusColor,
  hasOpenUrgentTask,
  normalizeTaskStatus,
  taskStatusToSocialStatus,
} from '../utils/taskStatus'
import { formatTaskStarDisplay, getActualTaskDurationMinutes } from '../utils/taskStarRating'
const SOCIAL_PLATFORMS = ['Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'YouTube', 'Other']

const formatDuration = (minutes) => {
  const mins = Number(minutes)
  if (!Number.isFinite(mins) || mins <= 0) return '—'
  if (mins >= 1440) {
    const days = Math.floor(mins / 1440)
    const rem = mins % 1440
    const hours = Math.floor(rem / 60)
    const m = rem % 60
    if (hours && m) return `${days}d ${hours}h ${m}m`
    if (hours) return `${days}d ${hours}h`
    if (m) return `${days}d ${m}m`
    return `${days}d`
  }
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

const getCompletionDurationMinutes = (task) => getActualTaskDurationMinutes(task)

const getDurationVarianceLabel = (estimatedMinutes, actualMinutes) => {
  const estimated = Number(estimatedMinutes)
  const actual = Number(actualMinutes)
  if (!Number.isFinite(estimated) || estimated <= 0 || !Number.isFinite(actual) || actual < 0) return null
  const diff = actual - estimated
  if (Math.abs(diff) < 5) return { text: 'On estimate', className: 'text-green-600' }
  if (diff > 0) return { text: `${formatDuration(diff)} over estimate`, className: 'text-orange-600' }
  return { text: `${formatDuration(Math.abs(diff))} under estimate`, className: 'text-green-600' }
}

const StarRating = ({ value, onChange, disabled, incomplete = false }) => {
  if (incomplete) {
    return (
      <span className='text-xl' title='Not completed' aria-label='Not completed'>
        ❌
      </span>
    )
  }
  return (
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
}

const TaskDetailPage = ({ isMyTasks = false }) => {
  const { taskId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, canAssignTask, canRateTask } = useAuth()

  const [task, setTask] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [uploadingPostLink, setUploadingPostLink] = useState(false)
  const [socialUpload, setSocialUpload] = useState({ platform: '', url: '' })
  const [ratingForm, setRatingForm] = useState({ score: 0, comments: '' })
  const [savingRating, setSavingRating] = useState(false)
  const [ratingError, setRatingError] = useState(null)
  const [ratingSaved, setRatingSaved] = useState(false)
  const [siblingTasks, setSiblingTasks] = useState([])

  const listPath = isMyTasks ? '/my-tasks' : '/tasks'

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

  const getPlatformSpecificReferenceLinks = (taskVal) => {
    const selected = (taskVal?.platform || '').toLowerCase()
    const links = Array.isArray(taskVal?.uploadedLinks) ? taskVal.uploadedLinks : []
    if (!selected) return links
    return links.filter((l) => (l?.platform || '').toLowerCase() === selected)
  }

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Urgent': return 'bg-red-100 text-red-800'
      case 'High': return 'bg-orange-100 text-orange-800'
      case 'Medium': return 'bg-yellow-100 text-yellow-800'
      default: return 'bg-green-100 text-green-800'
    }
  }

  const getStatusColor = getTaskStatusColor

  const canUpdateTaskStatus = useCallback(
    (t) => {
      if (!t || !user?._id) return false
      if (t.source === 'social_media') return true
      const assigneeId = t.assignedTo?._id || t.assignedTo
      return assigneeId === user._id || canAssignTask()
    },
    [user?._id, canAssignTask]
  )

  const isPendingAssigneeAcceptance = useCallback(
    (t) => {
      if (!t || !user?._id || t.source === 'social_media') return false
      const assigneeId = t.assignedTo?._id || t.assignedTo
      return String(assigneeId) === String(user._id) && normalizeTaskStatus(t.status) === 'Pending'
    },
    [user?._id]
  )

  useEffect(() => {
    let cancelled = false
    const idStr = taskId ? decodeURIComponent(taskId) : ''

    const run = async () => {
      setLoading(true)
      setError(null)

      const fromState = location.state?.task
      if (fromState && String(fromState._id) === String(idStr)) {
        if (!cancelled) {
          setTask(fromState)
          setLoading(false)
        }
        return
      }

      if (!idStr) {
        if (!cancelled) {
          setError('Invalid task')
          setLoading(false)
        }
        return
      }

      if (idStr.startsWith('social-media-')) {
        const params = {}
        if (isMyTasks && user?._id) params.employeeId = user._id
        else if (!canAssignTask() && user?._id) params.employeeId = user._id
        try {
          const res = await api.get('/tasks', { params })
          const list = Array.isArray(res.data) ? res.data : []
          const found = list.find((t) => String(t._id) === idStr)
          if (!cancelled) {
            if (found) setTask(found)
            else setError('Task not found')
          }
        } catch (e) {
          if (!cancelled) setError(e?.response?.data?.message || e.message || 'Failed to load task')
        } finally {
          if (!cancelled) setLoading(false)
        }
        return
      }

      try {
        const res = await api.get(`/tasks/${idStr}`)
        if (!cancelled) setTask(res.data)
        const assigneeId = res.data?.assignedTo?._id || res.data?.assignedTo || user?._id
        if (assigneeId) {
          try {
            const sib = await api.get('/tasks', { params: { employeeId: assigneeId } })
            if (!cancelled) setSiblingTasks(Array.isArray(sib.data) ? sib.data : [])
          } catch {
            if (!cancelled) setSiblingTasks([])
          }
        }
      } catch (e) {
        if (!cancelled) setError(e?.response?.data?.message || e.message || 'Failed to load task')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [taskId, location.state, isMyTasks, user?._id, canAssignTask])

  useEffect(() => {
    if (!task?.rating) {
      setRatingForm({ score: 0, comments: '' })
      return
    }
    setRatingForm({
      score: task.rating.score || 0,
      comments: task.rating.comments || '',
    })
  }, [task?._id, task?.rating?.score, task?.rating?.comments])

  const handleStatusChange = async (t, newStatus) => {
    const tid = t._id
    if (!tid || !newStatus) return
    const resolvedStatus = normalizeTaskStatus(newStatus)
    setUpdatingStatus(true)
    setError(null)
    try {
      if (t.source === 'social_media' && t.clientId && t.postId) {
        const socialStatus = taskStatusToSocialStatus(resolvedStatus)
        await api.put(`/social-calendars/client/${t.clientId}/posts/${t.postId}`, {
          status: socialStatus,
        })
        setTask((prev) => (
          prev?._id === tid
            ? { ...prev, status: resolvedStatus, socialPostStatus: socialStatus }
            : prev
        ))
      } else {
        const res = await api.put(`/tasks/${tid}`, { status: resolvedStatus })
        const updated = res.data?.task
        const status = normalizeTaskStatus(updated?.status || resolvedStatus)
        setTask((prev) => (prev?._id === tid ? { ...prev, ...updated, status } : prev))
      }
    } catch (err) {
      console.error('Failed to update task status:', err)
      setError(err?.response?.data?.message || err.message || 'Failed to update task status')
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleSaveRating = async () => {
    if (!task?._id || task.source === 'social_media') return
    if (!ratingForm.score) {
      setRatingError('Please select a rating from 1 to 5 stars')
      return
    }
    setSavingRating(true)
    setRatingError(null)
    setRatingSaved(false)
    try {
      const res = await api.put(`/tasks/${task._id}`, {
        rating: {
          score: ratingForm.score,
          comments: ratingForm.comments,
          ratedBy: user?._id,
        },
      })
      const updated = res.data?.task || res.data
      setTask(updated)
      setRatingSaved(true)
    } catch (err) {
      setRatingError(err.response?.data?.message || err.message || 'Failed to save rating')
    } finally {
      setSavingRating(false)
    }
  }

  const handleAddUploadedLink = async () => {
    if (!task?.source || task.source !== 'social_media') return
    if (!task.clientId || !task.postId) return
    if (!socialUpload.url.trim()) return

    setUploadingPostLink(true)
    try {
      const res = await api.post(
        `/social-calendars/client/${task.clientId}/posts/${task.postId}/upload-links`,
        {
          platform: socialUpload.platform || '',
          url: socialUpload.url.trim(),
          addedBy: user?._id || undefined,
        }
      )
      const updatedCalendar = res.data?.calendar
      const updatedPost = updatedCalendar?.posts?.find((p) => p._id === task.postId)
      if (updatedPost) {
        setTask((prev) => (prev ? { ...prev, uploadedLinks: updatedPost.uploadedLinks || [] } : prev))
      } else {
        setTask((prev) =>
          prev
            ? {
                ...prev,
                uploadedLinks: [...(prev.uploadedLinks || []), { platform: socialUpload.platform || '', url: socialUpload.url.trim() }],
              }
            : prev
        )
      }
      setSocialUpload({ platform: '', url: '' })
    } catch (err) {
      console.error('Failed to add uploaded post link:', err)
    } finally {
      setUploadingPostLink(false)
    }
  }

  if (loading) {
    return (
      <div className='p-8'>
        <p className='text-sm text-gray-600'>Loading task…</p>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className='p-8 w-full'>
        <p className='text-red-600 text-sm mb-4'>{error || 'Task not found'}</p>
        <button
          type='button'
          onClick={() => navigate(listPath)}
          className='px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50'
        >
          Back to tasks
        </button>
      </div>
    )
  }

  return (
    <div className='p-4 md:p-8 w-full'>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <button
          type='button'
          onClick={() => navigate(listPath)}
          className='text-sm text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1'
        >
          <span aria-hidden='true'>←</span> Back to tasks
        </button>
        {task.source !== 'social_media' && (
          <button
            type='button'
            onClick={() => {
              const params = new URLSearchParams({ taskId: String(task._id) })
              if (isMyTasks) {
                params.set('from', 'my-tasks')
                params.set('self', '1')
              }
              navigate(`/assign-task?${params.toString()}`)
            }}
            className='px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700'
          >
            Edit Task
          </button>
        )}
      </div>

      <div className='bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden'>
        <div className='px-4 py-3 md:px-6 border-b border-blue-700 bg-blue-600'>
          <h1 className='text-lg md:text-xl font-bold text-white'>Task details</h1>
          <p className='text-sm text-blue-100 mt-0.5 line-clamp-2'>{task.title}</p>
        </div>

        <div className='p-6 max-h-[calc(100vh-12rem)] overflow-y-auto'>
          {task.description && (
            <div className='mb-6'>
              <p className='text-sm font-medium text-gray-500 mb-1'>Description</p>
              <p className='text-sm text-gray-700 whitespace-pre-wrap'>{task.description}</p>
            </div>
          )}

          <div className='space-y-3'>
            {task.source === 'social_media' && (
              <>
                <div className='py-2 border-b border-gray-100'>
                  <span className='text-sm text-gray-500'>Post Type</span>
                  <p className='text-sm font-medium text-gray-900 mt-1'>{task.contentType || '—'}</p>
                </div>
                <div className='py-2 border-b border-gray-100'>
                  <span className='text-sm text-gray-500'>Platform</span>
                  <p className='text-sm font-medium text-gray-900 mt-1'>{task.platform || '—'}</p>
                </div>
                <div className='py-2 border-b border-gray-100'>
                  <span className='text-sm text-gray-500'>Post Status</span>
                  <p className='text-sm font-medium text-gray-900 mt-1'>{task.socialPostStatus || 'Scheduled'}</p>
                </div>
                <div className='py-2 border-b border-gray-100'>
                  <span className='text-sm text-gray-500'>Post Description</span>
                  <p className='text-sm font-medium text-gray-900 mt-1 whitespace-pre-wrap'>
                    {task.description || 'No description'}
                  </p>
                </div>
                <div className='py-2 border-b border-gray-100'>
                  <span className='text-sm text-gray-500'>Reference</span>
                  <div className='mt-1'>
                    {task.referenceLink ? (
                      <a href={task.referenceLink} target='_blank' rel='noopener noreferrer' className='text-sm text-indigo-600 hover:underline break-all'>
                        {task.referenceLink}
                      </a>
                    ) : task.referenceUpload?.dataUrl ? (
                      <a href={task.referenceUpload.dataUrl} target='_blank' rel='noopener noreferrer' className='text-sm text-indigo-600 hover:underline break-all'>
                        {task.referenceUpload.fileName || 'Open uploaded reference'}
                      </a>
                    ) : (
                      <p className='text-sm text-gray-500'>No reference shared</p>
                    )}
                    {task.referenceUpload?.dataUrl && isImageUpload(task.referenceUpload) && (
                      <a href={task.referenceUpload.dataUrl} target='_blank' rel='noopener noreferrer'>
                        <img
                          src={task.referenceUpload.dataUrl}
                          alt={task.referenceUpload.fileName || 'Reference preview'}
                          className='mt-2 max-h-28 rounded border border-gray-200 object-cover'
                        />
                      </a>
                    )}
                  </div>
                </div>
                {task.contentType === 'Carousel' && Array.isArray(task.carouselItems) && task.carouselItems.length > 0 && (
                  <div className='py-2 border-b border-gray-100'>
                    <span className='text-sm text-gray-500'>Carousel Slide References</span>
                    <div className='mt-2 space-y-2'>
                      {task.carouselItems.map((slide, idx) => (
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
                    {task.clientNote || 'No client note'}
                  </p>
                </div>
                <div className='py-2 border-b border-gray-100'>
                  <span className='text-sm text-gray-500'>Uploaded Post Links</span>
                  {getPlatformSpecificReferenceLinks(task).length > 0 ? (
                    <div className='mt-2 space-y-1.5'>
                      {getPlatformSpecificReferenceLinks(task).map((link, idx) => (
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
            <div className='flex justify-between items-center py-2 border-b border-gray-100 gap-4'>
              <span className='text-sm text-gray-500 shrink-0'>Project</span>
              <span className='text-sm font-medium text-gray-900 text-right'>
                {task.project?.projectName || '—'}
                {task.source === 'social_media' && task.clientName && ` (${task.clientName})`}
              </span>
            </div>
            <div className='flex justify-between items-center py-2 border-b border-gray-100 gap-4'>
              <span className='text-sm text-gray-500'>Assign to</span>
              <span className='text-sm font-medium text-gray-900'>{task.assignedTo?.name || '—'}</span>
            </div>
            <div className='flex justify-between items-center py-2 border-b border-gray-100 gap-4'>
              <span className='text-sm text-gray-500'>Signed by</span>
              <span className='text-sm font-medium text-gray-900'>{task.assignedBy?.name || '—'}</span>
            </div>
            <div className='flex justify-between items-center py-2 border-b border-gray-100 gap-4'>
              <span className='text-sm text-gray-500'>Status</span>
              {isPendingAssigneeAcceptance(task) ? (
                <div className='flex flex-col items-end gap-1'>
                  <button
                    type='button'
                    onClick={() => handleStatusChange(task, 'In Progress')}
                    disabled={
                      updatingStatus
                      || (
                        String(task.priority || '') !== 'Urgent'
                        && hasOpenUrgentTask(siblingTasks, user?._id, task._id)
                      )
                    }
                    className='px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50'
                  >
                    {updatingStatus ? 'Accepting...' : 'Accept Task'}
                  </button>
                  {String(task.priority || '') !== 'Urgent'
                    && hasOpenUrgentTask(siblingTasks, user?._id, task._id) ? (
                    <span className='text-[11px] text-amber-700 max-w-[12rem] text-right'>
                      Urgent task in progress — finish it first
                    </span>
                  ) : null}
                </div>
              ) : canUpdateTaskStatus(task) ? (
                <div className='flex flex-wrap items-center justify-end gap-2'>
                  {normalizeTaskStatus(task.status) === 'In Progress'
                    && hasOpenUrgentTask(siblingTasks, user?._id, task._id)
                    && String(task.priority || '') !== 'Urgent' ? (
                    <button
                      type='button'
                      onClick={() => handleStatusChange(task, 'Paused')}
                      disabled={updatingStatus}
                      className='px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-50'
                    >
                      {updatingStatus ? 'Pausing…' : 'Pause'}
                    </button>
                  ) : null}
                  <select
                    value={normalizeTaskStatus(task.status) || task.status}
                    onChange={(e) => handleStatusChange(task, e.target.value)}
                    disabled={updatingStatus}
                    className='text-sm font-semibold rounded-lg px-2 py-1 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 max-w-[11rem]'
                  >
                    {getEditableStatusOptions(task, {
                      hasOpenUrgent: hasOpenUrgentTask(siblingTasks, user?._id, task._id),
                    }).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                  {normalizeTaskStatus(task.status) || task.status}
                </span>
              )}
            </div>
            <div className='flex justify-between items-center py-2 border-b border-gray-100 gap-4'>
              <span className='text-sm text-gray-500'>Priority</span>
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                {task.priority || '—'}
              </span>
            </div>
            <div className='flex justify-between items-center py-2 border-b border-gray-100 gap-4'>
              <span className='text-sm text-gray-500'>Due Date</span>
              <span className='text-sm font-medium text-gray-900'>
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : '—'}
              </span>
            </div>
            {task.source !== 'social_media' && (
              <>
                <div className='flex justify-between items-center py-2 border-b border-gray-100 gap-4'>
                  <span className='text-sm text-gray-500'>Estimated Duration</span>
                  <span className='text-sm font-medium text-gray-900'>
                    {formatDuration(task.estimatedDurationMinutes)}
                  </span>
                </div>
                {(normalizeTaskStatus(task.status) === 'In Progress' || normalizeTaskStatus(task.status) === 'Paused') && getTaskRemainingMinutes(task) != null && (
                  <div className='flex justify-between items-center py-2 border-b border-gray-100 gap-4'>
                    <span className='text-sm text-gray-500'>Time Remaining</span>
                    <span className='text-sm font-medium text-blue-700'>
                      {formatTaskDuration(getTaskRemainingMinutes(task))}
                    </span>
                  </div>
                )}
                <div className='flex justify-between items-start py-2 border-b border-gray-100 gap-4'>
                  <span className='text-sm text-gray-500 shrink-0'>Completion Duration</span>
                  <div className='text-right'>
                    <span className='text-sm font-medium text-gray-900'>
                      {normalizeTaskStatus(task.status) === 'Completed'
                        ? formatDuration(getCompletionDurationMinutes(task))
                        : '—'}
                    </span>
                    {normalizeTaskStatus(task.status) === 'Completed' && (() => {
                      const variance = getDurationVarianceLabel(
                        task.estimatedDurationMinutes,
                        getCompletionDurationMinutes(task),
                      )
                      return variance ? (
                        <p className={`text-xs font-medium mt-0.5 ${variance.className}`}>{variance.text}</p>
                      ) : null
                    })()}
                  </div>
                </div>
                {normalizeTaskStatus(task.status) === 'Completed' && task.completedAt && (
                  <div className='flex justify-between items-center py-2 border-b border-gray-100 gap-4'>
                    <span className='text-sm text-gray-500'>Completed (date & time)</span>
                    <span className='text-sm text-gray-700'>{fmtDateTime(task.completedAt)}</span>
                  </div>
                )}
              </>
            )}
            <div className='flex justify-between items-center py-2 border-b border-gray-100 gap-4'>
              <span className='text-sm text-gray-500'>Assigned (date & time)</span>
              <span className='text-sm text-gray-700'>{task.createdAt ? fmtDateTime(task.createdAt) : '—'}</span>
            </div>
            <div className='flex justify-between items-center py-2 gap-4'>
              <span className='text-sm text-gray-500'>Updated (date & time)</span>
              <span className='text-sm text-gray-700'>{task.updatedAt ? fmtDateTime(task.updatedAt) : '—'}</span>
            </div>

            {task.source !== 'social_media' && (
              <div className='mt-6 pt-6 border-t border-gray-200'>
                <h3 className='text-sm font-semibold text-gray-900 mb-1'>Performance rating</h3>
                <p className='text-xs text-gray-500 mb-3'>
                  Stars are auto-calculated from completion time vs estimate when the task is marked Completed.
                  Managers can still override manually.
                </p>
                {(() => {
                  const display = formatTaskStarDisplay(task)
                  if (display.kind === 'incomplete') {
                    return (
                      <div className='rounded-lg bg-gray-50 border border-gray-200 p-4 flex items-center gap-3'>
                        <StarRating incomplete />
                        <span className='text-sm text-gray-600'>Not completed — no star rating yet</span>
                      </div>
                    )
                  }
                  if (display.kind === 'score') {
                    return (
                      <div className='rounded-lg bg-amber-50 border border-amber-100 p-4'>
                        <StarRating value={task.rating.score} disabled />
                        {task.rating.comments && (
                          <p className='text-sm text-gray-700 mt-3 whitespace-pre-wrap'>{task.rating.comments}</p>
                        )}
                        <p className='text-xs text-gray-500 mt-3'>
                          {display.auto
                            ? 'Auto-rated from completion time'
                            : `Rated by ${task.rating.ratedBy?.name || task.assignedBy?.name || 'Manager'}`}
                          {task.rating.ratedAt ? ` · ${fmtDateTime(task.rating.ratedAt)}` : ''}
                        </p>
                      </div>
                    )
                  }
                  return (
                    <div className='rounded-lg bg-gray-50 border border-gray-200 p-4'>
                      <p className='text-sm text-gray-600'>No rating available (missing estimate or start time).</p>
                    </div>
                  )
                })()}
              </div>
            )}

            {task.source !== 'social_media' && canRateTask() && (
              <div className='mt-6 pt-6 border-t border-gray-200'>
                <h3 className='text-sm font-semibold text-gray-900 mb-1'>Override rating (optional)</h3>
                <p className='text-xs text-gray-500 mb-4'>
                  Manually adjust the auto star rating if needed.
                </p>

                <div className='mb-4'>
                  <p className='text-xs font-medium text-gray-500 mb-2'>
                    {task.rating?.score ? 'Update rating' : 'Rating'}
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
                <div className='mb-4'>
                  <label className='block text-xs font-medium text-gray-500 mb-2'>Comments</label>
                  <textarea
                    value={ratingForm.comments}
                    onChange={(e) => {
                      setRatingForm((prev) => ({ ...prev, comments: e.target.value }))
                      setRatingSaved(false)
                    }}
                    rows={3}
                    placeholder='Feedback on quality, timeliness, communication…'
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
                  />
                </div>
                {ratingError && <p className='text-red-600 text-sm mb-2'>{ratingError}</p>}
                {ratingSaved && <p className='text-green-600 text-sm mb-2'>Rating saved successfully.</p>}
                <button
                  type='button'
                  onClick={handleSaveRating}
                  disabled={savingRating || !ratingForm.score}
                  className='px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50'
                >
                  {savingRating ? 'Saving…' : task.rating?.score ? 'Update Rating' : 'Save Rating'}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className='px-6 py-4 border-t border-gray-200 bg-gray-50'>
          <button
            type='button'
            onClick={() => navigate(listPath)}
            className='w-full sm:w-auto px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium hover:bg-white'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default TaskDetailPage
