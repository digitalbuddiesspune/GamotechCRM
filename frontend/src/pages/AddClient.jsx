import React, { useEffect, useState, useRef } from 'react'
import api from '../api/axios'
import { useNavigate, useParams } from 'react-router-dom'

const SERVICES = ['Website Dev', 'SMM', 'Performance Marketing', 'App', 'Website Redesign']

const AddClient = () => {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form, setForm] = useState({
    clientName: '',
    clientNumber: '',
    mailId: '',
    businessType: '',
    services: [],
    date: '',
    clientType: 'Recurring',
    clientCategory: 'Marketing',
    projectEndDate: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    onboardBy: '',
    status: 'Active',
    mouLink: '',
    mouSentBy: '',
    mouSentTo: '',
    gstin: '',
    gstCode: '',
  })
  const [employees, setEmployees] = useState([])
  const [onboardSearch, setOnboardSearch] = useState('')
  const [onboardOpen, setOnboardOpen] = useState(false)
  const [customServices, setCustomServices] = useState([])
  const [newServiceInput, setNewServiceInput] = useState('')
  const [employeesLoading, setEmployeesLoading] = useState(true)
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const onboardRef = useRef(null)

  const navigate = useNavigate()
  const PINCODE_REGEX = /^[1-9][0-9]{5}$/

  const fetchCities = async (stateCode) => {
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
    const fetchEmployees = async () => {
      try {
        const res = await api.get('/employees')
        const payload = res.data
        let list = Array.isArray(payload) ? payload : payload?.data || payload?.employees || []
        setEmployees(Array.isArray(list) ? list : [])
      } catch (err) {
        console.error('Failed to fetch employees:', err)
      } finally {
        setEmployeesLoading(false)
      }
    }
    fetchEmployees()
  }, [])

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const res = await api.get('/locations/states')
        setStates(Array.isArray(res.data) ? res.data : [])
      } catch {
        setStates([])
      }
    }
    fetchStates()
  }, [])

  useEffect(() => {
    if (!id) return
    const fetchClient = async () => {
      try {
        const res = await api.get(`/clients/${id}`)
        const c = res.data
        const onboardId = c.onboardBy?._id ?? c.onboardBy
        const onboardName = c.onboardBy?.name ?? ''
        const loadedServices = Array.isArray(c.services) ? c.services : []
        const custom = loadedServices.filter((s) => s && !SERVICES.includes(s))
        setForm({
          clientName: c.clientName ?? '',
          clientNumber: c.clientNumber ?? '',
          mailId: c.mailId ?? '',
          businessType: c.businessType ?? '',
          services: loadedServices,
          date: c.date ? c.date.split('T')[0] : '',
          clientType: c.clientType ?? 'Recurring',
          clientCategory: c.clientCategory ?? 'Marketing',
          projectEndDate: c.projectEndDate ? c.projectEndDate.split('T')[0] : '',
          address: c.address ?? '',
          city: c.city ?? '',
          state: c.state ?? '',
          pincode: c.pincode ?? '',
          onboardBy: onboardId ?? '',
          status: c.status ?? 'Active',
          mouLink: c.mouLink ?? '',
          mouSentBy: c.mouSentBy ?? '',
          mouSentTo: c.mouSentTo ?? '',
          gstin: c.gstin ?? '',
          gstCode: c.gstCode ?? '',
        })
        setCustomServices(custom)
        setOnboardSearch(onboardName)
      } catch (err) {
        console.error('Failed to fetch client:', err)
        setError(err.response?.data?.message || err.message || 'Error loading client')
      }
    }
    fetchClient()
  }, [id])

  useEffect(() => {
    if (!form.state || states.length === 0) return
    const matched = states.find((s) => s.name === form.state)
    if (matched?.iso2) fetchCities(matched.iso2)
  }, [form.state, states])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (onboardRef.current && !onboardRef.current.contains(e.target)) {
        setOnboardOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredEmployees = employees.filter((e) =>
    (e.name || '').toLowerCase().includes(onboardSearch.toLowerCase())
  )

  const handleOnboardSelect = (e) => {
    setForm((f) => ({ ...f, onboardBy: e._id }))
    setOnboardSearch(e.name || '')
    setOnboardOpen(false)
  }

  const handleOnboardSearchChange = (val) => {
    setOnboardSearch(val)
    setOnboardOpen(true)
    if (!val) setForm((f) => ({ ...f, onboardBy: '' }))
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleServiceToggle = (service) => {
    setForm((f) => ({
      ...f,
      services: f.services.includes(service)
        ? f.services.filter((s) => s !== service)
        : [...f.services, service],
    }))
  }

  const allServices = [...SERVICES, ...customServices]

  const handleAddService = () => {
    const trimmed = newServiceInput.trim()
    if (!trimmed) return
    if (allServices.includes(trimmed)) {
      setNewServiceInput('')
      return
    }
    setCustomServices((prev) => [...prev, trimmed])
    setForm((f) => ({ ...f, services: [...f.services, trimmed] }))
    setNewServiceInput('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.onboardBy) {
      setError('Please select who onboarded this client')
      return
    }
    if (form.clientType === 'Non Recurring' && !form.projectEndDate) {
      setError('Please enter project end date for non-recurring clients')
      return
    }
    if (form.pincode && !PINCODE_REGEX.test(form.pincode)) {
      setError('Please enter a valid 6-digit pincode')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...form,
        projectEndDate: form.clientType === 'Non Recurring' ? form.projectEndDate : undefined,
      }
      if (isEdit) {
        await api.put(`/clients/${id}`, payload)
      } else {
        await api.post('/clients', payload)
      }
      navigate('/clients')
    } catch (err) {
      setError(err.response?.data?.message || err.message || (isEdit ? 'Error updating client' : 'Error creating client'))
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'mt-2 block w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

  return (
    <div className='p-4 md:p-5 w-full flex flex-col'>
      <h1 className='text-2xl font-bold text-gray-900 mb-4 md:mb-5 text-center w-full'>{isEdit ? 'Edit Client' : 'Add Client'}</h1>

      <form onSubmit={handleSubmit} className='w-full'>
        <div className='bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden'>
          <div className='px-4 py-3 md:px-5 md:py-4 border-b border-gray-100 bg-gray-50/80'>
            <h2 className='text-lg font-semibold text-gray-800'>Client details</h2>
            <p className='text-sm text-gray-500 mt-0.5'>Basic information and contact</p>
          </div>

          <div className='p-4 space-y-5 md:p-5'>
            {/* Row 1: 4 fields */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Client Name</label>
                <input name='clientName' value={form.clientName} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Client Number</label>
                <input name='clientNumber' value={form.clientNumber} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Mail ID</label>
                <input name='mailId' type='email' value={form.mailId} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Client Category</label>
                <select name='clientCategory' value={form.clientCategory} onChange={handleChange} required className={inputClass}>
                  <option value='Property'>Property Client</option>
                  <option value='Marketing'>Marketing Client</option>
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Business Type</label>
                <input name='businessType' value={form.businessType} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>GSTIN</label>
                <input name='gstin' value={form.gstin} onChange={handleChange} className={inputClass} placeholder='e.g. 27XXXXX1234X1ZX' />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>GST Code</label>
                <input name='gstCode' value={form.gstCode} onChange={handleChange} className={inputClass} placeholder='e.g. 27' />
              </div>
            </div>

            {/* Row 2: 4 fields */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Date</label>
                <input name='date' type='date' value={form.date} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Recurring / Non Recurring</label>
                <select name='clientType' value={form.clientType} onChange={handleChange} required className={inputClass}>
                  <option value='Recurring'>Recurring</option>
                  <option value='Non Recurring'>Non Recurring</option>
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Status</label>
                <select name='status' value={form.status} onChange={handleChange} className={inputClass}>
                  <option value='Active'>Active</option>
                  <option value='Inactive'>Inactive</option>
                </select>
              </div>
              <div className='relative' ref={onboardRef}>
                <label className='block text-sm font-medium text-gray-700'>Onboard By</label>
                <input
                  type='text'
                  value={onboardSearch}
                  onChange={(e) => handleOnboardSearchChange(e.target.value)}
                  onFocus={() => setOnboardOpen(true)}
                  placeholder='Search employee...'
                  className={inputClass}
                  autoComplete='off'
                />
                {onboardOpen && (
                  <ul className='absolute z-10 top-full left-0 right-0 mt-1 w-full max-h-48 overflow-auto bg-white border border-gray-300 rounded-lg shadow-lg py-1'>
                    {employeesLoading ? (
                      <li className='px-4 py-2 text-sm text-gray-500'>Loading...</li>
                    ) : filteredEmployees.length === 0 ? (
                      <li className='px-4 py-2 text-sm text-gray-500'>No employees found</li>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <li
                          key={emp._id}
                          onClick={() => handleOnboardSelect(emp)}
                          className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 ${form.onboardBy === emp._id ? 'bg-blue-100' : ''}`}
                        >
                          {emp.name}
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>
            </div>

            {/* Row 3: Project End Date (col-span-4 when Non Recurring) */}
            {form.clientType === 'Non Recurring' && (
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
                <div className='lg:col-span-2'>
                  <label className='block text-sm font-medium text-gray-700'>Project End Date</label>
                  <input name='projectEndDate' type='date' value={form.projectEndDate} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            )}

            {/* Row 4: Services (col-span-4) */}
            <div className='col-span-full'>
              <label className='block text-sm font-medium text-gray-700 mb-2'>Services</label>
              <div className='flex flex-wrap gap-3 mb-3'>
                {allServices.map((s) => (
                  <label key={s} className='flex items-center gap-2 text-sm cursor-pointer'>
                    <input
                      type='checkbox'
                      checked={form.services.includes(s)}
                      onChange={() => handleServiceToggle(s)}
                      className='rounded border-gray-300'
                    />
                    {s}
                  </label>
                ))}
              </div>
              <div className='flex flex-wrap gap-2 items-center'>
                <input
                  type='text'
                  value={newServiceInput}
                  onChange={(e) => setNewServiceInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddService(); } }}
                  placeholder='Add new service...'
                  className='flex-1 min-w-[180px] border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
                <button
                  type='button'
                  onClick={handleAddService}
                  className='px-4 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50 transition-colors whitespace-nowrap'
                >
                  Add & Select
                </button>
              </div>
            </div>

            {/* Row 5: Address (col-span-4) */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>State</label>
                <select
                  name='state'
                  value={form.state}
                  onChange={(e) => {
                    const selectedName = e.target.value
                    const selected = states.find((s) => s.name === selectedName)
                    setForm((f) => ({ ...f, state: selectedName, city: '' }))
                    fetchCities(selected?.iso2 || '')
                  }}
                  className={inputClass}
                >
                  <option value=''>Select state</option>
                  {states.map((s) => (
                    <option key={s.iso2 || s.name} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>City</label>
                <select
                  name='city'
                  value={form.city}
                  onChange={handleChange}
                  className={inputClass}
                  disabled={!form.state}
                >
                  <option value=''>{form.state ? 'Select city' : 'Select state first'}</option>
                  {cities.map((c) => (
                    <option key={c.name} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className='lg:col-span-2'>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Street Address</label>
                <input name='address' value={form.address} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Pincode</label>
                <input name='pincode' value={form.pincode} onChange={handleChange} className={inputClass} placeholder='6-digit pincode' maxLength={6} />
              </div>
            </div>

            {/* Row 6: MOU fields - 2 + 2 + 4 or 2 cols each */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700'>MOU Link</label>
                <input name='mouLink' value={form.mouLink} onChange={handleChange} placeholder='Drive link' className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>MOU Sent By (Mail ID)</label>
                <input name='mouSentBy' type='email' value={form.mouSentBy} onChange={handleChange} className={inputClass} />
              </div>
              <div className='sm:col-span-2'>
                <label className='block text-sm font-medium text-gray-700'>MOU Sent To (Mail ID)</label>
                <input name='mouSentTo' type='email' value={form.mouSentTo} onChange={handleChange} className={inputClass} />
              </div>
            </div>

            {error && (
              <div className='rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
                <p className='text-red-600 text-sm'>{error}</p>
              </div>
            )}
          </div>

          <div className='px-4 py-3 md:px-5 md:py-4 border-t border-gray-200 bg-gray-50/50 flex flex-wrap items-center gap-3'>
            <button type='submit' disabled={loading} className='bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 shadow-sm'>
              {loading ? 'Saving...' : isEdit ? 'Update Client' : 'Save Client'}
            </button>
            <button type='button' onClick={() => navigate('/clients')} className='px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 text-gray-700'>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AddClient
