import React, { useEffect, useState, useRef } from 'react'
import api from '../api/axios'
import { uploadFile } from '../utils/uploadFile'
import { useNavigate, useParams } from 'react-router-dom'

const AddCompany = () => {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form, setForm] = useState({
    companyLogo: '',
    companyName: '',
    workingHours: '9 AM - 6 PM',
    breakTimeMinutes: 45,
    address: '',
    website: '',
    pan: '',
    phone: '',
    gstin: '',
    gstCode: '',
    state: '',
    email: '',
    bankName: '',
    bankAccountNumber: '',
    personalAccounts: [{ receiverName: '', bankName: '', bankAccountNumber: '' }],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!id) return
    const fetchCompany = async () => {
      try {
        const res = await api.get(`/companies/${id}`)
        const c = res.data
        setForm({
          companyLogo: c.companyLogo ?? '',
          companyName: c.companyName ?? '',
          workingHours: c.workingHours ?? '9 AM - 6 PM',
          breakTimeMinutes: Number(c.breakTimeMinutes ?? c.breakTime) || 45,
          address: c.address ?? '',
          website: c.website ?? '',
          pan: c.pan ?? '',
          phone: c.phone ?? '',
          gstin: c.gstin ?? '',
          gstCode: c.gstCode ?? '',
          state: c.state ?? '',
          email: c.email ?? '',
          bankName: c.bankName ?? '',
          bankAccountNumber: c.bankAccountNumber ?? '',
          personalAccounts: Array.isArray(c.personalAccounts) && c.personalAccounts.length > 0
            ? c.personalAccounts.map((a) => ({
                receiverName: a.receiverName ?? '',
                bankName: a.bankName ?? '',
                bankAccountNumber: a.bankAccountNumber ?? '',
              }))
            : (c.personalReceiverName || c.personalBankName || c.personalBankAccountNumber
                ? [{ receiverName: c.personalReceiverName ?? '', bankName: c.personalBankName ?? '', bankAccountNumber: c.personalBankAccountNumber ?? '' }]
                : [{ receiverName: '', bankName: '', bankAccountNumber: '' }]),
        })
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Error loading company')
      }
    }
    fetchCompany()
  }, [id])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value }))
  }

  const handleNumberChange = (e) => {
    const { name, value } = e.target
    setForm((f) => ({ ...f, [name]: value === '' ? '' : Number(value) }))
  }

  const addPersonalAccount = () => {
    setForm((f) => ({
      ...f,
      personalAccounts: [...f.personalAccounts, { receiverName: '', bankName: '', bankAccountNumber: '' }],
    }))
  }

  const removePersonalAccount = (index) => {
    setForm((f) => ({
      ...f,
      personalAccounts: f.personalAccounts.filter((_, i) => i !== index),
    }))
  }

  const handlePersonalAccountChange = (index, field, value) => {
    setForm((f) => ({
      ...f,
      personalAccounts: f.personalAccounts.map((acc, i) =>
        i === index ? { ...acc, [field]: value } : acc
      ),
    }))
  }

  const handleLogoFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setError(null)
      const uploaded = await uploadFile(file, { folder: 'logos' })
      setForm((f) => ({ ...f, companyLogo: uploaded.url }))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to upload logo')
      e.target.value = ''
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...form,
        breakTimeMinutes: Number(form.breakTimeMinutes) || 45,
        personalAccounts: form.personalAccounts.filter((a) => a.receiverName || a.bankName || a.bankAccountNumber),
      }
      if (payload.personalAccounts.length === 0) payload.personalAccounts = []
      if (isEdit) {
        await api.put(`/companies/${id}`, payload)
      } else {
        await api.post('/companies', payload)
      }
      navigate('/companies')
    } catch (err) {
      setError(err.response?.data?.message || err.message || (isEdit ? 'Error updating company' : 'Error creating company'))
    } finally {
      setLoading(false)
    }
  }

  const inputClass = 'mt-1 block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white'

  return (
    <div className='p-4 md:p-5 w-full flex flex-col'>
      <h1 className='text-2xl font-bold text-gray-900 mb-4 text-center w-full'>{isEdit ? 'Edit Company' : 'Add Company'}</h1>

      <form onSubmit={handleSubmit} className='w-full'>
        <div className='bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden'>
          <div className='px-4 py-3 md:px-5 border-b border-gray-100 bg-gray-50/80'>
            <h2 className='text-lg font-semibold text-gray-800'>Company details</h2>
            <p className='text-sm text-gray-500 mt-0.5'>Logo, name, address, GST and contact</p>
          </div>

          <div className='p-4 space-y-4 md:p-5'>
            <div className='flex flex-col sm:flex-row gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Company Logo</label>
                <input type='file' ref={fileInputRef} accept='image/*' onChange={handleLogoFile} className='hidden' />
                <button type='button' onClick={() => fileInputRef.current?.click()} className='mt-1 border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50'>
                  Choose image
                </button>
                {form.companyLogo && (
                  <img src={form.companyLogo} alt='Logo' className='mt-2 h-16 w-16 object-contain border rounded' />
                )}
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Company Name</label>
                <input name='companyName' value={form.companyName} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Email</label>
                <input name='email' type='email' value={form.email} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Phone</label>
                <input name='phone' value={form.phone} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Website</label>
                <input name='website' type='url' value={form.website} onChange={handleChange} className={inputClass} placeholder='https://...' />
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div className='lg:col-span-2'>
                <label className='block text-sm font-medium text-gray-700'>Address</label>
                <input name='address' value={form.address} onChange={handleChange} className={inputClass} />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Working Hours</label>
                <input name='workingHours' value={form.workingHours} onChange={handleChange} className={inputClass} placeholder='e.g. 9 AM - 6 PM' />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>Break Time (minutes)</label>
                <input
                  name='breakTimeMinutes'
                  type='number'
                  min='0'
                  step='1'
                  value={form.breakTimeMinutes}
                  onChange={handleNumberChange}
                  className={inputClass}
                  placeholder='e.g. 45'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>PAN</label>
                <input name='pan' value={form.pan} onChange={handleChange} className={inputClass} placeholder='e.g. AABCT1234D' />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>State</label>
                <input name='state' value={form.state} onChange={handleChange} className={inputClass} />
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700'>GSTIN</label>
                <input name='gstin' value={form.gstin} onChange={handleChange} className={inputClass} placeholder='e.g. 27XXXXX1234X1ZX' />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700'>GST Code</label>
                <input name='gstCode' value={form.gstCode} onChange={handleChange} className={inputClass} placeholder='e.g. 27' />
              </div>
            </div>

            <div className='border-t border-gray-200 pt-4 mt-4'>
              <h3 className='text-sm font-semibold text-gray-800 mb-3'>Company account (for GST bills)</h3>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4'>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>Bank Name</label>
                  <input name='bankName' value={form.bankName} onChange={handleChange} className={inputClass} />
                </div>
                <div>
                  <label className='block text-sm font-medium text-gray-700'>Bank Account Number</label>
                  <input name='bankAccountNumber' value={form.bankAccountNumber} onChange={handleChange} className={inputClass} />
                </div>
              </div>
            </div>
            <div className='border-t border-gray-200 pt-4 mt-4'>
              <div className='flex items-center justify-between mb-3'>
                <h3 className='text-sm font-semibold text-gray-800'>Personal accounts (for Non-GST bills)</h3>
                <button type='button' onClick={addPersonalAccount} className='text-sm text-blue-600 hover:text-blue-700 font-medium'>
                  + Add account
                </button>
              </div>
              <div className='space-y-4'>
                {form.personalAccounts.map((acc, index) => (
                  <div key={index} className='p-3 bg-gray-50 rounded-lg border border-gray-200'>
                    <div className='flex items-center justify-between mb-2'>
                      <span className='text-xs font-medium text-gray-500'>Account {index + 1}</span>
                      {form.personalAccounts.length > 1 && (
                        <button type='button' onClick={() => removePersonalAccount(index)} className='text-xs text-red-600 hover:underline'>
                          Remove
                        </button>
                      )}
                    </div>
                    <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3'>
                      <div>
                        <label className='block text-xs font-medium text-gray-600'>Receiver / Account holder name</label>
                        <input value={acc.receiverName} onChange={(e) => handlePersonalAccountChange(index, 'receiverName', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className='block text-xs font-medium text-gray-600'>Bank Name</label>
                        <input value={acc.bankName} onChange={(e) => handlePersonalAccountChange(index, 'bankName', e.target.value)} className={inputClass} />
                      </div>
                      <div>
                        <label className='block text-xs font-medium text-gray-600'>Bank Account Number</label>
                        <input value={acc.bankAccountNumber} onChange={(e) => handlePersonalAccountChange(index, 'bankAccountNumber', e.target.value)} className={inputClass} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className='px-4 py-3 md:px-5 border-t border-gray-100 flex gap-3'>
            {error && <p className='text-red-600 text-sm flex-1'>{error}</p>}
            <button type='submit' disabled={loading} className='bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50'>
              {loading ? 'Saving...' : isEdit ? 'Update' : 'Save'}
            </button>
            <button type='button' onClick={() => navigate('/companies')} className='px-5 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50'>
              Cancel
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}

export default AddCompany
