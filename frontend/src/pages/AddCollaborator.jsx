import React, { useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import { useNavigate, useParams } from 'react-router-dom'
import SearchableSelect from '../components/SearchableSelect'

const RATE_TYPES = ['', 'Per Hour', 'Per Day', 'Per Project', 'Fixed']
const INDIVIDUAL_TYPES = ['', 'Influencer', 'Model', 'Video Editor', 'Cinematographer', 'Content Writer']

const AddCollaborator = () => {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form, setForm] = useState({
    name: '',
    contactNo: '',
    email: '',
    city: '',
    state: '',
    pincode: '',
    rate: '',
    rateType: '',
    description: '',
    socialMediaLink: '',
    portfolioLink: '',
    individualType: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [states, setStates] = useState([])
  const [cities, setCities] = useState([])
  const navigate = useNavigate()

  const PINCODE_REGEX = /^[1-9][0-9]{5}$/

  const fetchCities = async (code) => {
    if (!code) {
      setCities([])
      return
    }
    try {
      const res = await api.get('/locations/cities', { params: { stateCode: code } })
      setCities(Array.isArray(res.data) ? res.data : [])
    } catch {
      setCities([])
    }
  }

  useEffect(() => {
    const fetchStates = async () => {
      try {
        const res = await api.get('/locations/states')
        const list = Array.isArray(res.data) ? res.data : []
        setStates(list)
      } catch {
        setStates([])
      }
    }
    fetchStates()
  }, [])

  useEffect(() => {
    if (!id) return
    const fetchCollaborator = async () => {
      try {
        const res = await api.get(`/collaborators/${id}`)
        const c = res.data
        setForm({
          name: c.name ?? '',
          contactNo: c.contactNo ?? '',
          email: c.email ?? '',
          city: c.city ?? '',
          state: c.state ?? '',
          pincode: c.pincode ?? '',
          rate: c.rate != null && c.rate !== '' ? String(c.rate) : '',
          rateType: c.rateType ?? '',
          description: c.description ?? '',
          socialMediaLink: c.socialMediaLink ?? '',
          portfolioLink: c.portfolioLink ?? '',
          individualType: c.individualType ?? '',
        })
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Error loading collaborator')
      }
    }
    fetchCollaborator()
  }, [id])

  useEffect(() => {
    if (!form.state || states.length === 0) return
    const matched = states.find((s) => s.name === form.state)
    const code = matched?.iso2 || ''
    if (code) fetchCities(code)
  }, [form.state, states])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleStateChange = (stateName) => {
    const selected = states.find((s) => s.name === stateName)
    setForm((f) => ({ ...f, state: stateName, city: '' }))
    fetchCities(selected?.iso2 || '')
  }

  const stateOptions = useMemo(
    () => states.map((s) => ({ value: s.name, label: s.name })),
    [states],
  )

  const cityOptions = useMemo(
    () => cities.map((c) => ({ value: c.name, label: c.name })),
    [cities],
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name?.trim()) {
      setError('Name is required')
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
        rate: form.rate === '' ? null : (form.rate != null ? Number(form.rate) : null),
      }
      if (isEdit) {
        await api.put(`/collaborators/${id}`, payload)
      } else {
        await api.post('/collaborators', payload)
      }
      navigate('/collaborators')
    } catch (err) {
      setError(err.response?.data?.message || err.message || (isEdit ? 'Error updating collaborator' : 'Error creating collaborator'))
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

  return (
    <div className='p-4 md:p-5 w-full flex flex-col'>
      <h1 className='text-2xl font-bold text-gray-900 mb-4 text-center w-full'>{isEdit ? 'Edit Collaborator' : 'Add Collaborator'}</h1>

      <form onSubmit={handleSubmit} className='w-full'>
        <div className='bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden'>
          <div className='px-4 py-3 md:px-5 border-b border-blue-700 bg-blue-600'>
            <h2 className='text-lg font-semibold text-white'>Collaborator details</h2>
            <p className='text-sm text-white mt-0.5'>Basic information and contact</p>
          </div>

          <div className='p-4 space-y-4 md:p-5'>
            {/* Row 1: 4 fields */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Name</label>
                <input name='name' value={form.name} onChange={handleChange} required className={inputClass} placeholder='Full name' />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Contact No.</label>
                <input name='contactNo' value={form.contactNo} onChange={handleChange} className={inputClass} placeholder='Phone number' />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Email</label>
                <input name='email' type='email' value={form.email} onChange={handleChange} className={inputClass} placeholder='email@example.com' />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Individual Type</label>
                <select name='individualType' value={form.individualType} onChange={handleChange} className={inputClass}>
                  {INDIVIDUAL_TYPES.map((t) => (
                    <option key={t || 'none'} value={t}>{t || '— Select —'}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 2: 4 fields */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div>
                <SearchableSelect
                  id='collab-state'
                  label='State'
                  value={form.state}
                  onChange={handleStateChange}
                  options={stateOptions}
                  placeholder='Select state'
                  searchPlaceholder='Search states…'
                  emptyText='No states match'
                  inputClassName={inputClass}
                />
              </div>
              <div>
                <SearchableSelect
                  id='collab-city'
                  label='City'
                  value={form.city}
                  onChange={(cityName) => setForm((f) => ({ ...f, city: cityName }))}
                  options={cityOptions}
                  disabled={!form.state}
                  placeholder={form.state ? 'Select city' : 'Select state first'}
                  searchPlaceholder='Search cities…'
                  emptyText='No cities match'
                  inputClassName={inputClass}
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Pincode</label>
                <input name='pincode' value={form.pincode || ''} onChange={handleChange} className={inputClass} placeholder='6-digit pincode' maxLength={6} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Rate</label>
                <input name='rate' type='number' step='any' value={form.rate} onChange={handleChange} className={inputClass} placeholder='e.g. 5000' />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Rate Type</label>
                <select name='rateType' value={form.rateType} onChange={handleChange} className={inputClass}>
                  {RATE_TYPES.map((r) => (
                    <option key={r || 'none'} value={r}>{r || '— Select —'}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Description full width (colSpan 4) */}
            <div className='col-span-full'>
              <label className='block text-sm font-medium text-gray-700'>Description</label>
              <textarea name='description' value={form.description} onChange={handleChange} rows={3} className={inputClass} placeholder='Brief description or notes' />
            </div>

            {/* Row 4: 2 link fields, each spanning 2 cols on large screens */}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div className='sm:col-span-2'>
                <label className='block text-sm font-medium text-gray-700'>Social Media Link</label>
                <input name='socialMediaLink' type='url' value={form.socialMediaLink} onChange={handleChange} className={inputClass} placeholder='https://...' />
              </div>
              <div className='sm:col-span-2'>
                <label className='block text-sm font-medium text-gray-700'>Portfolio Link</label>
                <input name='portfolioLink' type='url' value={form.portfolioLink} onChange={handleChange} className={inputClass} placeholder='https://...' />
              </div>
            </div>

            {error && (
              <div className='rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
                <p className='text-red-600 text-sm'>{error}</p>
              </div>
            )}
          </div>

          {/* Actions: full-width footer */}
          <div className='px-4 py-3 md:px-5 border-t border-gray-200 bg-gray-50/50 flex flex-wrap items-center gap-3'>
            <button type='submit' disabled={loading} className='bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 shadow-sm'>
              {loading ? 'Saving...' : isEdit ? 'Update Collaborator' : 'Save Collaborator'}
            </button>
            <button type='button' onClick={() => navigate('/collaborators')} className='px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100 text-gray-700'>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AddCollaborator
