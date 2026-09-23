import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/axios'
import { uploadFile } from '../utils/uploadFile'
import { useAuth } from '../context/AuthContext'

const emptyItem = () => ({
  name: '',
  description: '',
  quantity: 1,
  unit: 'Nos',
  unitPrice: 0,
  discount: 0,
  taxRate: 18,
})

const STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Revised']

const toYmd = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const AddQuotation = () => {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()

  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])
  const [leads, setLeads] = useState([])
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const [form, setForm] = useState({
    subject: '',
    client: '',
    lead: '',
    project: '',
    preparedBy: '',
    quotationDate: new Date().toISOString().slice(0, 10),
    validUntil: '',
    status: 'Draft',
    currency: 'INR',
    paymentTerms: '',
    scopeOfWork: '',
    termsAndConditions: '',
    notes: '',
    quotationUrl: '',
    quotationFileName: '',
    billingAddress: '',
    clientContact: { name: '', email: '', phone: '' },
    lineItems: [emptyItem()],
  })

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [clientsRes, employeesRes, leadsRes, projectsRes] = await Promise.all([
          api.get('/clients'),
          api.get('/employees'),
          api.get('/leads'),
          api.get('/projects'),
        ])
        setClients(Array.isArray(clientsRes.data) ? clientsRes.data : clientsRes.data?.data || [])
        setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : employeesRes.data?.data || [])
        setLeads(Array.isArray(leadsRes.data) ? leadsRes.data : leadsRes.data?.data || [])
        setProjects(Array.isArray(projectsRes.data) ? projectsRes.data : projectsRes.data?.data || [])
      } catch (err) {
        console.error('Failed to load quotation lookups', err)
      }
    }
    loadLookups()
  }, [])

  useEffect(() => {
    if (!isEdit && user?._id) {
      setForm((f) => ({ ...f, preparedBy: f.preparedBy || user._id }))
    }
  }, [isEdit, user?._id])

  useEffect(() => {
    if (!isEdit || !id) return
    const loadQuotation = async () => {
      try {
        setLoading(true)
        const res = await api.get(`/quotations/${id}`)
        const q = res.data
        setForm({
          subject: q.subject || '',
          client: q.client?._id || q.client || '',
          lead: q.lead?._id || q.lead || '',
          project: q.project?._id || q.project || '',
          preparedBy: q.preparedBy?._id || q.preparedBy || '',
          quotationDate: toYmd(q.quotationDate) || new Date().toISOString().slice(0, 10),
          validUntil: toYmd(q.validUntil),
          status: q.status || 'Draft',
          currency: q.currency || 'INR',
          paymentTerms: q.paymentTerms || '',
          scopeOfWork: q.scopeOfWork || '',
          termsAndConditions: q.termsAndConditions || '',
          notes: q.notes || '',
          quotationUrl: q.quotationUrl || '',
          quotationFileName: q.quotationFileName || '',
          billingAddress: q.billingAddress || '',
          clientContact: {
            name: q.clientContact?.name || '',
            email: q.clientContact?.email || '',
            phone: q.clientContact?.phone || '',
          },
          lineItems: Array.isArray(q.lineItems) && q.lineItems.length
            ? q.lineItems.map((item) => ({
                name: item.name || '',
                description: item.description || '',
                quantity: item.quantity ?? 1,
                unit: item.unit || 'Nos',
                unitPrice: item.unitPrice ?? 0,
                discount: item.discount ?? 0,
                taxRate: item.taxRate ?? 0,
              }))
            : [emptyItem()],
        })
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load quotation')
      } finally {
        setLoading(false)
      }
    }
    loadQuotation()
  }, [id, isEdit])

  useEffect(() => {
    if (!form.client || isEdit) return
    const client = clients.find((c) => String(c._id) === String(form.client))
    if (!client) return
    setForm((f) => ({
      ...f,
      billingAddress: f.billingAddress || client.address || '',
      clientContact: {
        name: f.clientContact.name || client.clientName || '',
        email: f.clientContact.email || client.mailId || '',
        phone: f.clientContact.phone || client.clientNumber || '',
      },
    }))
  }, [form.client, clients, isEdit])

  const clientProjects = useMemo(
    () => projects.filter((p) => String(p.client?._id || p.client || '') === String(form.client || '')),
    [projects, form.client]
  )

  const lineTotals = useMemo(() => {
    return form.lineItems.map((item) => {
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unitPrice) || 0
      const discount = Number(item.discount) || 0
      const taxRate = Number(item.taxRate) || 0
      const base = Math.max(0, quantity * unitPrice - discount)
      const tax = base * (taxRate / 100)
      return Math.max(0, base + tax)
    })
  }, [form.lineItems])

  const totals = useMemo(() => {
    const subtotal = form.lineItems.reduce(
      (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
      0
    )
    const discountTotal = form.lineItems.reduce((sum, item) => sum + (Number(item.discount) || 0), 0)
    const taxTotal = form.lineItems.reduce((sum, item, idx) => {
      const quantity = Number(item.quantity) || 0
      const unitPrice = Number(item.unitPrice) || 0
      const discount = Number(item.discount) || 0
      const taxRate = Number(item.taxRate) || 0
      const base = Math.max(0, quantity * unitPrice - discount)
      return sum + base * (taxRate / 100)
    }, 0)
    const grandTotal = lineTotals.reduce((sum, amount) => sum + amount, 0)
    return { subtotal, discountTotal, taxTotal, grandTotal }
  }, [form.lineItems, lineTotals])

  const updateField = (name, value) => setForm((f) => ({ ...f, [name]: value }))

  const updateContact = (name, value) =>
    setForm((f) => ({ ...f, clientContact: { ...f.clientContact, [name]: value } }))

  const updateItem = (index, name, value) => {
    setForm((f) => {
      const lineItems = [...f.lineItems]
      lineItems[index] = { ...lineItems[index], [name]: value }
      return { ...f, lineItems }
    })
  }

  const addItem = () => setForm((f) => ({ ...f, lineItems: [...f.lineItems, emptyItem()] }))

  const removeItem = (index) => {
    setForm((f) => ({
      ...f,
      lineItems: f.lineItems.length <= 1 ? f.lineItems : f.lineItems.filter((_, i) => i !== index),
    }))
  }

  const handleQuotationFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setError(null)
      const uploaded = await uploadFile(file, { folder: 'quotations' })
      setForm((f) => ({
        ...f,
        quotationUrl: uploaded.url,
        quotationFileName: uploaded.fileName || file.name,
      }))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to upload quotation file')
      e.target.value = ''
    }
  }

  const clearQuotationFile = () => {
    setForm((f) => ({ ...f, quotationUrl: '', quotationFileName: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...form,
        lead: form.lead || null,
        project: form.project || null,
        lineItems: form.lineItems.map((item) => ({
          ...item,
          quantity: Number(item.quantity) || 1,
          unitPrice: Number(item.unitPrice) || 0,
          discount: Number(item.discount) || 0,
          taxRate: Number(item.taxRate) || 0,
        })),
      }
      if (isEdit) {
        await api.put(`/quotations/${id}`, payload)
      } else {
        await api.post('/quotations', payload)
      }
      navigate('/quotations')
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error saving quotation')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='p-4 md:p-5 max-w-6xl mx-auto'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-900'>{isEdit ? 'Edit Quotation' : 'New Quotation'}</h1>
        <p className='text-sm text-gray-600 mt-1'>Fill quotation details, line items, and totals.</p>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
          <p className='text-red-600 text-sm'>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className='space-y-6'>
        <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5 grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div className='md:col-span-2'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Subject *</label>
            <input
              required
              value={form.subject}
              onChange={(e) => updateField('subject', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
              placeholder='Website redesign quotation'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Client *</label>
            <select
              required
              value={form.client}
              onChange={(e) => updateField('client', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            >
              <option value=''>Select client</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>{c.clientName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Prepared By *</label>
            <select
              required
              value={form.preparedBy}
              onChange={(e) => updateField('preparedBy', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            >
              <option value=''>Select employee</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Lead</label>
            <select
              value={form.lead}
              onChange={(e) => updateField('lead', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            >
              <option value=''>Optional</option>
              {leads.map((lead) => (
                <option key={lead._id} value={lead._id}>
                  {lead.businessName || lead.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Project</label>
            <select
              value={form.project}
              onChange={(e) => updateField('project', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            >
              <option value=''>Optional</option>
              {(form.client ? clientProjects : projects).map((p) => (
                <option key={p._id} value={p._id}>{p.projectName}</option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Quotation Date *</label>
            <input
              required
              type='date'
              value={form.quotationDate}
              onChange={(e) => updateField('quotationDate', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Valid Until *</label>
            <input
              required
              type='date'
              value={form.validUntil}
              onChange={(e) => updateField('validUntil', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Status</label>
            <select
              value={form.status}
              onChange={(e) => updateField('status', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Currency</label>
            <input
              value={form.currency}
              onChange={(e) => updateField('currency', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>
        </div>

        <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5 grid grid-cols-1 md:grid-cols-3 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Contact Name</label>
            <input
              value={form.clientContact.name}
              onChange={(e) => updateContact('name', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Contact Email</label>
            <input
              type='email'
              value={form.clientContact.email}
              onChange={(e) => updateContact('email', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Contact Phone</label>
            <input
              value={form.clientContact.phone}
              onChange={(e) => updateContact('phone', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>
          <div className='md:col-span-3'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Billing Address</label>
            <textarea
              rows={2}
              value={form.billingAddress}
              onChange={(e) => updateField('billingAddress', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>
        </div>

        <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5'>
          <div className='flex items-center justify-between mb-4'>
            <h2 className='font-semibold text-gray-900'>Line Items</h2>
            <button
              type='button'
              onClick={addItem}
              className='text-sm font-medium text-blue-600 hover:text-blue-700'
            >
              + Add Item
            </button>
          </div>

          <div className='space-y-4'>
            {form.lineItems.map((item, index) => (
              <div key={index} className='border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-6 gap-3'>
                <div className='md:col-span-2'>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>Name</label>
                  <input
                    value={item.name}
                    onChange={(e) => updateItem(index, 'name', e.target.value)}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                    placeholder='Service / product'
                  />
                </div>
                <div className='md:col-span-4'>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>Description *</label>
                  <input
                    required
                    value={item.description}
                    onChange={(e) => updateItem(index, 'description', e.target.value)}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                    placeholder='Item details'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>Qty</label>
                  <input
                    type='number'
                    min='1'
                    value={item.quantity}
                    onChange={(e) => updateItem(index, 'quantity', e.target.value)}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>Unit</label>
                  <input
                    value={item.unit}
                    onChange={(e) => updateItem(index, 'unit', e.target.value)}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>Unit Price</label>
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    value={item.unitPrice}
                    onChange={(e) => updateItem(index, 'unitPrice', e.target.value)}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>Discount</label>
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    value={item.discount}
                    onChange={(e) => updateItem(index, 'discount', e.target.value)}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                  />
                </div>
                <div>
                  <label className='block text-xs font-medium text-gray-500 mb-1'>Tax %</label>
                  <input
                    type='number'
                    min='0'
                    step='0.01'
                    value={item.taxRate}
                    onChange={(e) => updateItem(index, 'taxRate', e.target.value)}
                    className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                  />
                </div>
                <div className='flex items-end justify-between gap-2 md:col-span-1'>
                  <div>
                    <p className='text-xs text-gray-500'>Amount</p>
                    <p className='text-sm font-semibold text-gray-900'>
                      ₹{Number(lineTotals[index] || 0).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <button
                    type='button'
                    onClick={() => removeItem(index)}
                    disabled={form.lineItems.length <= 1}
                    className='text-xs text-red-600 disabled:opacity-40'
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className='mt-5 grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-gray-100 pt-4'>
            <div className='rounded-lg bg-gray-50 p-3'>
              <p className='text-xs text-gray-500'>Subtotal</p>
              <p className='font-semibold'>₹{totals.subtotal.toLocaleString('en-IN')}</p>
            </div>
            <div className='rounded-lg bg-gray-50 p-3'>
              <p className='text-xs text-gray-500'>Discount</p>
              <p className='font-semibold'>₹{totals.discountTotal.toLocaleString('en-IN')}</p>
            </div>
            <div className='rounded-lg bg-gray-50 p-3'>
              <p className='text-xs text-gray-500'>Tax</p>
              <p className='font-semibold'>₹{totals.taxTotal.toLocaleString('en-IN')}</p>
            </div>
            <div className='rounded-lg bg-blue-50 p-3'>
              <p className='text-xs text-blue-700'>Grand Total</p>
              <p className='font-bold text-blue-800'>₹{totals.grandTotal.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>

        <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5 grid grid-cols-1 md:grid-cols-2 gap-4'>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Payment Terms</label>
            <textarea
              rows={3}
              value={form.paymentTerms}
              onChange={(e) => updateField('paymentTerms', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Scope of Work</label>
            <textarea
              rows={3}
              value={form.scopeOfWork}
              onChange={(e) => updateField('scopeOfWork', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Terms & Conditions</label>
            <textarea
              rows={3}
              value={form.termsAndConditions}
              onChange={(e) => updateField('termsAndConditions', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Notes</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => updateField('notes', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>

          <div className='md:col-span-2'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Quotation URL</label>
            <div className='flex flex-col sm:flex-row gap-2'>
              <input
                type='text'
                value={form.quotationUrl.startsWith('data:') ? '' : form.quotationUrl}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    quotationUrl: e.target.value,
                    quotationFileName: e.target.value ? '' : f.quotationFileName,
                  }))
                }
                placeholder='Paste Drive / Dropbox / file link'
                className='flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm'
              />
              <input
                ref={fileInputRef}
                type='file'
                accept='.pdf,.doc,.docx,image/*,application/pdf'
                className='hidden'
                onChange={handleQuotationFile}
              />
              <button
                type='button'
                onClick={() => fileInputRef.current?.click()}
                className='px-4 py-2 rounded-lg border border-blue-600 text-blue-700 text-sm font-medium hover:bg-blue-50 whitespace-nowrap'
              >
                Upload File
              </button>
              {(form.quotationUrl || form.quotationFileName) && (
                <button
                  type='button'
                  onClick={clearQuotationFile}
                  className='px-4 py-2 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 whitespace-nowrap'
                >
                  Clear
                </button>
              )}
            </div>
            {form.quotationFileName && (
              <p className='text-xs text-emerald-700 mt-2'>Uploaded: {form.quotationFileName}</p>
            )}
            {form.quotationUrl && !form.quotationUrl.startsWith('data:') && (
              <a
                href={form.quotationUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-block text-xs text-blue-600 hover:underline mt-2'
              >
                Open quotation link
              </a>
            )}
            {form.quotationUrl?.startsWith('data:') && (
              <a
                href={form.quotationUrl}
                target='_blank'
                rel='noopener noreferrer'
                className='inline-block text-xs text-blue-600 hover:underline mt-2'
              >
                Preview uploaded file
              </a>
            )}
            <p className='text-[11px] text-gray-400 mt-1'>
              Upload a PDF/image or paste an external quotation URL.
            </p>
          </div>
        </div>

        <div className='flex flex-wrap gap-3 justify-end'>
          <button
            type='button'
            onClick={() => navigate('/quotations')}
            className='px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={loading}
            className='px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50'
          >
            {loading ? 'Saving…' : isEdit ? 'Update Quotation' : 'Create Quotation'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddQuotation
