import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { EditIcon, DeleteIcon } from '../Icons'

const TYPE_META = {
  File: {
    title: 'Files',
    subtitle: 'Store and organize company documents and uploads.',
    api: '/files',
    addPath: '/add-file',
    editPath: (id) => `/files/edit/${id}`,
  },
  Contract: {
    title: 'Contracts',
    subtitle: 'Track client and vendor contracts with renewal dates.',
    api: '/contracts',
    addPath: '/add-contract',
    editPath: (id) => `/contracts/edit/${id}`,
  },
  Policy: {
    title: 'Policies',
    subtitle: 'Publish HR and company policies for employees.',
    api: '/policies',
    addPath: '/add-policy',
    editPath: (id) => `/policies/edit/${id}`,
  },
}

const STATUS_STYLES = {
  Draft: 'bg-gray-100 text-gray-700',
  Active: 'bg-emerald-100 text-emerald-700',
  Expired: 'bg-amber-100 text-amber-700',
  Archived: 'bg-slate-100 text-slate-700',
}

const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

const DocumentsView = ({ documentType = 'File' }) => {
  const navigate = useNavigate()
  const meta = TYPE_META[documentType] || TYPE_META.File
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchDocuments = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await api.get(meta.api)
      setDocuments(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error fetching documents')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDocuments()
  }, [documentType])

  const handleDelete = async (id) => {
    if (!window.confirm(`Delete this ${documentType.toLowerCase()}?`)) return
    try {
      await api.delete(`${meta.api}/${id}`)
      fetchDocuments()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error deleting document')
    }
  }

  return (
    <div className='p-4 md:p-5'>
      <div className='flex flex-wrap items-center justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>{meta.title}</h1>
          <p className='text-gray-600 text-sm mt-1'>{meta.subtitle}</p>
        </div>
        <button
          type='button'
          onClick={() => navigate(meta.addPath)}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700'
        >
          + Upload {documentType}
        </button>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
          <p className='text-red-600 text-sm'>{error}</p>
        </div>
      )}

      {loading ? (
        <p className='text-sm text-gray-600'>Loading...</p>
      ) : (
        <div className='bg-white rounded-xl shadow border border-gray-200 overflow-x-auto'>
          <table className='w-full table-auto text-sm'>
            <thead>
              <tr className='bg-blue-600 text-white'>
                <th className='px-4 py-3 text-left font-bold'>Title</th>
                <th className='px-4 py-3 text-left font-bold'>Status</th>
                <th className='px-4 py-3 text-left font-bold'>Effective</th>
                <th className='px-4 py-3 text-left font-bold'>Expiry</th>
                <th className='px-4 py-3 text-left font-bold'>Uploaded By</th>
                <th className='px-4 py-3 text-left font-bold'>File / URL</th>
                <th className='px-4 py-3 text-left font-bold'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.length === 0 ? (
                <tr>
                  <td colSpan={7} className='px-4 py-10 text-center text-gray-500'>
                    No {meta.title.toLowerCase()} yet. Add one to get started.
                  </td>
                </tr>
              ) : (
                documents.map((doc) => (
                  <tr key={doc._id} className='border-b hover:bg-gray-50'>
                    <td className='px-4 py-3'>
                      <p className='font-medium text-gray-900'>{doc.title}</p>
                      {doc.description && (
                        <p className='text-xs text-gray-500 mt-0.5 line-clamp-1'>{doc.description}</p>
                      )}
                    </td>
                    <td className='px-4 py-3'>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[doc.status] || STATUS_STYLES.Active}`}>
                        {doc.status || 'Active'}
                      </span>
                    </td>
                    <td className='px-4 py-3'>{formatDate(doc.effectiveDate)}</td>
                    <td className='px-4 py-3'>{formatDate(doc.expiryDate)}</td>
                    <td className='px-4 py-3'>{doc.uploadedBy?.name || '—'}</td>
                    <td className='px-4 py-3'>
                      {doc.documentUrl ? (
                        <a
                          href={doc.documentUrl}
                          target='_blank'
                          rel='noopener noreferrer'
                          className='text-blue-600 hover:underline text-sm'
                        >
                          {doc.fileName || 'Open'}
                        </a>
                      ) : (
                        <span className='text-gray-400'>—</span>
                      )}
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => navigate(meta.editPath(doc._id))}
                          className='p-1.5 rounded-lg text-blue-600 hover:bg-blue-50'
                          title='Edit'
                        >
                          <EditIcon />
                        </button>
                        <button
                          type='button'
                          onClick={() => handleDelete(doc._id)}
                          className='p-1.5 rounded-lg text-red-600 hover:bg-red-50'
                          title='Delete'
                        >
                          <DeleteIcon />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default DocumentsView
