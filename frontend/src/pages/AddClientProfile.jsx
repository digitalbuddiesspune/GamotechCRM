import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/axios'

const initialForm = {
  client: '',
  project: '',
  totalCreatedTasks: 0,
  totalCompletedTasks: 0,
  totalPendingTasks: 0,
  delayedTasks: 0,
  socialMediaCalendars: [],
  totalInvoicesGenerated: 0,
  totalAmountPaid: 0,
  totalAmountPending: 0,
  projectDeadline: '',
  nextProjectDeadline: '',
}

const toNumber = (v) => {
  const n = Number(v)
  return Number.isNaN(n) ? 0 : n
}

const toDateInput = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const AddClientProfile = () => {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = Boolean(id)

  const [clients, setClients] = useState([])
  const [projects, setProjects] = useState([])
  const [calendars, setCalendars] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [autoFilling, setAutoFilling] = useState(false)
  const [error, setError] = useState(null)
  const [formError, setFormError] = useState(null)
  const [selectedProjectMeta, setSelectedProjectMeta] = useState(null)
  const [form, setForm] = useState(initialForm)

  const fetchBaseData = async () => {
    const [clientsRes, projectsRes, calendarsRes] = await Promise.all([
      api.get('/clients'),
      api.get('/projects'),
      api.get('/social-calendars'),
    ])
    setClients(Array.isArray(clientsRes.data) ? clientsRes.data : clientsRes.data?.data || [])
    setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data?.data || [])
    setCalendars(Array.isArray(calendarsRes.data) ? calendarsRes.data : calendarsRes.data?.data || [])
  }

  const fetchProfileIfEdit = async () => {
    if (!isEdit) return
    const res = await api.get(`/client-profiles/${id}`)
    const p = res.data
    setForm({
      client: p.client?._id || p.client || '',
      project: p.project?._id || p.project || '',
      totalCreatedTasks: p.totalCreatedTasks ?? 0,
      totalCompletedTasks: p.totalCompletedTasks ?? 0,
      totalPendingTasks: p.totalPendingTasks ?? 0,
      delayedTasks: p.delayedTasks ?? 0,
      socialMediaCalendars: Array.isArray(p.socialMediaCalendars) ? p.socialMediaCalendars.map((c) => c?._id || c) : [],
      totalInvoicesGenerated: p.totalInvoicesGenerated ?? 0,
      totalAmountPaid: p.totalAmountPaid ?? 0,
      totalAmountPending: p.totalAmountPending ?? 0,
      projectDeadline: toDateInput(p.projectDeadline),
      nextProjectDeadline: toDateInput(p.nextProjectDeadline),
    })
    setSelectedProjectMeta({
      projectName: p.project?.projectName || '—',
      projectCost: Number(p.project?.budget || 0),
      deadline: toDateInput(p.project?.deadline || p.project?.endDate),
      status: p.project?.status || '—',
    })
  }

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        await fetchBaseData()
        await fetchProfileIfEdit()
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load form data')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const clientOptions = useMemo(() => {
    return clients.map((c) => ({ value: c._id, label: c.clientName || c.mailId || c._id }))
  }, [clients])

  const projectOptions = useMemo(() => {
    return projects.map((p) => ({
      value: p._id,
      clientId: p.client?._id || p.client || '',
      label: `${p.projectName || 'Project'}${p.client?.clientName ? ` (${p.client.clientName})` : ''}`,
    }))
  }, [projects])

  const filteredProjectOptions = useMemo(() => {
    if (!form.client) return []
    return projectOptions.filter((p) => String(p.clientId) === String(form.client))
  }, [projectOptions, form.client])

  const handleInput = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const handleCalendarMultiSelect = (e) => {
    const values = Array.from(e.target.selectedOptions).map((o) => o.value)
    handleInput('socialMediaCalendars', values)
  }

  const applyProjectAutoData = async (projectId, clientId) => {
    if (!projectId || !clientId) return
    const selectedProject = projects.find((p) => String(p._id) === String(projectId))
    const projectBudget = Number(selectedProject?.budget || 0)
    const deadlineDate = selectedProject?.deadline || selectedProject?.endDate || null
    setSelectedProjectMeta({
      projectName: selectedProject?.projectName || '—',
      projectCost: projectBudget,
      deadline: deadlineDate ? toDateInput(deadlineDate) : '',
      status: selectedProject?.status || '—',
    })

    try {
      setAutoFilling(true)
      const [tasksRes, billingsRes, trackingRes, calendarsRes] = await Promise.all([
        api.get('/tasks', { params: { projectId } }),
        api.get('/billing', { params: { clientId } }),
        api.get(`/billing/tracking/${clientId}`),
        api.get('/social-calendars', { params: { client: clientId } }),
      ])
      const tasks = Array.isArray(tasksRes.data) ? tasksRes.data : []
      const billings = Array.isArray(billingsRes.data) ? billingsRes.data : []
      const tracking = Array.isArray(trackingRes.data?.tracking) ? trackingRes.data.tracking : []
      const calendarsList = Array.isArray(calendarsRes.data) ? calendarsRes.data : []

      const totalCreatedTasks = tasks.length
      const totalCompletedTasks = tasks.filter((t) => t.status === 'Completed').length
      const totalPendingTasks = tasks.filter((t) => ['Pending', 'In Progress'].includes(t.status)).length
      const delayedTasks = tasks.filter((t) => {
        if (!t?.dueDate) return false
        const due = new Date(t.dueDate)
        return due < new Date() && !['Completed', 'Cancelled'].includes(t.status)
      }).length

      const projectTracking = tracking.find((t) => String(t.project?._id || t.project) === String(projectId))
      const totalAmountPaid = Number(projectTracking?.totalPaid || 0)
      const totalAmountPending = projectTracking ? Number(projectTracking.remaining || 0) : projectBudget
      const totalInvoicesGenerated = billings.filter((b) =>
        Array.isArray(b.projects) && b.projects.some((bp) => String(bp.project?._id || bp.project) === String(projectId))
      ).length

      setForm((prev) => ({
        ...prev,
        totalCreatedTasks,
        totalCompletedTasks,
        totalPendingTasks,
        delayedTasks,
        totalInvoicesGenerated,
        totalAmountPaid,
        totalAmountPending,
        socialMediaCalendars: calendarsList.map((c) => c._id),
        projectDeadline: deadlineDate ? toDateInput(deadlineDate) : prev.projectDeadline,
        nextProjectDeadline: deadlineDate ? toDateInput(deadlineDate) : prev.nextProjectDeadline,
      }))
    } finally {
      setAutoFilling(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormError(null)
    if (!form.client) return setFormError('Please select a client')
    if (!form.project) return setFormError('Please select a project')

    const payload = {
      client: form.client,
      project: form.project,
      totalCreatedTasks: toNumber(form.totalCreatedTasks),
      totalCompletedTasks: toNumber(form.totalCompletedTasks),
      totalPendingTasks: toNumber(form.totalPendingTasks),
      delayedTasks: toNumber(form.delayedTasks),
      socialMediaCalendars: Array.isArray(form.socialMediaCalendars) ? form.socialMediaCalendars : [],
      totalInvoicesGenerated: toNumber(form.totalInvoicesGenerated),
      totalAmountPaid: toNumber(form.totalAmountPaid),
      totalAmountPending: toNumber(form.totalAmountPending),
      projectDeadline: form.projectDeadline || null,
      nextProjectDeadline: form.nextProjectDeadline || null,
      lastSyncedAt: new Date().toISOString(),
    }

    try {
      setSaving(true)
      if (isEdit) {
        await api.patch(`/client-profiles/${id}`, payload)
      } else {
        await api.post('/client-profiles', payload)
      }
      navigate('/client-profiles')
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to save client profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className='p-8 text-sm text-gray-600'>Loading...</div>
  if (error) return <div className='p-8 text-sm text-red-600'>{error}</div>

  return (
    <div className='p-8'>
      <div className='mb-6 flex items-center justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>{isEdit ? 'Edit Client Profile' : 'Create Client Profile'}</h1>
          <p className='text-gray-600 mt-1 text-sm'>Select client, select project, then profile data gets auto-filled.</p>
        </div>
        <button onClick={() => navigate('/client-profiles')} className='text-sm text-gray-700 hover:text-gray-900'>Back to Profiles</button>
      </div>

      <form onSubmit={handleSubmit} className='bg-white rounded-lg shadow border border-gray-100 p-4'>
        <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Client</label>
            <select
              value={form.client}
              onChange={(e) => setForm((prev) => ({ ...prev, client: e.target.value, project: '' }))}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
              disabled={isEdit}
            >
              <option value=''>Select client</option>
              {clientOptions.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Project</label>
            <select
              value={form.project}
              onChange={async (e) => {
                const projectId = e.target.value
                handleInput('project', projectId)
                if (projectId) await applyProjectAutoData(projectId, form.client)
                else setSelectedProjectMeta(null)
              }}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
              disabled={!form.client}
            >
              <option value=''>{form.client ? 'Select project' : 'Select client first'}</option>
              {filteredProjectOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>

          {selectedProjectMeta && (
            <div className='md:col-span-3 rounded-lg border border-blue-100 bg-blue-50 p-3'>
              <p className='text-sm font-semibold text-blue-900 mb-1'>Project Info (auto-filled)</p>
              <div className='grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-blue-900'>
                <p><span className='font-medium'>Name:</span> {selectedProjectMeta.projectName}</p>
                <p><span className='font-medium'>Cost:</span> ₹{Number(selectedProjectMeta.projectCost || 0).toLocaleString('en-IN')}</p>
                <p><span className='font-medium'>Deadline:</span> {selectedProjectMeta.deadline || '—'}</p>
                <p><span className='font-medium'>Status:</span> {selectedProjectMeta.status || '—'}</p>
              </div>
            </div>
          )}

          <div><label className='block text-sm font-medium text-gray-700 mb-1'>Total Created Tasks</label><input type='number' min='0' value={form.totalCreatedTasks} onChange={(e) => handleInput('totalCreatedTasks', e.target.value)} className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm' /></div>
          <div><label className='block text-sm font-medium text-gray-700 mb-1'>Total Completed Tasks</label><input type='number' min='0' value={form.totalCompletedTasks} onChange={(e) => handleInput('totalCompletedTasks', e.target.value)} className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm' /></div>
          <div><label className='block text-sm font-medium text-gray-700 mb-1'>Total Pending Tasks</label><input type='number' min='0' value={form.totalPendingTasks} onChange={(e) => handleInput('totalPendingTasks', e.target.value)} className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm' /></div>
          <div><label className='block text-sm font-medium text-gray-700 mb-1'>Delayed Tasks</label><input type='number' min='0' value={form.delayedTasks} onChange={(e) => handleInput('delayedTasks', e.target.value)} className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm' /></div>
          <div><label className='block text-sm font-medium text-gray-700 mb-1'>Total Invoices Generated</label><input type='number' min='0' value={form.totalInvoicesGenerated} onChange={(e) => handleInput('totalInvoicesGenerated', e.target.value)} className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm' /></div>
          <div><label className='block text-sm font-medium text-gray-700 mb-1'>Total Amount Paid</label><input type='number' min='0' value={form.totalAmountPaid} onChange={(e) => handleInput('totalAmountPaid', e.target.value)} className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm' /></div>
          <div><label className='block text-sm font-medium text-gray-700 mb-1'>Total Amount Pending</label><input type='number' min='0' value={form.totalAmountPending} onChange={(e) => handleInput('totalAmountPending', e.target.value)} className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm' /></div>
          <div><label className='block text-sm font-medium text-gray-700 mb-1'>Project Deadline</label><input type='date' value={form.projectDeadline} onChange={(e) => handleInput('projectDeadline', e.target.value)} className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm' /></div>
          <div><label className='block text-sm font-medium text-gray-700 mb-1'>Next Project Deadline</label><input type='date' value={form.nextProjectDeadline} onChange={(e) => handleInput('nextProjectDeadline', e.target.value)} className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm' /></div>
          <div className='md:col-span-2'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Social Media Calendars</label>
            <select multiple value={form.socialMediaCalendars} onChange={handleCalendarMultiSelect} className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[96px]'>
              {calendars.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.client?.clientName || c.client || 'Client'} - {Array.isArray(c.posts) ? c.posts.length : 0} posts
                </option>
              ))}
            </select>
          </div>
        </div>

        {formError && <p className='text-red-600 text-sm mt-3'>{formError}</p>}
        {autoFilling && <p className='text-blue-700 text-sm mt-2'>Auto-filling project related information...</p>}

        <div className='mt-4'>
          <button type='submit' disabled={saving} className='bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50'>
            {saving ? 'Saving...' : isEdit ? 'Update Profile' : 'Create Profile'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddClientProfile

