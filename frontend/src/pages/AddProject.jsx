import React, { useEffect, useState, useRef } from 'react'
import api from '../api/axios'
import { useNavigate, useParams } from 'react-router-dom'

const isManagerOrLeader = (employee) => {
  const accessRole = String(employee?.designation?.accessRole || '').toLowerCase()
  if (['admin', 'hr', 'manager', 'technical_lead'].includes(accessRole)) return true

  const title = String(employee?.designation?.title || employee?.designation?.name || '').toLowerCase()
  return ['manager', 'lead', 'head'].some((keyword) => title.includes(keyword))
}

const AddProject = () => {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form, setForm] = useState({
    projectName: '',
    department: 'IT',
    client: '',
    description: '',
    status: 'Not Started',
    priority: 'Medium',
    startDate: '',
    endDate: '',
    deadline: '',
    budget: '',
    progress: 0,
    projectManager: '',
    teamMembers: [],
    notes: '',
  })
  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])
  const [clientSearch, setClientSearch] = useState('')
  const [clientOpen, setClientOpen] = useState(false)
  const [managerSearch, setManagerSearch] = useState('')
  const [managerOpen, setManagerOpen] = useState(false)
  const [teamMemberSearch, setTeamMemberSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const clientRef = useRef(null)
  const managerRef = useRef(null)

  const navigate = useNavigate()
  const toId = (val) => {
    if (!val) return ''
    if (typeof val === 'object') {
      if (val._id || val.id) return toId(val._id || val.id)
      if (typeof val.toHexString === 'function') return val.toHexString()
      const asString = typeof val.toString === 'function' ? val.toString() : String(val)
      return asString === '[object Object]' ? '' : asString
    }
    return String(val)
  }

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await api.get('/clients')
        const payload = res.data
        setClients(Array.isArray(payload) ? payload : payload?.data || [])
      } catch (err) {
        console.error('Failed to fetch clients:', err)
      }
    }
    const fetchEmployees = async () => {
      try {
        const res = await api.get('/employees')
        const payload = res.data
        setEmployees(Array.isArray(payload) ? payload : payload?.data || [])
      } catch (err) {
        console.error('Failed to fetch employees:', err)
      }
    }
    fetchClients()
    fetchEmployees()
  }, [])

  useEffect(() => {
    if (!id) return
    const fetchProject = async () => {
      try {
        const res = await api.get(`/projects/${id}`)
        const p = res.data?.project ?? res.data
        if (!p || typeof p !== 'object') {
          setError('Project not found')
          return
        }
        const clientId = toId(p.client?._id ?? p.client)
        const clientName = p.client?.clientName ?? ''
        const managerId = toId(p.projectManager?._id ?? p.projectManager)
        const managerName = p.projectManager?.name ?? ''
        const teamIds = (p.teamMembers || []).map((t) => toId(typeof t === 'object' ? t._id ?? t : t)).filter(Boolean)
        setForm({
          projectName: p.projectName ?? '',
          department: p.department ?? 'IT',
          client: clientId ?? '',
          description: p.description ?? '',
          status: p.status ?? 'Not Started',
          priority: p.priority ?? 'Medium',
          startDate: p.startDate ? p.startDate.split('T')[0] : '',
          endDate: p.endDate ? p.endDate.split('T')[0] : '',
          deadline: p.deadline ? p.deadline.split('T')[0] : '',
          budget: p.budget ?? '',
          progress: p.progress ?? 0,
          projectManager: managerId ?? '',
          teamMembers: teamIds,
          notes: p.notes ?? '',
        })
        setClientSearch(clientName)
        setManagerSearch(managerName)
      } catch (err) {
        console.error('Failed to fetch project:', err)
        setError(err.response?.data?.message || err.message || 'Error loading project')
      }
    }
    fetchProject()
  }, [id])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (clientRef.current && !clientRef.current.contains(e.target)) setClientOpen(false)
      if (managerRef.current && !managerRef.current.contains(e.target)) setManagerOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredClients = clients.filter((c) =>
    (c.clientName || '').toLowerCase().includes(clientSearch.toLowerCase())
  )
  const managerCandidates = employees.filter(isManagerOrLeader)
  const filteredEmployees = managerCandidates.filter((e) =>
    (e.name || '').toLowerCase().includes(managerSearch.toLowerCase())
  )

  const handleClientSelect = (c) => {
    setForm((f) => ({ ...f, client: c._id }))
    setClientSearch(c.clientName || '')
    setClientOpen(false)
  }

  const handleManagerSelect = (e) => {
    setForm((f) => ({ ...f, projectManager: e._id }))
    setManagerSearch(e.name || '')
    setManagerOpen(false)
  }

  const handleTeamMemberToggle = (empId) => {
    setForm((f) => ({
      ...f,
      teamMembers: f.teamMembers.includes(empId)
        ? f.teamMembers.filter((id) => id !== empId)
        : [...f.teamMembers, empId],
    }))
  }

  const filteredTeamEmployees = employees.filter((e) =>
    (e.name || '').toLowerCase().includes(teamMemberSearch.toLowerCase())
  )

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.client) {
      setError('Please select a client')
      return
    }
    if (!form.startDate) {
      setError('Please select a start date')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const toNullableDate = (value) => (value ? value : null)
      const payload = {
        ...form,
        client: toId(form.client) || null,
        budget: form.budget === '' ? undefined : Number(form.budget),
        progress: form.progress === '' ? 0 : Number(form.progress),
        projectManager: toId(form.projectManager) || null,
        teamMembers: Array.isArray(form.teamMembers) ? form.teamMembers.map(toId).filter(Boolean) : [],
        endDate: toNullableDate(form.endDate),
        deadline: toNullableDate(form.deadline),
      }
      if (isEdit) {
        await api.put(`/projects/${id}`, payload)
      } else {
        await api.post('/projects', payload)
      }
      navigate('/projects')
    } catch (err) {
      setError(err.response?.data?.message || err.message || (isEdit ? 'Error updating project' : 'Error creating project'))
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'mt-2 block w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

  return (
    <div className='p-4 md:p-5 w-full flex flex-col'>
      <h1 className='text-2xl font-bold text-gray-900 mb-4 md:mb-5 text-center w-full'>{isEdit ? 'Edit Project' : 'Add New Project'}</h1>

      <form onSubmit={handleSubmit} className='w-full'>
        <div className='bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden'>
          <div className='px-4 py-3 md:px-5 md:py-4 border-b border-blue-700 bg-blue-600'>
            <h2 className='text-lg font-semibold text-white'>Project details</h2>
            <p className='text-sm text-white mt-0.5'>Basic information and timeline</p>
          </div>

          <div className='p-4 space-y-5 md:p-5'>
            {/* Row 1: Project Name, Department, Client (col-span-2) */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Project Name</label>
                <input name='projectName' value={form.projectName} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Department</label>
                <select name='department' value={form.department} onChange={handleChange} className={inputClass}>
                  <option value='IT'>IT</option>
                  <option value='Marketing'>Marketing</option>
                </select>
              </div>
              <div className='sm:col-span-2 relative' ref={clientRef}>
                <div className='flex items-center justify-between gap-2'>
                  <label className='block text-sm font-medium text-gray-700'>Client</label>
                  <button
                    type='button'
                    onClick={() => navigate('/add-client')}
                    className='text-xs font-semibold text-blue-600 hover:text-blue-800'
                  >
                    + New client
                  </button>
                </div>
                <input
                  type='text'
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value)
                    setClientOpen(true)
                    if (!e.target.value) setForm((f) => ({ ...f, client: '' }))
                  }}
                  onFocus={() => setClientOpen(true)}
                  placeholder='Search client...'
                  className={inputClass}
                  autoComplete='off'
                />
                {clientOpen && (
                  <ul className='absolute z-10 top-full left-0 right-0 mt-1 w-full max-h-48 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg py-1'>
                    {filteredClients.length === 0 ? (
                      <li className='px-4 py-2 text-sm text-gray-500'>No clients found</li>
                    ) : (
                      filteredClients.map((c) => (
                        <li
                          key={c._id}
                          onClick={() => handleClientSelect(c)}
                          className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${form.client === c._id ? 'bg-blue-100' : ''}`}
                        >
                          {c.clientName}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>

            {/* Row 2: Description (col-span-4) */}
            <div className='col-span-full'>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Description</label>
              <textarea name='description' value={form.description} onChange={handleChange} rows={3} className={inputClass} />
            </div>

            {/* Row 3: Status, Priority, Start Date, End Date */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Status</label>
                <select name='status' value={form.status} onChange={handleChange} className={inputClass}>
                  <option value='Not Started'>Not Started</option>
                  <option value='In Progress'>In Progress</option>
                  <option value='On Hold'>On Hold</option>
                  <option value='Completed'>Completed</option>
                  <option value='Cancelled'>Cancelled</option>
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Priority</label>
                <select name='priority' value={form.priority} onChange={handleChange} className={inputClass}>
                  <option value='Low'>Low</option>
                  <option value='Medium'>Medium</option>
                  <option value='High'>High</option>
                  <option value='Urgent'>Urgent</option>
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Start Date</label>
                <input name='startDate' type='date' value={form.startDate} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>End Date</label>
                <input name='endDate' type='date' value={form.endDate} onChange={handleChange} className={inputClass} />
              </div>
            </div>

            {/* Row 4: Deadline, Budget, Progress, Project Manager */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Deadline</label>
                <input name='deadline' type='date' value={form.deadline} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Budget</label>
                <input name='budget' type='number' value={form.budget} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Progress (%)</label>
                <input name='progress' type='number' min={0} max={100} value={form.progress} onChange={handleChange} className={inputClass} />
              </div>
              <div className='relative' ref={managerRef}>
                <label className='block text-sm font-medium text-gray-700'>Project Manager</label>
                <input
                  type='text'
                  value={managerSearch}
                  onChange={(e) => {
                    setManagerSearch(e.target.value)
                    setManagerOpen(true)
                    if (!e.target.value) setForm((f) => ({ ...f, projectManager: '' }))
                  }}
                  onFocus={() => setManagerOpen(true)}
                  placeholder='Search employee...'
                  className={inputClass}
                  autoComplete='off'
                />
                {managerOpen && (
                  <ul className='absolute z-10 top-full left-0 right-0 mt-1 w-full max-h-48 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg py-1'>
                    {filteredEmployees.length === 0 ? (
                      <li className='px-4 py-2 text-sm text-gray-500'>No managers or leaders found</li>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <li
                          key={emp._id}
                          onClick={() => handleManagerSelect(emp)}
                          className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${form.projectManager === emp._id ? 'bg-blue-100' : ''}`}
                        >
                          {emp.name}
                          {emp.designation?.title ? ` (${emp.designation.title})` : ''}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>

            {/* Row 5: Assign Employees (col-span-4) */}
            <div className='col-span-full'>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Assign Employees</label>
              <input
                type='text'
                value={teamMemberSearch}
                onChange={(e) => setTeamMemberSearch(e.target.value)}
                placeholder='Search employees to assign...'
                className='mt-2 block w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'
              />
              <div className='mt-3 max-h-40 overflow-auto border border-gray-200 rounded-lg p-4 space-y-2 bg-gray-50/50'>
                {filteredTeamEmployees.length === 0 ? (
                  <p className='text-sm text-gray-500'>No employees found</p>
                ) : (
                  filteredTeamEmployees.map((emp) => (
                    <label key={emp._id} className='flex items-center gap-2 text-sm cursor-pointer hover:bg-white p-2 rounded-lg'>
                      <input
                        type='checkbox'
                        checked={form.teamMembers.includes(emp._id)}
                        onChange={() => handleTeamMemberToggle(emp._id)}
                        className='rounded border-gray-300'
                      />
                      {emp.name}
                      {emp.designation?.title ? ` (${emp.designation.title})` : ''}
                    </label>
                  ))
                )}
              </div>
              {form.teamMembers.length > 0 && (
                <p className='text-xs text-gray-500 mt-2'>{form.teamMembers.length} employee(s) assigned</p>
              )}
            </div>

            {/* Row 6: Notes (col-span-4) */}
            <div className='col-span-full'>
              <label className='block text-sm font-medium text-gray-700 mb-1'>Notes</label>
              <textarea name='notes' value={form.notes} onChange={handleChange} rows={3} className={inputClass} />
            </div>

            {error && (
              <div className='rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
                <p className='text-red-600 text-sm'>{error}</p>
              </div>
            )}
          </div>

          <div className='px-4 py-3 md:px-5 md:py-4 border-t border-gray-200 bg-gray-50/50 flex flex-wrap items-center gap-3'>
            <button
              type='submit'
              disabled={loading}
              className='bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm disabled:opacity-50'
            >
              {loading ? 'Saving...' : isEdit ? 'Update Project' : 'Save Project'}
            </button>
            <button
              type='button'
              onClick={() => navigate('/projects')}
              className='px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 text-gray-700'
            >
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AddProject
