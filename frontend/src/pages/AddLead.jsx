import React, { useEffect, useMemo, useState, useRef } from 'react'
import api from '../api/axios'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SearchableSelect from '../components/SearchableSelect'

const STATUS_OPTIONS = [
  'Call not Received',
  'Call You After Sometime',
  'Interested',
  'Not Interested',
  'Meeting Schedule',
]

const normalizeFollowUpsFromApi = (arr) =>
  (Array.isArray(arr) ? arr : []).map((fu) => ({
    _id: fu._id,
    date: fu.date ? new Date(fu.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    comments: fu.comments ?? fu.text ?? '',
  }))

const followUpDateToDisplay = (dateVal) => {
  if (!dateVal) return '—'
  const s = typeof dateVal === 'string' ? dateVal : ''
  const d =
    s && /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(`${s}T12:00:00`) : new Date(dateVal)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString()
}

const AddLead = ({ readOnly = false }) => {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const location = useLocation()
  const { user } = useAuth()
  const [form, setForm] = useState({
    name: '',
    businessName: '',
    contactNumber: '',
    address: '',
    city: '',
    state: '',
    businessType: '',
    leadSource: '',
    description: '',
    status: 'Call not Received',
    meetingType: '',
    meetingPersonName: '',
    meetingTime: '',
    meetingInfoSent: false,
    followUps: [],
    generatedBy: '',
  })
  const [employees, setEmployees] = useState([])
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [employeeOpen, setEmployeeOpen] = useState(false)
  const [meetingPersonSearch, setMeetingPersonSearch] = useState('')
  const [meetingPersonOpen, setMeetingPersonOpen] = useState(false)
  const [followUpDate, setFollowUpDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [followUpComments, setFollowUpComments] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const employeeRef = useRef(null)
  const meetingPersonRef = useRef(null)

  const navigate = useNavigate()

  const fetchCitiesByStateCode = async (stateCode) => {
    if (!stateCode) {
      setCities([])
      return
    }
    try {
      const res = await api.get('/locations/cities', { params: { stateCode } })
      setCities(Array.isArray(res.data) ? res.data : [])
    } catch {
      setCities([])
    }
  }

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [employeesRes, statesRes] = await Promise.all([
          api.get('/employees'),
          api.get('/locations/states'),
        ])
        const payload = employeesRes.data
        setEmployees(Array.isArray(payload) ? payload : payload?.data || [])
        setStates(Array.isArray(statesRes.data) ? statesRes.data : [])
      } catch (err) {
        console.error('Failed to fetch initial lead form data:', err)
      }
    }
    fetchInitialData()
  }, [])

  useEffect(() => {
    if (!id) return
    const fetchLead = async () => {
      try {
        const res = await api.get(`/leads/${id}`)
        const l = res.data
        const genId = l.generatedBy?._id ?? l.generatedBy
        const genName = l.generatedBy?.name ?? ''
        setForm({
          name: l.name ?? '',
          businessName: l.businessName ?? '',
          contactNumber: l.contactNumber ?? '',
          address: l.address ?? '',
          city: l.city ?? '',
          state: l.state ?? '',
          businessType: l.businessType ?? '',
          leadSource: l.leadSource ?? '',
          description: l.description ?? '',
          status: l.status ?? 'Call not Received',
          meetingType: l.meetingType ?? '',
          meetingPersonName: l.meetingPersonName ?? '',
          meetingTime: l.meetingTime ? new Date(l.meetingTime).toISOString().slice(0, 16) : '',
          meetingInfoSent: l.meetingInfoSent ?? false,
          followUps: normalizeFollowUpsFromApi(l.followUps),
          generatedBy: genId ?? '',
        })
        setEmployeeSearch(genName)
        setMeetingPersonSearch(l.meetingPersonName ?? '')
      } catch (err) {
        console.error('Failed to fetch lead:', err)
        setError(err.response?.data?.message || err.message || 'Error loading lead')
      }
    }
    fetchLead()
  }, [id])

  useEffect(() => {
    if (isEdit) return
    const loggedInUserId = user?._id || user?.id || ''
    if (!loggedInUserId) return
    setForm((f) => ({
      ...f,
      generatedBy: f.generatedBy || loggedInUserId,
    }))
    if (user?.name) {
      setEmployeeSearch((prev) => prev || user.name)
    }
  }, [isEdit, user?._id, user?.id, user?.name])

  useEffect(() => {
    if (isEdit) return
    const params = new URLSearchParams(location.search)
    const isMeeting = params.get('meeting') === '1'
    if (!isMeeting) return
    setForm((f) => ({
      ...f,
      status: 'Meeting Schedule',
      generatedBy: f.generatedBy || user?._id || '',
    }))
    if (user?.name && !employeeSearch) {
      setEmployeeSearch(user.name)
    }
  }, [location.search, isEdit, user?._id, user?.name, employeeSearch])

  useEffect(() => {
    if (employeeSearch || !form.generatedBy || employees.length === 0) return
    const matched = employees.find((e) => e?._id === form.generatedBy)
    if (matched?.name) setEmployeeSearch(matched.name)
  }, [employeeSearch, form.generatedBy, employees])

  useEffect(() => {
    if (!form.state || states.length === 0) return
    const matched = states.find((s) => s.name === form.state)
    if (matched?.iso2) fetchCitiesByStateCode(matched.iso2)
  }, [form.state, states])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (employeeRef.current && !employeeRef.current.contains(e.target)) setEmployeeOpen(false)
      if (meetingPersonRef.current && !meetingPersonRef.current.contains(e.target)) setMeetingPersonOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const MEETING_PERSON_DESIGNATIONS = ['Sales Manager', 'Social Media Manager', 'Product Manager', 'Senior Software Engineer', 'Software Engineer']

  const filteredEmployees = employees.filter((e) =>
    (e.name || '').toLowerCase().includes(employeeSearch.toLowerCase())
  )

  const meetingPersonEmployees = employees.filter((e) => {
    const designationTitle = e.designation?.title || (typeof e.designation === 'string' ? e.designation : '')
    return MEETING_PERSON_DESIGNATIONS.some((d) =>
      (designationTitle || '').toLowerCase() === d.toLowerCase()
    )
  })

  const filteredMeetingPersonEmployees = meetingPersonEmployees.filter((e) =>
    (e.name || '').toLowerCase().includes(meetingPersonSearch.toLowerCase())
  )

  const stateOptions = useMemo(
    () => states.map((s) => ({ value: s.name, label: s.name })),
    [states]
  )

  const cityOptions = useMemo(() => cities.map((c) => ({ value: c.name, label: c.name })), [cities])

  const handleEmployeeSelect = (emp) => {
    setForm((f) => ({ ...f, generatedBy: emp._id }))
    setEmployeeSearch(emp.name || '')
    setEmployeeOpen(false)
  }

  const handleMeetingPersonSelect = (emp) => {
    setForm((f) => ({ ...f, meetingPersonName: emp.name || '' }))
    setMeetingPersonSearch(emp.name || '')
    setMeetingPersonOpen(false)
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (readOnly) return
    if (!form.generatedBy) {
      setError('Please select Lead Generated By')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const pendingFollowUpComment = followUpComments.trim()
      const pendingFollowUp =
        pendingFollowUpComment && followUpDate
          ? [{ date: followUpDate, comments: pendingFollowUpComment }]
          : []
      const payload = {
        ...form,
        meetingType: form.meetingType || undefined,
        meetingTime: form.meetingTime ? new Date(form.meetingTime) : undefined,
        followUps: [...form.followUps, ...pendingFollowUp].map((fu) => {
          const piece = {
            comments: (fu.comments ?? fu.text ?? '').trim(),
            date:
              typeof fu.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fu.date)
                ? new Date(`${fu.date}T12:00:00`)
                : fu.date
                  ? new Date(fu.date)
                  : new Date(),
          }
          if (fu._id) piece._id = fu._id
          return piece
        }),
      }
      if (isEdit) {
        await api.put(`/leads/${id}`, payload)
      } else {
        await api.post('/leads', payload)
      }
      navigate('/leads')
    } catch (err) {
      setError(err.response?.data?.message || err.message || (isEdit ? 'Error updating lead' : 'Error creating lead'))
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'mt-1.5 block w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

  return (
    <div className='p-4 md:p-6 w-full flex flex-col'>
      <h1 className='text-2xl font-bold text-gray-900 mb-4 text-center w-full'>{readOnly ? 'View Lead' : isEdit ? 'Edit Lead' : 'Add Lead'}</h1>
      <form onSubmit={handleSubmit} className='w-full'>
        <div className='bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden'>
          <div className='px-4 py-3 md:px-5 border-b border-blue-700 bg-blue-600'>
            <h2 className='text-lg font-semibold text-white'>Lead details</h2>
            <p className='text-sm text-blue-100 mt-0.5'>Track lead source, status, meeting details and follow-ups.</p>
          </div>

          <div className='p-4 pt-6 md:p-5 md:pt-7 space-y-6 md:space-y-8'>
            <fieldset disabled={readOnly} className='contents'>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 md:gap-x-4 gap-y-5 md:gap-y-6 py-1 md:py-2'>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>Name</label>
                  <input name='name' value={form.name} onChange={handleChange} required className={inputClass} />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>Business Name</label>
                  <input name='businessName' value={form.businessName} onChange={handleChange} required className={inputClass} />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>Contact Number</label>
                  <input name='contactNumber' value={form.contactNumber} onChange={handleChange} required className={inputClass} />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>Business Type</label>
                  <input name='businessType' value={form.businessType} onChange={handleChange} className={inputClass} />
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 md:gap-x-4 gap-y-5 md:gap-y-6 py-1 md:py-2'>
                <div>
                  <SearchableSelect
                    id='lead-state'
                    label='State'
                    value={form.state}
                    onChange={(stateName) => {
                      const selected = states.find((s) => s.name === stateName)
                      setForm((f) => ({ ...f, state: stateName || '', city: '' }))
                      fetchCitiesByStateCode(selected?.iso2 || '')
                    }}
                    options={stateOptions}
                    disabled={readOnly}
                    placeholder='Select state'
                    searchPlaceholder='Search state…'
                    emptyText='No states match'
                    inputClassName={inputClass}
                  />
                </div>
                <div>
                  <SearchableSelect
                    id='lead-city'
                    label='City'
                    value={form.city}
                    onChange={(cityName) => setForm((f) => ({ ...f, city: cityName || '' }))}
                    options={cityOptions}
                    disabled={readOnly || !form.state}
                    placeholder={form.state ? 'Select city' : 'Select state first'}
                    searchPlaceholder='Search city…'
                    emptyText='No cities match'
                    inputClassName={inputClass}
                  />
                </div>
                <div className='lg:col-span-2'>
                  <label className='block text-sm font-medium text-gray-700'>Address</label>
                  <input name='address' value={form.address} onChange={handleChange} className={inputClass} />
                </div>
              </div>

              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 md:gap-x-4 gap-y-5 md:gap-y-6 py-1 md:py-2'>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>Lead Source</label>
                  <input name='leadSource' value={form.leadSource} onChange={handleChange} className={inputClass} placeholder='e.g. Website, Referral' />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>Status</label>
                  <select
                    name='status'
                    value={form.status}
                    onChange={handleChange}
                    className={`${inputClass} whitespace-nowrap overflow-hidden text-ellipsis`}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className='relative lg:col-span-2' ref={employeeRef}>
                  <label className='block text-sm font-medium text-gray-700'>Lead Generated By</label>
                  <input
                    type='text'
                    value={employeeSearch}
                    onChange={(e) => {
                      setEmployeeSearch(e.target.value)
                      setEmployeeOpen(true)
                      if (!e.target.value) setForm((f) => ({ ...f, generatedBy: '' }))
                    }}
                    onFocus={() => setEmployeeOpen(true)}
                    placeholder='Search employee...'
                    className={inputClass}
                    autoComplete='off'
                  />
                  {employeeOpen && (
                    <ul className='absolute z-10 top-full left-0 right-0 mt-1 max-h-48 overflow-auto bg-white border border-gray-300 rounded-xl shadow-lg py-1'>
                      {filteredEmployees.map((emp) => (
                        <li
                          key={emp._id}
                          onClick={() => handleEmployeeSelect(emp)}
                          className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${form.generatedBy === emp._id ? 'bg-blue-100' : ''}`}
                        >
                          {emp.name}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className='py-1 md:py-2'>
                <label className='block text-sm font-medium text-gray-700'>Description</label>
                <textarea name='description' value={form.description} onChange={handleChange} rows={3} className={inputClass} />
              </div>

              {form.status === 'Meeting Schedule' && (
                <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-3 md:gap-x-4 gap-y-5 md:gap-y-6 py-1 md:py-2'>
                  <div>
                    <label className='block text-sm font-medium text-gray-700'>Meeting Type</label>
                    <select name='meetingType' value={form.meetingType} onChange={handleChange} className={inputClass}>
                      <option value=''>Select</option>
                      <option value='Online'>Online</option>
                      <option value='Offline'>Offline</option>
                    </select>
                  </div>
                  <div className='relative lg:col-span-2' ref={meetingPersonRef}>
                    <label className='block text-sm font-medium text-gray-700'>Meeting Person Name</label>
                    <input
                      type='text'
                      value={meetingPersonSearch}
                      onChange={(e) => {
                        setMeetingPersonSearch(e.target.value)
                        setMeetingPersonOpen(true)
                        if (!e.target.value) setForm((f) => ({ ...f, meetingPersonName: '' }))
                      }}
                      onFocus={() => setMeetingPersonOpen(true)}
                      placeholder='Select meeting person (Sales Manager, Product Manager, etc.)'
                      className={inputClass}
                      autoComplete='off'
                    />
                    {meetingPersonOpen && (
                      <ul className='absolute z-10 top-full left-0 right-0 mt-1 max-h-48 overflow-auto bg-white border border-gray-300 rounded-xl shadow-lg py-1'>
                        {filteredMeetingPersonEmployees.length === 0 ? (
                          <li className='px-3 py-2 text-sm text-gray-500'>No employees with matching designation</li>
                        ) : (
                          filteredMeetingPersonEmployees.map((emp) => (
                            <li
                              key={emp._id}
                              onClick={() => handleMeetingPersonSelect(emp)}
                              className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${form.meetingPersonName === emp.name ? 'bg-blue-100' : ''}`}
                            >
                              {emp.name}
                              {emp.designation?.title && (
                                <span className='ml-2 text-gray-500 text-xs'>({emp.designation.title})</span>
                              )}
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                  <div>
                    <label className='block text-sm font-medium text-gray-700'>Meeting Time</label>
                    <input name='meetingTime' type='datetime-local' value={form.meetingTime} onChange={handleChange} className={inputClass} />
                  </div>
                  <div className='sm:col-span-2 lg:col-span-4'>
                    <label className='flex items-center gap-2 cursor-pointer mt-1'>
                      <input type='checkbox' name='meetingInfoSent' checked={form.meetingInfoSent} onChange={handleChange} className='rounded' />
                      <span className='text-sm text-gray-700'>Info sent to meeting person</span>
                    </label>
                  </div>
                </div>
              )}

              <div className='py-1 md:py-2'>
                <label className='block text-sm font-medium text-gray-700 mb-2'>Follow up</label>
                <div className='border border-gray-200 rounded-xl overflow-hidden'>
                  <div className='overflow-x-auto'>
                    <table className='w-full text-sm min-w-[480px]'>
                      <thead>
                        <tr className='bg-blue-600 text-white'>
                          <th className='text-left px-4 py-3 font-semibold whitespace-nowrap'>Follow-up date</th>
                          <th className='text-left px-4 py-3 font-semibold'>Comments (what was discussed)</th>
                        </tr>
                      </thead>
                      <tbody className='bg-white divide-y divide-gray-100'>
                        {form.followUps.length === 0 ? (
                          <tr>
                            <td
                              colSpan={2}
                              className='px-4 py-8 text-center text-gray-500'
                            >
                              {readOnly ? 'No follow-ups recorded.' : 'No follow-ups yet. Add one below.'}
                            </td>
                          </tr>
                        ) : (
                          form.followUps.map((fu, idx) => (
                            <tr key={fu._id || `fu-${idx}`} className='hover:bg-gray-50/80'>
                              <td className='px-4 py-3 text-gray-900 whitespace-nowrap align-top'>
                                {followUpDateToDisplay(fu.date)}
                              </td>
                              <td className='px-4 py-3 text-gray-800 align-top whitespace-pre-wrap break-words'>
                                {fu.comments ?? fu.text ?? '—'}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {!readOnly && (
                    <div className='p-4 bg-gray-50 border-t border-gray-200 space-y-3'>
                      <div className='grid grid-cols-1 sm:grid-cols-12 gap-3 items-end'>
                        <div className='sm:col-span-3'>
                          <label htmlFor='follow-up-date' className='block text-xs font-medium text-gray-600 mb-1'>
                            Follow-up date
                          </label>
                          <input
                            id='follow-up-date'
                            type='date'
                            value={followUpDate}
                            onChange={(e) => setFollowUpDate(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div className='sm:col-span-7'>
                          <label htmlFor='follow-up-comments' className='block text-xs font-medium text-gray-600 mb-1'>
                            Comments (what was discussed)
                          </label>
                          <textarea
                            id='follow-up-comments'
                            value={followUpComments}
                            onChange={(e) => setFollowUpComments(e.target.value)}
                            placeholder='Summarize what was discussed on this follow-up…'
                            rows={2}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {error && <p className='text-red-600 text-sm rounded-lg bg-red-50 py-2 px-3'>{error}</p>}
            </fieldset>
          </div>

          <div className='px-4 py-3 md:px-5 border-t border-gray-200 bg-gray-50/50 flex items-center gap-3'>
            {!readOnly && (
              <button type='submit' disabled={loading} className='bg-green-600 text-white px-5 py-2.5 rounded-xl hover:bg-green-700 text-sm font-medium shadow-sm transition-colors disabled:opacity-50'>
                {loading ? 'Saving...' : isEdit ? 'Update Lead' : 'Save Lead'}
              </button>
            )}
            <button type='button' onClick={() => navigate('/leads')} className='px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors'>
              {readOnly ? 'Back' : 'Cancel'}
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AddLead
