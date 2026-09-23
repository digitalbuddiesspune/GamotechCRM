import React, { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import api from '../../api/axios'
import { uploadFile } from '../../utils/uploadFile'
import { useAuth } from '../../context/AuthContext'

const PLATFORMS = ['All', 'Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'YouTube', 'Other']
const CONTENT_TYPES = ['Reel', 'Feed Post', 'Carousel', 'Story']
const CLIENT_REVIEW_BADGE = {
  Pending: 'bg-amber-100 text-amber-800',
  Accepted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  'Need Changes': 'bg-purple-100 text-purple-800',
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Small accent dot per platform for post chips */
const PLATFORM_ACCENT = {
  All: 'from-slate-400 to-slate-500',
  Instagram: 'from-fuchsia-500 to-pink-500',
  Facebook: 'from-blue-600 to-blue-700',
  Twitter: 'from-sky-400 to-sky-600',
  LinkedIn: 'from-blue-700 to-indigo-700',
  YouTube: 'from-red-500 to-red-600',
  Other: 'from-violet-500 to-purple-600',
}
const SLIDE_LABELS = ['Slide 1', 'Slide 2', 'Slide 3']
const DEFAULT_REFERENCE_UPLOAD = { fileName: '', mimeType: '', dataUrl: '' }
const createEmptyCarouselSlide = () => ({ subject: '', description: '', referenceUpload: { ...DEFAULT_REFERENCE_UPLOAD } })
const ensureThreeCarouselSlides = (items = []) => {
  const normalized = Array.isArray(items) ? items.slice(0, 3) : []
  while (normalized.length < 3) normalized.push(createEmptyCarouselSlide())
  return normalized.map((slide) => ({
    subject: slide?.subject || '',
    description: slide?.description || '',
    referenceUpload: slide?.referenceUpload || { ...DEFAULT_REFERENCE_UPLOAD },
  }))
}

/** Normalize employee id for compares and API (avoid ObjectId vs string mismatches). */
const assigneeIdKey = (raw) => {
  if (raw == null || raw === '') return ''
  const v = typeof raw === 'object' && raw._id != null ? raw._id : raw
  return String(v)
}
const toId = (raw) => {
  if (raw == null || raw === '') return ''
  if (typeof raw === 'object') {
    if (raw._id != null) return toId(raw._id)
    if (raw.id != null) return toId(raw.id)
    return typeof raw.toString === 'function' ? raw.toString() : ''
  }
  return String(raw)
}

const SocialCalendarView = () => {
  const { canManageSocialCalendar } = useAuth()
  const [clients, setClients] = useState([])
  const [selectedClient, setSelectedClient] = useState(null)
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [clientSearch, setClientSearch] = useState('')
  const [clientOpen, setClientOpen] = useState(false)
  const [calendar, setCalendar] = useState(null)
  const [loading, setLoading] = useState(false)
  const [savingPost, setSavingPost] = useState(false)
  const [error, setError] = useState(null)
  const [showAddPost, setShowAddPost] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const [postForm, setPostForm] = useState({
    title: '',
    contentType: 'Feed Post',
    subject: '',
    description: '',
    carouselItems: ensureThreeCarouselSlides(),
    platform: 'Instagram',
    scheduledTime: '',
    status: 'Scheduled',
    referenceLink: '',
    referenceUpload: { fileName: '', mimeType: '', dataUrl: '' },
    assignedTo: [],
  })
  const [employees, setEmployees] = useState([])
  const [assigneeSearch, setAssigneeSearch] = useState('')
  const [assigneeOpen, setAssigneeOpen] = useState(false)
  const now = new Date()
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth())
  const [calendarYear, setCalendarYear] = useState(now.getFullYear())
  const clientRef = useRef(null)
  const assigneeRef = useRef(null)
  const shareLink = calendar?.shareToken ? `${window.location.origin}/social-calendar/client/${calendar.shareToken}` : ''

  const fetchClients = async () => {
    try {
      const res = await api.get('/clients')
      setClients(Array.isArray(res.data) ? res.data : res.data?.data || [])
    } catch (err) {
      console.error('Failed to fetch clients:', err)
    }
  }

  const fetchCalendar = async () => {
    if (!selectedClient || !selectedProjectId) return
    try {
      setLoading(true)
      setError(null)
      const res = await api.get(`/social-calendars/client/${toId(selectedClient._id || selectedClient.id)}`, { params: { projectId: toId(selectedProjectId) } })
      setCalendar(res.data)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error loading calendar')
      setCalendar(null)
    } finally {
      setLoading(false)
    }
  }

  const fetchEmployees = async () => {
    try {
      const res = await api.get('/employees')
      setEmployees(Array.isArray(res.data) ? res.data : res.data?.data || [])
    } catch (err) {
      console.error('Failed to fetch employees:', err)
    }
  }

  const fetchProjectsByClient = async (clientId) => {
    if (!clientId) {
      setProjects([])
      return
    }
    try {
      const res = await api.get('/projects')
      const list = Array.isArray(res.data) ? res.data : res.data?.data || []
      setProjects(
        list
          .filter((p) => toId(p?.client?._id || p?.client) === toId(clientId))
          .map((p) => ({ ...p, _id: toId(p?._id || p?.id) }))
      )
    } catch (err) {
      console.error('Failed to fetch projects:', err)
      setProjects([])
    }
  }

  useEffect(() => {
    fetchClients()
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (selectedClient && selectedProjectId) fetchCalendar()
    else setCalendar(null)
  }, [selectedClient, selectedProjectId])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target)) setClientOpen(false)
      if (assigneeRef.current && !assigneeRef.current.contains(e.target)) setAssigneeOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getAssignedNames = (assignedTo) => {
    if (!assignedTo) return ''
    const arr = Array.isArray(assignedTo) ? assignedTo : [assignedTo]
    return arr.map((a) => (typeof a === 'object' ? a?.name : '')).filter(Boolean).join(', ')
  }

  const toggleAssignedEmployee = (empId) => {
    const key = assigneeIdKey(empId)
    if (!key) return
    setPostForm((f) => {
      const keys = (f.assignedTo || []).map(assigneeIdKey).filter(Boolean)
      const next = keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key]
      return { ...f, assignedTo: next }
    })
  }

  const filteredClients = clients.filter((c) =>
    (c.clientName || '').toLowerCase().includes(clientSearch.toLowerCase())
  )

  const filteredEmployees = employees.filter((emp) =>
    (emp.name || '').toLowerCase().includes(assigneeSearch.toLowerCase())
  )

  const handleClientSelect = (client) => {
    setSelectedClient(client)
    setClientSearch(client.clientName || '')
    setClientOpen(false)
    setSelectedProjectId('')
    setCalendar(null)
    fetchProjectsByClient(toId(client._id || client.id))
  }

  const handleAddPost = async (e) => {
    e.preventDefault()
    if (!selectedClient || !selectedProjectId || !postForm.title.trim()) return
    setSavingPost(true)
    try {
      const res = await api.post(`/social-calendars/client/${toId(selectedClient._id || selectedClient.id)}/posts`, {
        ...postForm,
        projectId: toId(selectedProjectId),
        title: postForm.title || postForm.subject || 'Social Post',
        scheduledTime: postForm.scheduledTime || undefined,
        assignedTo: Array.isArray(postForm.assignedTo) ? postForm.assignedTo : [],
      }, { params: { projectId: toId(selectedProjectId) } })
      setCalendar(res.data?.calendar ?? res.data)
      setAssigneeSearch('')
      setAssigneeOpen(false)
      setPostForm({
        title: '',
        contentType: 'Feed Post',
        subject: '',
        description: '',
        carouselItems: ensureThreeCarouselSlides(),
        platform: 'Instagram',
        scheduledTime: '',
        status: 'Scheduled',
        referenceLink: '',
        referenceUpload: { fileName: '', mimeType: '', dataUrl: '' },
        assignedTo: [],
      })
      setShowAddPost(false)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error adding post')
    } finally {
      setSavingPost(false)
    }
  }

  const handleEditPost = (post) => {
    setEditingPost(post)
    const scheduledTime = post.scheduledTime
      ? new Date(post.scheduledTime).toISOString().slice(0, 16)
      : ''
    setPostForm({
      title: post.title || '',
      contentType: post.contentType || 'Feed Post',
      subject: post.subject || '',
      description: post.description || '',
      carouselItems: ensureThreeCarouselSlides(post.carouselItems),
      platform: post.platform || 'Instagram',
      scheduledTime,
      status: post.status || 'Scheduled',
      referenceLink: post.referenceLink || '',
      referenceUpload: post.referenceUpload || { fileName: '', mimeType: '', dataUrl: '' },
      assignedTo: Array.isArray(post.assignedTo)
        ? post.assignedTo.map((a) => assigneeIdKey(typeof a === 'object' ? a._id ?? a : a)).filter(Boolean)
        : post.assignedTo
          ? [assigneeIdKey(typeof post.assignedTo === 'object' ? post.assignedTo._id ?? post.assignedTo : post.assignedTo)].filter(Boolean)
          : [],
    })
  }

  const handleUpdatePost = async (e) => {
    e.preventDefault()
    if (!selectedClient || !selectedProjectId || !editingPost || !postForm.title.trim()) return
    setSavingPost(true)
    try {
      const res = await api.put(
        `/social-calendars/client/${toId(selectedClient._id || selectedClient.id)}/posts/${editingPost._id}`,
        {
          ...postForm,
          projectId: toId(selectedProjectId),
          scheduledTime: postForm.scheduledTime || undefined,
          assignedTo: Array.isArray(postForm.assignedTo) ? postForm.assignedTo : [],
        },
        { params: { projectId: toId(selectedProjectId) } }
      )
      setCalendar(res.data?.calendar ?? res.data)
      setEditingPost(null)
      setAssigneeSearch('')
      setAssigneeOpen(false)
      setPostForm({
        title: '',
        contentType: 'Feed Post',
        subject: '',
        description: '',
        carouselItems: ensureThreeCarouselSlides(),
        platform: 'Instagram',
        scheduledTime: '',
        status: 'Scheduled',
        referenceLink: '',
        referenceUpload: { fileName: '', mimeType: '', dataUrl: '' },
        assignedTo: [],
      })
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error updating post')
    } finally {
      setSavingPost(false)
    }
  }

  const closePostModal = () => {
    setShowAddPost(false)
    setEditingPost(null)
    setAssigneeSearch('')
    setAssigneeOpen(false)
    setPostForm({
      title: '',
      contentType: 'Feed Post',
      subject: '',
      description: '',
      carouselItems: ensureThreeCarouselSlides(),
      platform: 'Instagram',
      scheduledTime: '',
      status: 'Scheduled',
      referenceLink: '',
      referenceUpload: { fileName: '', mimeType: '', dataUrl: '' },
      assignedTo: [],
    })
  }

  const handleDownloadXLS = () => {
    if (!selectedClient || !calendar?.posts?.length) return
    const dataRows = []
    const monthLabel = new Date(calendarYear, calendarMonth, 1).toLocaleString('default', { month: 'long', year: 'numeric' })

    for (let day = 1; day <= daysInMonth; day += 1) {
      const dayDate = new Date(calendarYear, calendarMonth, day)
      const dayPosts = posts.filter((p) => {
        if (!p.scheduledTime) return false
        const d = new Date(p.scheduledTime)
        return d.getDate() === day && d.getMonth() === calendarMonth && d.getFullYear() === calendarYear
      })

      if (dayPosts.length === 0) {
        dataRows.push([
          dayDate.toLocaleDateString('en-IN'),
          '',
          '',
          '',
          '',
          '',
          '',
          '',
          '',
        ])
      } else {
        dayPosts.forEach((p) => {
          const details =
            p.contentType === 'Carousel' && Array.isArray(p.carouselItems) && p.carouselItems.length > 0
              ? p.carouselItems
                  .map((item, idx) => `Post ${idx + 1}: ${item.subject || ''} ${item.description || ''}`.trim())
                  .join(' | ')
              : `${p.subject || ''} ${p.description || ''}`.trim()

          dataRows.push([
            dayDate.toLocaleDateString('en-IN'),
            p.title || '',
            p.contentType || '',
            details || '',
            p.platform || '',
            p.status || '',
            p.clientReviewStatus || 'Pending',
            p.referenceLink || p.referenceUpload?.fileName || '',
            getAssignedNames(p.assignedTo),
          ])
        })
      }
    }

    const rows = [
      ['Client', selectedClient.clientName],
      ['Month', monthLabel],
      ['Exported', new Date().toLocaleString()],
      [],
      ['Date', 'Title', 'Type', 'Subject/Description', 'Platform', 'Status', 'Client Review', 'Reference', 'Assigned To'],
      ...dataRows,
    ]
    const ws = XLSX.utils.aoa_to_sheet(rows)

    // Set column widths so content is fully visible (wch = width in characters)
    const headerLengths = [10, 10, 8, 20, 8, 8, 12, 12, 11]
    const colWidths = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((colIdx) => {
      const maxContent = Math.max(
        headerLengths[colIdx],
        ...dataRows.map((r) => String(r[colIdx] || '').length)
      )
      return Math.max(maxContent + 2, headerLengths[colIdx] + 2)
    })
    ws['!cols'] = colWidths.map((wch) => ({ wch }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Social Media Calendar')
    const fileName = `social-calendar-${selectedClient.clientName?.replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xls`
    XLSX.writeFile(wb, fileName, { bookType: 'xls' })
  }

  const posts = calendar?.posts || []
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const firstDayOfWeek = new Date(calendarYear, calendarMonth, 1).getDay()

  const goPrevMonth = () => {
    setCalendarMonth((m) => {
      if (m === 0) {
        setCalendarYear((y) => y - 1)
        return 11
      }
      return m - 1
    })
  }
  const goNextMonth = () => {
    setCalendarMonth((m) => {
      if (m === 11) {
        setCalendarYear((y) => y + 1)
        return 0
      }
      return m + 1
    })
  }

  const getPostsForDay = (day) => {
    return posts.filter((p) => {
      if (!p.scheduledTime) return false
      const d = new Date(p.scheduledTime)
      return d.getDate() === day && d.getMonth() === calendarMonth && d.getFullYear() === calendarYear
    })
  }

  const isToday = (day) => {
    const t = new Date()
    return (
      t.getDate() === day && t.getMonth() === calendarMonth && t.getFullYear() === calendarYear
    )
  }

  const weekdayIndexForDay = (day) => new Date(calendarYear, calendarMonth, day).getDay()

  const platformAccentGradient = (platform) => PLATFORM_ACCENT[platform] || PLATFORM_ACCENT.Other

  const openNewPostForDate = (day) => {
    if (!canManageSocialCalendar() || !selectedClient) return
    const date = new Date(calendarYear, calendarMonth, day, 9, 0)
    const scheduledTime = date.toISOString().slice(0, 16)
    setPostForm((f) => ({
      ...f,
      title: '',
      contentType: 'Feed Post',
      subject: '',
      description: '',
      carouselItems: ensureThreeCarouselSlides(),
      platform: 'Instagram',
      scheduledTime,
      status: 'Scheduled',
      referenceLink: '',
      referenceUpload: { fileName: '', mimeType: '', dataUrl: '' },
      assignedTo: [],
    }))
    setEditingPost(null)
    setShowAddPost(true)
  }

  const handleReferenceUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const uploaded = await uploadFile(file, { folder: 'social' })
      setPostForm((f) => ({
        ...f,
        referenceUpload: {
          fileName: uploaded.fileName || file.name,
          mimeType: uploaded.mimeType || file.type || '',
          dataUrl: uploaded.url,
        },
      }))
    } catch (err) {
      console.error('Failed to upload reference', err)
      event.target.value = ''
    }
  }

  const handleCarouselReferenceUpload = async (index, event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const uploaded = await uploadFile(file, { folder: 'social' })
      setPostForm((f) => ({
        ...f,
        carouselItems: ensureThreeCarouselSlides(f.carouselItems).map((slide, idx) =>
          idx === index
            ? {
                ...slide,
                referenceUpload: {
                  fileName: uploaded.fileName || file.name,
                  mimeType: uploaded.mimeType || file.type || '',
                  dataUrl: uploaded.url,
                },
              }
            : slide
        ),
      }))
    } catch (err) {
      console.error('Failed to upload carousel reference', err)
      event.target.value = ''
    }
  }

  const handleDayClick = (day) => {
    const dayPosts = getPostsForDay(day)
    if (dayPosts.length === 0 && canManageSocialCalendar()) {
      openNewPostForDate(day)
    }
  }

  return (
    <div className='min-h-[calc(100dvh-3rem)] bg-gradient-to-b from-slate-50 via-white to-cyan-50/15 p-6 sm:p-8'>
      <div className='mb-8'>
        <h1 className='bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-800 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl'>
          Social Media Calendar
        </h1>
        <p className='mt-1.5 max-w-xl text-sm text-slate-600'>
          Plan and schedule social posts for each client with a clear month view and quick access to what&apos;s next.
        </p>
      </div>

      {/* Client Selector */}
      <div className='mb-6 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-sm sm:p-5'>
        <label className='block text-sm font-semibold text-gray-700 mb-2'>Select Client</label>
        <div className='relative max-w-md' ref={clientRef}>
          <input
            type='text'
            value={clientSearch}
            onChange={(e) => {
              setClientSearch(e.target.value)
              setClientOpen(true)
              if (!e.target.value) setSelectedClient(null)
            }}
            onFocus={() => setClientOpen(true)}
            placeholder='Search and select a client...'
            className='w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent'
            autoComplete='off'
          />
          {clientOpen && (
            <ul className='absolute z-10 top-full left-0 right-0 mt-1 max-h-56 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg py-1'>
              {filteredClients.length === 0 ? (
                <li className='px-4 py-3 text-sm text-gray-500'>No clients found</li>
              ) : (
                filteredClients.map((c) => (
                  <li
                    key={c._id}
                    onClick={() => handleClientSelect(c)}
                    className={`px-4 py-2.5 text-sm cursor-pointer hover:bg-cyan-50 ${selectedClient?._id === c._id ? 'bg-cyan-100 font-medium' : ''}`}
                  >
                    {c.clientName}
                    {c.businessType && <span className='text-gray-500 ml-2'>({c.businessType})</span>}
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
        <div className='mt-4 max-w-md'>
          <label className='block text-sm font-semibold text-gray-700 mb-2'>Select Project</label>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={!selectedClient}
            className='w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed'
          >
            <option value=''>{selectedClient ? 'Choose project...' : 'Select client first'}</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>{p.projectName}</option>
            ))}
          </select>
        </div>
      </div>

      {!selectedClient || !selectedProjectId ? (
        <div className='rounded-2xl border border-dashed border-slate-300/80 bg-white/60 py-16 text-center shadow-sm'>
          <p className='text-sm font-medium text-slate-600'>Select a client and project to open the calendar</p>
          <p className='mx-auto mt-2 max-w-sm text-xs text-slate-400'>Search above to schedule posts, export, and manage reviews.</p>
        </div>
      ) : loading ? (
        <div className='flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white py-24 shadow-[0_8px_30px_rgb(0,0,0,0.06)]'>
          <div
            className='h-11 w-11 animate-spin rounded-full border-2 border-cyan-500 border-t-transparent'
            aria-hidden
          />
          <p className='mt-4 text-sm font-medium text-slate-600'>Loading calendar…</p>
        </div>
      ) : error ? (
        <p className='text-red-600 text-sm'>{error}</p>
      ) : (
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8'>
          {/* Calendar Grid */}
          <div className='lg:col-span-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]'>
            <div className='h-1.5 bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500' aria-hidden />
            <div className='p-5 sm:p-6'>
              <div className='flex flex-wrap items-start justify-between gap-4 mb-6'>
                <div className='space-y-3'>
                  <div>
                    <p className='text-[11px] font-semibold uppercase tracking-widest text-cyan-600/90'>Schedule</p>
                    <h2 className='text-xl sm:text-2xl font-bold tracking-tight text-slate-900'>{selectedClient.clientName}</h2>
                    <p className='text-sm text-slate-500 mt-0.5'>
                      {new Date(calendarYear, calendarMonth).toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className='inline-flex items-center rounded-full border border-slate-200/90 bg-slate-50/80 p-1 shadow-sm backdrop-blur-sm'>
                    <button
                      type='button'
                      onClick={goPrevMonth}
                      className='rounded-full p-2 text-slate-600 transition hover:bg-white hover:text-slate-900 hover:shadow-sm'
                      title='Previous month'
                    >
                      <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M15 19l-7-7 7-7' />
                      </svg>
                    </button>
                    <div className='flex items-center gap-1.5 px-2'>
                      <select
                        value={calendarMonth}
                        onChange={(e) => setCalendarMonth(Number(e.target.value))}
                        className='max-w-[9.5rem] cursor-pointer rounded-lg border-0 bg-transparent py-1.5 text-sm font-semibold text-slate-800 focus:ring-0 focus:outline-none'
                      >
                        {[...Array(12)].map((_, i) => (
                          <option key={i} value={i}>
                            {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                          </option>
                        ))}
                      </select>
                      <span className='text-slate-300'>·</span>
                      <select
                        value={calendarYear}
                        onChange={(e) => setCalendarYear(Number(e.target.value))}
                        className='w-[4.25rem] cursor-pointer rounded-lg border-0 bg-transparent py-1.5 text-sm font-semibold text-slate-800 focus:ring-0 focus:outline-none'
                      >
                        {[...Array(11)].map((_, i) => {
                          const y = calendarYear - 5 + i
                          return (
                            <option key={y} value={y}>
                              {y}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                    <button
                      type='button'
                      onClick={goNextMonth}
                      className='rounded-full p-2 text-slate-600 transition hover:bg-white hover:text-slate-900 hover:shadow-sm'
                      title='Next month'
                    >
                      <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className='flex flex-wrap gap-2'>
                  <button
                    type='button'
                    onClick={handleDownloadXLS}
                    disabled={!calendar?.posts?.length}
                    className='inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-45'
                    title='Download as Excel'
                  >
                    <svg className='h-4 w-4 text-slate-500' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4' />
                    </svg>
                    Export XLS
                  </button>
                  {canManageSocialCalendar() && (
                    <button
                      type='button'
                      onClick={() => setShowAddPost(true)}
                      className='inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-cyan-500/25 transition hover:from-cyan-500 hover:to-teal-500'
                    >
                      <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                        <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
                      </svg>
                      New post
                    </button>
                  )}
                  {shareLink && (
                    <>
                      <button
                        type='button'
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(shareLink)
                          } catch (err) {
                            console.error('Copy failed:', err)
                          }
                        }}
                        className='inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-700 shadow-sm transition hover:bg-emerald-100'
                      >
                        Copy Client Feed Link
                      </button>
                      <a
                        href={shareLink}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50'
                      >
                        Open Feed
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div className='grid grid-cols-7 gap-1.5 sm:gap-2 mb-2'>
                {WEEKDAYS.map((day, idx) => (
                  <div
                    key={day}
                    className={`rounded-lg py-2.5 text-center text-[11px] font-bold uppercase tracking-wider ${
                      idx === 0 || idx === 6 ? 'bg-violet-50/80 text-violet-600/90' : 'bg-slate-100/90 text-slate-500'
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className='grid grid-cols-7 gap-1.5 sm:gap-2'>
                {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
                  <div key={`empty-${idx}`} className='min-h-[72px] sm:min-h-[96px]' />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                  const dayPosts = getPostsForDay(day)
                  const isEmpty = dayPosts.length === 0
                  const isClickable = isEmpty && canManageSocialCalendar()
                  const today = isToday(day)
                  const wd = weekdayIndexForDay(day)
                  const weekend = wd === 0 || wd === 6
                  return (
                    <div
                      key={day}
                      role={isClickable ? 'button' : undefined}
                      tabIndex={isClickable ? 0 : undefined}
                      onClick={() => isClickable && handleDayClick(day)}
                      onKeyDown={(e) =>
                        isClickable && (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), handleDayClick(day))
                      }
                      className={`group relative flex min-h-[72px] sm:min-h-[96px] flex-col rounded-xl border p-2 transition-all duration-200 sm:p-2.5 ${
                        today
                          ? 'border-cyan-400/90 bg-gradient-to-b from-cyan-50/90 to-white shadow-[0_0_0_3px_rgba(34,211,238,0.22)]'
                          : weekend
                            ? 'border-slate-200/60 bg-gradient-to-b from-violet-50/30 to-slate-50/40'
                            : 'border-slate-200/60 bg-gradient-to-b from-white to-slate-50/60'
                      } ${
                        isClickable
                          ? 'cursor-pointer hover:z-[1] hover:border-cyan-400/70 hover:shadow-lg hover:shadow-cyan-500/10'
                          : dayPosts.length > 0
                            ? 'shadow-sm'
                            : ''
                      } `}
                    >
                      <div className='mb-1 flex items-center justify-between gap-1'>
                        <span
                          className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold tabular-nums sm:text-sm ${
                            today
                              ? 'bg-gradient-to-br from-cyan-500 to-teal-600 text-white shadow-sm'
                              : weekend
                                ? 'text-violet-800 group-hover:text-violet-950'
                                : 'text-slate-800 group-hover:text-slate-950'
                          }`}
                        >
                          {day}
                        </span>
                        {isClickable && (
                          <span className='text-[10px] font-medium text-cyan-600/0 transition group-hover:text-cyan-600'>
                            + Add
                          </span>
                        )}
                      </div>
                      {dayPosts.length > 0 && (
                        <div className='min-h-0 flex-1 space-y-1 overflow-y-auto overflow-x-hidden'>
                          {dayPosts.map((p) => (
                            <div key={p._id} className='flex items-start gap-1'>
                              {canManageSocialCalendar() ? (
                                <button
                                  type='button'
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleEditPost(p)
                                  }}
                                  className='flex min-w-0 flex-1 items-start gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2 py-1.5 text-left text-[11px] leading-tight text-slate-800 shadow-sm transition hover:border-cyan-300/80 hover:bg-cyan-50/40 hover:shadow'
                                >
                                  <span
                                    className={`mt-1 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br ${platformAccentGradient(p.platform)} ring-2 ring-white`}
                                    title={p.platform}
                                  />
                                  <span className='min-w-0 flex-1'>
                                    <span className='line-clamp-2 font-medium'>{p.title}</span>
                                    <span
                                      className={`mt-0.5 inline-flex rounded px-1.5 py-px text-[9px] font-semibold ${CLIENT_REVIEW_BADGE[p.clientReviewStatus || 'Pending'] || CLIENT_REVIEW_BADGE.Pending}`}
                                    >
                                      {p.clientReviewStatus || 'Pending'}
                                    </span>
                                    {getAssignedNames(p.assignedTo) && (
                                      <span className='mt-0.5 block truncate text-[10px] text-cyan-700'>
                                        {getAssignedNames(p.assignedTo)}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              ) : (
                                <span className='flex min-w-0 flex-1 items-start gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2 py-1.5 text-[11px] leading-tight text-slate-800 shadow-sm'>
                                  <span
                                    className={`mt-1 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br ${platformAccentGradient(p.platform)}`}
                                  />
                                  <span className='min-w-0 flex-1'>
                                    <span className='line-clamp-2 font-medium'>{p.title}</span>
                                    <span
                                      className={`mt-0.5 inline-flex rounded px-1.5 py-px text-[9px] font-semibold ${CLIENT_REVIEW_BADGE[p.clientReviewStatus || 'Pending'] || CLIENT_REVIEW_BADGE.Pending}`}
                                    >
                                      {p.clientReviewStatus || 'Pending'}
                                    </span>
                                    {getAssignedNames(p.assignedTo) && (
                                      <span className='mt-0.5 block truncate text-[10px] text-cyan-700'>
                                        {getAssignedNames(p.assignedTo)}
                                      </span>
                                    )}
                                  </span>
                                </span>
                              )}
                              {p.referenceLink && (
                                <a
                                  href={p.referenceLink}
                                  target='_blank'
                                  rel='noopener noreferrer'
                                  onClick={(e) => e.stopPropagation()}
                                  className='mt-0.5 shrink-0 rounded-md p-1 text-cyan-600 transition hover:bg-cyan-100'
                                  title='Open reference link'
                                >
                                  <svg className='h-3.5 w-3.5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path
                                      strokeLinecap='round'
                                      strokeLinejoin='round'
                                      strokeWidth={2}
                                      d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
                                    />
                                  </svg>
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Upcoming Posts Sidebar */}
          <div className='overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.06)]'>
            <div className='border-b border-slate-100 bg-gradient-to-r from-slate-50 to-cyan-50/40 px-5 py-4'>
              <h2 className='text-base font-bold text-slate-900'>Upcoming posts</h2>
              <p className='mt-0.5 text-xs text-slate-500'>Next scheduled items</p>
            </div>
            <div className='p-5'>
            {posts.length === 0 ? (
              <div className='rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-10 text-center'>
                <p className='text-sm font-medium text-slate-600'>No scheduled posts yet</p>
                <p className='mt-1 text-xs text-slate-400'>Add a post from the calendar or use “New post”</p>
              </div>
            ) : (
              <div className='space-y-2.5'>
                {posts
                  .filter((p) => p.scheduledTime)
                  .sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime))
                  .slice(0, 10)
                  .map((p) => (
                    <div
                      key={p._id}
                      className='flex items-start gap-2 rounded-xl border border-slate-200/80 bg-gradient-to-b from-white to-slate-50/60 p-3 shadow-sm'
                    >
                      <span
                        className={`mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gradient-to-br ${platformAccentGradient(p.platform)} ring-2 ring-white`}
                        title={p.platform}
                      />
                      {canManageSocialCalendar() ? (
                        <button
                          type='button'
                          onClick={() => handleEditPost(p)}
                          className='min-w-0 flex-1 text-left transition hover:opacity-90'
                        >
                          <p className='text-sm font-semibold text-slate-900'>{p.title}</p>
                          <p className='mt-0.5 text-xs text-slate-500'>
                            {new Date(p.scheduledTime).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            • {p.platform}
                            {getAssignedNames(p.assignedTo) && ` • ${getAssignedNames(p.assignedTo)}`}
                          </p>
                          <span
                            className={`mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${CLIENT_REVIEW_BADGE[p.clientReviewStatus || 'Pending'] || CLIENT_REVIEW_BADGE.Pending}`}
                          >
                            {p.clientReviewStatus || 'Pending'}
                          </span>
                        </button>
                      ) : (
                        <div className='min-w-0 flex-1'>
                          <p className='text-sm font-semibold text-slate-900'>{p.title}</p>
                          <p className='mt-0.5 text-xs text-slate-500'>
                            {new Date(p.scheduledTime).toLocaleDateString(undefined, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}{' '}
                            • {p.platform}
                            {getAssignedNames(p.assignedTo) && ` • ${getAssignedNames(p.assignedTo)}`}
                          </p>
                          <span
                            className={`mt-1.5 inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold ${CLIENT_REVIEW_BADGE[p.clientReviewStatus || 'Pending'] || CLIENT_REVIEW_BADGE.Pending}`}
                          >
                            {p.clientReviewStatus || 'Pending'}
                          </span>
                        </div>
                      )}
                      {p.referenceLink && (
                        <a
                          href={p.referenceLink}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='shrink-0 rounded-lg p-1.5 text-cyan-600 transition hover:bg-cyan-50'
                          title='Open reference link'
                        >
                          <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14' />
                          </svg>
                        </a>
                      )}
                    </div>
                  ))}
              </div>
            )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Post Modal - only for users who can manage */}
      {canManageSocialCalendar() && ((showAddPost || editingPost) && selectedClient) && (
        <div className='fixed inset-0 z-50 overflow-y-auto'>
          <div className='flex min-h-full items-center justify-center bg-black/50 p-4 sm:p-6'>
            <div className='relative w-full max-w-4xl max-h-[min(90vh,calc(100dvh-2rem))] overflow-y-auto rounded-xl bg-white p-6 shadow-xl'>
              <h3 className='text-lg font-bold text-gray-900 mb-4'>
                {editingPost ? 'Edit Post' : 'Add Social Media Post'}
              </h3>
              <form onSubmit={editingPost ? handleUpdatePost : handleAddPost} className='grid grid-cols-4 gap-4'>
              <div className='col-span-1'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Title</label>
                <input
                  type='text'
                  value={postForm.title}
                  onChange={(e) => setPostForm((f) => ({ ...f, title: e.target.value }))}
                  required
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                  placeholder='Post title'
                />
              </div>
              <div className='col-span-1'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Post Type</label>
                <select
                  value={postForm.contentType}
                  onChange={(e) =>
                    setPostForm((f) => ({
                      ...f,
                      contentType: e.target.value,
                      carouselItems: e.target.value === 'Carousel' ? ensureThreeCarouselSlides(f.carouselItems) : f.carouselItems,
                    }))
                  }
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                >
                  {CONTENT_TYPES.map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              <div className='col-span-1'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Platform</label>
                <select
                  value={postForm.platform}
                  onChange={(e) => setPostForm((f) => ({ ...f, platform: e.target.value }))}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                >
                  {PLATFORMS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className='col-span-1'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Status</label>
                <select
                  value={postForm.status}
                  onChange={(e) => setPostForm((f) => ({ ...f, status: e.target.value }))}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                >
                  <option value='Scheduled'>Scheduled</option>
                  <option value='Published'>Published</option>
                  <option value='Draft'>Draft</option>
                  <option value='Cancelled'>Cancelled</option>
                </select>
              </div>

              {postForm.contentType === 'Carousel' ? (
                <div className='col-span-4 space-y-3'>
                  <div className='grid grid-cols-4 gap-4 items-end'>
                    <div className='col-span-4'>
                      <label className='block text-sm font-medium text-gray-700 mb-1'>Carousel Slides</label>
                      <p className='text-xs text-gray-500'>Slide 1, Slide 2 and Slide 3 each have their own upload reference.</p>
                    </div>
                  </div>
                  {ensureThreeCarouselSlides(postForm.carouselItems).map((item, index) => (
                    <div key={index} className='border border-gray-200 rounded-lg p-3 grid grid-cols-4 gap-4'>
                      <div className='col-span-4 flex items-center justify-between gap-2'>
                        <p className='text-xs font-semibold text-gray-600'>{SLIDE_LABELS[index] || `Slide ${index + 1}`}</p>
                      </div>
                      <div className='col-span-2'>
                        <label className='block text-xs font-medium text-gray-600 mb-1'>Subject</label>
                        <input
                          type='text'
                          value={item.subject}
                          onChange={(e) =>
                            setPostForm((f) => ({
                              ...f,
                              carouselItems: f.carouselItems.map((slide, idx) =>
                                idx === index ? { ...slide, subject: e.target.value } : slide
                              ),
                            }))
                          }
                          placeholder='Subject'
                          className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                        />
                      </div>
                      <div className='col-span-2'>
                        <label className='block text-xs font-medium text-gray-600 mb-1'>Description</label>
                        <textarea
                          value={item.description}
                          onChange={(e) =>
                            setPostForm((f) => ({
                              ...f,
                              carouselItems: f.carouselItems.map((slide, idx) =>
                                idx === index ? { ...slide, description: e.target.value } : slide
                              ),
                            }))
                          }
                          rows={1}
                          placeholder='Description'
                          className='w-full h-[42px] border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y'
                        />
                      </div>
                      <div className='col-span-4'>
                        <label className='block text-xs font-medium text-gray-600 mb-1'>
                          Upload Reference ({SLIDE_LABELS[index] || `Slide ${index + 1}`})
                        </label>
                        <input
                          type='file'
                          onChange={(e) => handleCarouselReferenceUpload(index, e)}
                          className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                        />
                        {item.referenceUpload?.fileName && (
                          <p className='text-xs text-gray-500 mt-1 truncate'>{item.referenceUpload.fileName}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <div className='col-span-2'>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>Subject</label>
                    <input
                      type='text'
                      value={postForm.subject}
                      onChange={(e) => setPostForm((f) => ({ ...f, subject: e.target.value }))}
                      className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                      placeholder='Post subject'
                    />
                  </div>
                  <div className='col-span-2'>
                    <label className='block text-sm font-medium text-gray-700 mb-1'>Description</label>
                    <textarea
                      value={postForm.description}
                      onChange={(e) => setPostForm((f) => ({ ...f, description: e.target.value }))}
                      rows={1}
                      className='w-full h-[42px] border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y'
                      placeholder='Post content...'
                    />
                  </div>
                </>
              )}

              <div className='col-span-2'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Scheduled Date & Time</label>
                <input
                  type='datetime-local'
                  value={postForm.scheduledTime}
                  onChange={(e) => setPostForm((f) => ({ ...f, scheduledTime: e.target.value }))}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                />
              </div>
              <div className='col-span-2'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Reference Link <span className='text-gray-400 font-normal'>(optional)</span></label>
                <input
                  type='url'
                  value={postForm.referenceLink}
                  onChange={(e) => setPostForm((f) => ({ ...f, referenceLink: e.target.value }))}
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                  placeholder='https://...'
                />
              </div>

              {postForm.contentType !== 'Carousel' && (
                <div className='col-span-1'>
                  <label className='block text-sm font-medium text-gray-700 mb-1'>Upload Reference <span className='text-gray-400 font-normal'>(optional)</span></label>
                  <input
                    type='file'
                    onChange={handleReferenceUpload}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                  />
                  {postForm.referenceUpload?.fileName && (
                    <p className='text-xs text-gray-500 mt-1 truncate'>{postForm.referenceUpload.fileName}</p>
                  )}
                </div>
              )}
              <div className={postForm.contentType === 'Carousel' ? 'col-span-4' : 'col-span-3'} ref={assigneeRef}>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Assign To <span className='text-gray-400 font-normal'>(optional, multiple)</span></label>
                <div className='relative'>
                  <input
                    type='text'
                    value={assigneeSearch}
                    onChange={(e) => {
                      setAssigneeSearch(e.target.value)
                      setAssigneeOpen(true)
                    }}
                    onFocus={() => setAssigneeOpen(true)}
                    placeholder='Search employees...'
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm pr-9'
                  />
                  <span className='absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none'>
                    <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                      <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                    </svg>
                  </span>
                  {assigneeOpen && (
                    <div className='absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto'>
                      {filteredEmployees.length === 0 ? (
                        <p className='px-3 py-3 text-sm text-gray-500'>No employees found</p>
                      ) : (
                        filteredEmployees.map((emp) => (
                          <button
                            key={emp._id}
                            type='button'
                            onClick={() => {
                              toggleAssignedEmployee(emp._id)
                              setAssigneeSearch('')
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 ${postForm.assignedTo.some((id) => assigneeIdKey(id) === assigneeIdKey(emp._id)) ? 'bg-cyan-50 text-cyan-800' : ''}`}
                          >
                            {postForm.assignedTo.some((id) => assigneeIdKey(id) === assigneeIdKey(emp._id)) && (
                              <svg className='w-4 h-4 flex-shrink-0' fill='currentColor' viewBox='0 0 20 20'>
                                <path fillRule='evenodd' d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z' clipRule='evenodd' />
                              </svg>
                            )}
                            <span>{emp.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                {postForm.assignedTo.length > 0 && (
                  <div className='flex flex-wrap gap-1.5 mt-2'>
                    {postForm.assignedTo.map((id) => {
                      const emp = employees.find((e) => assigneeIdKey(e._id) === assigneeIdKey(id))
                      return emp ? (
                        <span
                          key={id}
                          className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 text-xs'
                        >
                          {emp.name}
                          <button
                            type='button'
                            onClick={() => toggleAssignedEmployee(id)}
                            className='hover:text-cyan-600'
                            aria-label='Remove'
                          >
                            ×
                          </button>
                        </span>
                      ) : null
                    })}
                  </div>
                )}
              </div>
              <div className='col-span-4 flex gap-3 pt-2 border-t border-gray-100 mt-1'>
                <button
                  type='submit'
                  disabled={savingPost}
                  className='flex-1 bg-cyan-600 hover:bg-cyan-700 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed'
                >
                  {savingPost ? 'Saving...' : editingPost ? 'Update Post' : 'Add Post'}
                </button>
                <button
                  type='button'
                  onClick={closePostModal}
                  disabled={savingPost}
                  className='px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed'
                >
                  Cancel
                </button>
              </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SocialCalendarView
