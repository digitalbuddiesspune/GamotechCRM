import React, { useCallback, useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { DeleteIcon, EditIcon } from '../Icons'

const PRIORITIES = ['urgent', 'high', 'normal']
const STATUSES = ['Published', 'Draft', 'Archived']

const priorityStyles = {
  urgent: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-amber-50 text-amber-800 border-amber-200',
  normal: 'bg-slate-50 text-slate-700 border-slate-200',
}

const statusStyles = {
  Published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Draft: 'bg-gray-100 text-gray-600 border-gray-200',
  Archived: 'bg-slate-100 text-slate-600 border-slate-200',
}

const priorityIcons = {
  urgent: '🚨',
  high: '📢',
  normal: 'ℹ️',
}

const emptyForm = {
  title: '',
  message: '',
  priority: 'high',
  status: 'Published',
  pinned: true,
  notifyEmployees: true,
  expiresAt: '',
}

const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateTime = (value) => {
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

const inputClass =
  'w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

const Field = ({ label, children }) => (
  <label className='block'>
    <span className='text-sm font-medium text-gray-700'>{label}</span>
    <div className='mt-1'>{children}</div>
  </label>
)

const Badge = ({ children, className }) => (
  <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${className}`}>
    {children}
  </span>
)

const AnnouncementsModuleView = () => {
  const { user } = useAuth()
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchAnnouncements = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const params = {}
      if (statusFilter) params.status = statusFilter
      if (priorityFilter) params.priority = priorityFilter
      const res = await api.get('/announcements', { params })
      setAnnouncements(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load announcements')
      setAnnouncements([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, priorityFilter])

  useEffect(() => {
    fetchAnnouncements()
  }, [fetchAnnouncements])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return announcements
    return announcements.filter(
      (a) =>
        String(a.title || '').toLowerCase().includes(q) ||
        String(a.message || '').toLowerCase().includes(q)
    )
  }, [announcements, searchQuery])

  const stats = useMemo(() => {
    const now = new Date()
    const active = announcements.filter(
      (a) =>
        a.status === 'Published' &&
        (!a.expiresAt || new Date(a.expiresAt) > now)
    )
    return {
      total: announcements.length,
      published: announcements.filter((a) => a.status === 'Published').length,
      pinned: announcements.filter((a) => a.pinned).length,
      active: active.length,
    }
  }, [announcements])

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setSuccess('')
    setError('')
    setShowForm(true)
  }

  const openEdit = (item) => {
    setEditingId(item._id)
    setForm({
      title: item.title || '',
      message: item.message || '',
      priority: item.priority || 'high',
      status: item.status || 'Published',
      pinned: Boolean(item.pinned),
      notifyEmployees: Boolean(item.notifyEmployees),
      expiresAt: item.expiresAt ? String(item.expiresAt).split('T')[0] : '',
    })
    setSuccess('')
    setError('')
    setShowForm(true)
  }

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.message.trim()) {
      setError('Title and message are required')
      return
    }

    try {
      setSaving(true)
      setError('')
      setSuccess('')
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        priority: form.priority,
        status: form.status,
        pinned: form.pinned,
        notifyEmployees: form.notifyEmployees,
        expiresAt: form.expiresAt || null,
        createdBy: user?._id || null,
      }

      let notified = 0
      if (editingId) {
        const res = await api.put(`/announcements/${editingId}`, payload)
        notified = res.data?.notified || 0
        setSuccess(
          notified
            ? `Announcement updated. Notified ${notified} employee(s).`
            : 'Announcement updated.'
        )
      } else {
        const res = await api.post('/announcements', payload)
        notified = res.data?.notified || 0
        setSuccess(
          notified
            ? `Announcement published. Notified ${notified} employee(s).`
            : 'Announcement saved.'
        )
      }

      setShowForm(false)
      setForm(emptyForm)
      setEditingId(null)
      await fetchAnnouncements()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save announcement')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this announcement?')) return
    try {
      setError('')
      await api.delete(`/announcements/${id}`)
      setSuccess('Announcement deleted.')
      await fetchAnnouncements()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete announcement')
    }
  }

  return (
    <div className='p-6 md:p-8 w-full bg-[#f8f9fa] min-h-full'>
      <div className='flex flex-wrap items-start justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Announcements</h1>
          <p className='text-sm text-gray-600 mt-1'>
            Post important company-wide notices that show on employee dashboards and notifications.
          </p>
        </div>
        <button
          type='button'
          onClick={openCreate}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700'
        >
          + New Announcement
        </button>
      </div>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
        {[
          ['Total', stats.total, '📋'],
          ['Published', stats.published, '✅'],
          ['Active now', stats.active, '🟢'],
          ['Pinned', stats.pinned, '📌'],
        ].map(([label, value, icon]) => (
          <div key={label} className='bg-white rounded-xl border border-gray-200 shadow-sm p-4'>
            <div className='flex items-start justify-between gap-3'>
              <div>
                <p className='text-sm text-gray-500'>{label}</p>
                <p className='text-2xl font-bold text-gray-900 mt-1'>{value}</p>
              </div>
              <span className='text-xl'>{icon}</span>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
          <p className='text-red-600 text-sm'>{error}</p>
        </div>
      )}
      {success && (
        <div className='mb-4 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2'>
          <p className='text-emerald-700 text-sm'>{success}</p>
        </div>
      )}

      <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-3'>
          <input
            type='search'
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder='Search announcements…'
            className={inputClass}
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={inputClass}
          >
            <option value=''>All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className={inputClass}
          >
            <option value=''>All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      {showForm && (
        <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='text-lg font-semibold text-gray-900'>
              {editingId ? 'Edit Announcement' : 'New Announcement'}
            </h2>
            <button
              type='button'
              onClick={() => setShowForm(false)}
              className='text-sm text-gray-500 hover:text-gray-700'
            >
              Cancel
            </button>
          </div>
          <form onSubmit={handleSubmit} className='space-y-4'>
            <Field label='Title *'>
              <input
                name='title'
                value={form.title}
                onChange={handleFormChange}
                className={inputClass}
                placeholder='e.g. Office closed on Friday'
                required
              />
            </Field>
            <Field label='Message *'>
              <textarea
                name='message'
                value={form.message}
                onChange={handleFormChange}
                rows={4}
                className={inputClass}
                placeholder='Write the full announcement for all employees…'
                required
              />
            </Field>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
              <Field label='Priority'>
                <select name='priority' value={form.priority} onChange={handleFormChange} className={inputClass}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                  ))}
                </select>
              </Field>
              <Field label='Status'>
                <select name='status' value={form.status} onChange={handleFormChange} className={inputClass}>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label='Expires on (optional)'>
                <input
                  type='date'
                  name='expiresAt'
                  value={form.expiresAt}
                  onChange={handleFormChange}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className='flex flex-wrap gap-6'>
              <label className='inline-flex items-center gap-2 text-sm text-gray-700'>
                <input
                  type='checkbox'
                  name='pinned'
                  checked={form.pinned}
                  onChange={handleFormChange}
                  className='rounded border-gray-300'
                />
                Pin as important
              </label>
              <label className='inline-flex items-center gap-2 text-sm text-gray-700'>
                <input
                  type='checkbox'
                  name='notifyEmployees'
                  checked={form.notifyEmployees}
                  onChange={handleFormChange}
                  className='rounded border-gray-300'
                />
                Notify all employees
              </label>
            </div>
            <div className='flex justify-end gap-2 pt-2'>
              <button
                type='button'
                onClick={() => setShowForm(false)}
                className='px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50'
              >
                Cancel
              </button>
              <button
                type='submit'
                disabled={saving}
                className='px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60'
              >
                {saving ? 'Saving…' : editingId ? 'Update' : 'Publish'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className='text-sm text-gray-600 py-8'>Loading announcements…</div>
      ) : filtered.length === 0 ? (
        <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center'>
          <p className='text-gray-500 text-sm'>No announcements yet. Create one to notify the team.</p>
        </div>
      ) : (
        <div className='space-y-3'>
          {filtered.map((item) => (
            <div
              key={item._id}
              className={`bg-white rounded-xl border shadow-sm p-5 ${
                item.pinned ? 'border-amber-200 ring-1 ring-amber-100' : 'border-gray-200'
              }`}
            >
              <div className='flex flex-wrap items-start justify-between gap-3'>
                <div className='flex gap-3 min-w-0 flex-1'>
                  <span className='text-2xl shrink-0'>{priorityIcons[item.priority] || '📢'}</span>
                  <div className='min-w-0'>
                    <div className='flex flex-wrap items-center gap-2 mb-1'>
                      <h3 className='text-base font-semibold text-gray-900'>{item.title}</h3>
                      {item.pinned && (
                        <Badge className='bg-amber-50 text-amber-800 border-amber-200'>Pinned</Badge>
                      )}
                      <Badge className={priorityStyles[item.priority] || priorityStyles.normal}>
                        {(item.priority || 'normal').charAt(0).toUpperCase() + (item.priority || 'normal').slice(1)}
                      </Badge>
                      <Badge className={statusStyles[item.status] || statusStyles.Draft}>
                        {item.status}
                      </Badge>
                    </div>
                    <p className='text-sm text-gray-600 whitespace-pre-wrap'>{item.message}</p>
                    <p className='text-xs text-gray-400 mt-3'>
                      By {item.createdBy?.name || 'Unknown'}
                      {' · '}
                      {formatDateTime(item.publishedAt || item.createdAt)}
                      {item.expiresAt ? ` · Expires ${formatDate(item.expiresAt)}` : ''}
                    </p>
                  </div>
                </div>
                <div className='flex items-center gap-1 shrink-0'>
                  <button
                    type='button'
                    onClick={() => openEdit(item)}
                    className='p-2 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-blue-600'
                    title='Edit'
                  >
                    <EditIcon />
                  </button>
                  <button
                    type='button'
                    onClick={() => handleDelete(item._id)}
                    className='p-2 rounded-lg text-gray-500 hover:bg-red-50 hover:text-red-600'
                    title='Delete'
                  >
                    <DeleteIcon />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default AnnouncementsModuleView
