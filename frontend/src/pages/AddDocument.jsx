import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../api/axios'
import { uploadFile } from '../utils/uploadFile'
import { useAuth } from '../context/AuthContext'

const TYPE_META = {
  File: {
    label: 'File',
    api: '/files',
    listPath: '/files',
  },
  Contract: {
    label: 'Contract',
    api: '/contracts',
    listPath: '/contracts',
  },
  Policy: {
    label: 'Policy',
    api: '/policies',
    listPath: '/policies',
  },
}

const STATUSES = ['Draft', 'Active', 'Expired', 'Archived']

const toYmd = (value) => {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

const AddDocument = ({ documentType = 'File' }) => {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const { user } = useAuth()
  const fileInputRef = useRef(null)
  const meta = TYPE_META[documentType] || TYPE_META.File

  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(false)
  const [uploadingFile, setUploadingFile] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    title: '',
    description: '',
    documentUrl: '',
    fileName: '',
    status: 'Active',
    effectiveDate: new Date().toISOString().slice(0, 10),
    expiryDate: '',
    uploadedBy: '',
    client: '',
    notes: '',
  })

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [clientsRes, employeesRes] = await Promise.all([
          api.get('/clients'),
          api.get('/employees'),
        ])
        setClients(Array.isArray(clientsRes.data) ? clientsRes.data : clientsRes.data?.data || [])
        setEmployees(Array.isArray(employeesRes.data) ? employeesRes.data : employeesRes.data?.data || [])
      } catch (err) {
        console.error('Failed to load document lookups', err)
      }
    }
    loadLookups()
  }, [])

  useEffect(() => {
    if (!isEdit && user?._id) {
      setForm((f) => ({ ...f, uploadedBy: f.uploadedBy || user._id }))
    }
  }, [isEdit, user?._id])

  useEffect(() => {
    if (!isEdit || !id) return
    const loadDocument = async () => {
      try {
        setLoading(true)
        const res = await api.get(`${meta.api}/${id}`)
        const doc = res.data
        if (doc.type && doc.type !== documentType) {
          setError(`This record is a ${doc.type}, not a ${documentType}`)
          return
        }
        setForm({
          title: doc.title || '',
          description: doc.description || '',
          documentUrl: doc.documentUrl || '',
          fileName: doc.fileName || '',
          status: doc.status || 'Active',
          effectiveDate: toYmd(doc.effectiveDate) || new Date().toISOString().slice(0, 10),
          expiryDate: toYmd(doc.expiryDate),
          uploadedBy: doc.uploadedBy?._id || doc.uploadedBy || '',
          client: doc.client?._id || doc.client || '',
          notes: doc.notes || '',
        })
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load document')
      } finally {
        setLoading(false)
      }
    }
    loadDocument()
  }, [id, isEdit, documentType, meta.api])

  const updateField = (name, value) => setForm((f) => ({ ...f, [name]: value }))

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFile(true)
    setError(null)
    try {
      const uploaded = await uploadFile(file, { folder: 'documents' })
      setForm((f) => ({
        ...f,
        documentUrl: uploaded.url || '',
        fileName: uploaded.fileName || file.name,
        title: f.title || (uploaded.fileName || file.name).replace(/\.[^.]+$/, ''),
      }))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to upload file')
      e.target.value = ''
    } finally {
      setUploadingFile(false)
    }
  }

  const clearFile = () => {
    setForm((f) => ({ ...f, documentUrl: '', fileName: '' }))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // type is NOT sent from UI as user-editable — backend route auto-sets it
      const payload = {
        title: form.title,
        description: form.description,
        documentUrl: form.documentUrl,
        fileName: form.fileName,
        status: form.status,
        effectiveDate: form.effectiveDate,
        expiryDate: form.expiryDate || null,
        uploadedBy: form.uploadedBy || null,
        client: form.client || null,
        notes: form.notes,
      }
      if (isEdit) {
        await api.put(`${meta.api}/${id}`, payload)
      } else {
        await api.post(meta.api, payload)
      }
      navigate(meta.listPath)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error saving document')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='p-4 md:p-5 max-w-3xl mx-auto'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-900'>
          {isEdit ? `Edit ${meta.label}` : `Add ${meta.label}`}
        </h1>
        <p className='text-sm text-gray-600 mt-1'>
          Type will be saved as <span className='font-semibold text-gray-800'>{documentType}</span> automatically.
        </p>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
          <p className='text-red-600 text-sm'>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className='bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4'>
        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>Title *</label>
          <input
            required
            value={form.title}
            onChange={(e) => updateField('title', e.target.value)}
            className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            placeholder={`${meta.label} title`}
          />
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>Description</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
          />
        </div>

        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
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
            <label className='block text-sm font-medium text-gray-700 mb-1'>Uploaded By</label>
            <select
              value={form.uploadedBy}
              onChange={(e) => updateField('uploadedBy', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            >
              <option value=''>Optional</option>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Effective Date</label>
            <input
              type='date'
              value={form.effectiveDate}
              onChange={(e) => updateField('effectiveDate', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Expiry Date</label>
            <input
              type='date'
              value={form.expiryDate}
              onChange={(e) => updateField('expiryDate', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>
        </div>

        {(documentType === 'Contract' || documentType === 'File') && (
          <div>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Client</label>
            <select
              value={form.client}
              onChange={(e) => updateField('client', e.target.value)}
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            >
              <option value=''>Optional</option>
              {clients.map((c) => (
                <option key={c._id} value={c._id}>{c.clientName}</option>
              ))}
            </select>
          </div>
        )}


        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>Upload document</label>
          <input
            ref={fileInputRef}
            type='file'
            accept='.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,image/*,application/pdf'
            className='hidden'
            onChange={handleFileUpload}
          />
          <button
            type='button'
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingFile}
            className='w-full rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/60 hover:bg-blue-50 px-4 py-8 text-center transition disabled:opacity-50'
          >
            <p className='text-sm font-semibold text-blue-700'>
              {uploadingFile ? 'Uploading to cloud…' : 'Click to upload file'}
            </p>
            <p className='text-xs text-blue-600/80 mt-1'>
              PDF, Word, Excel, images · Saved to cloud storage
            </p>
          </button>

          {(form.fileName || form.documentUrl) && (
            <div className='mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2'>
              <div className='min-w-0'>
                <p className='text-sm font-medium text-emerald-800 truncate'>
                  {form.fileName || 'Linked file'}
                </p>
                {form.documentUrl ? (
                  <a
                    href={form.documentUrl}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-xs text-emerald-700 hover:underline break-all'
                  >
                    Open file
                  </a>
                ) : null}
              </div>
              <div className='flex gap-2 shrink-0'>
                <button
                  type='button'
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className='px-3 py-1.5 rounded-lg border border-blue-600 text-blue-700 text-xs font-medium hover:bg-blue-50 disabled:opacity-50'
                >
                  Replace
                </button>
                <button
                  type='button'
                  onClick={clearFile}
                  className='px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 text-xs font-medium hover:bg-gray-50'
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          <div className='mt-3'>
            <label className='block text-xs font-medium text-gray-500 mb-1'>Or paste an external link</label>
            <input
              type='text'
              value={form.documentUrl}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  documentUrl: e.target.value,
                  fileName: e.target.value && !f.fileName ? '' : (e.target.value ? f.fileName : ''),
                }))
              }
              placeholder='https://drive.google.com/... or Dropbox link'
              className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
          </div>
        </div>

        <div>
          <label className='block text-sm font-medium text-gray-700 mb-1'>Notes</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={(e) => updateField('notes', e.target.value)}
            className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
          />
        </div>

        <div className='flex flex-wrap gap-3 justify-end pt-2'>
          <button
            type='button'
            onClick={() => navigate(meta.listPath)}
            className='px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50'
          >
            Cancel
          </button>
          <button
            type='submit'
            disabled={loading || uploadingFile}
            className='px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50'
          >
            {loading ? 'Saving…' : isEdit ? `Update ${meta.label}` : `Create ${meta.label}`}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddDocument
