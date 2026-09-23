import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { EditIcon, DeleteIcon } from '../Icons'

const STATUS_STYLES = {
  Draft: 'bg-gray-100 text-gray-700',
  Sent: 'bg-blue-100 text-blue-700',
  Accepted: 'bg-emerald-100 text-emerald-700',
  Rejected: 'bg-red-100 text-red-700',
  Expired: 'bg-amber-100 text-amber-700',
  Revised: 'bg-violet-100 text-violet-700',
}

const formatInr = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`

const formatDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-IN')
}

const QuotationsView = () => {
  const navigate = useNavigate()
  const [quotations, setQuotations] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterClientId, setFilterClientId] = useState('')

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const res = await api.get('/clients')
        const list = Array.isArray(res.data) ? res.data : res.data?.data || []
        setClients(list)
      } catch (err) {
        console.error('Failed to fetch clients', err)
      }
    }
    fetchClients()
  }, [])

  const fetchQuotations = async () => {
    try {
      setLoading(true)
      setError(null)
      const params = {}
      if (filterStatus) params.status = filterStatus
      if (filterClientId) params.client = filterClientId
      const res = await api.get('/quotations', { params })
      setQuotations(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error fetching quotations')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotations()
  }, [filterStatus, filterClientId])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this quotation?')) return
    try {
      await api.delete(`/quotations/${id}`)
      fetchQuotations()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error deleting quotation')
    }
  }

  return (
    <div className='p-4 md:p-5'>
      <div className='flex flex-wrap items-center justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Quotations</h1>
          <p className='text-gray-600 text-sm mt-1'>Create and manage client quotations.</p>
        </div>
        <div className='flex flex-wrap items-center gap-3'>
          <select
            value={filterClientId}
            onChange={(e) => setFilterClientId(e.target.value)}
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[180px]'
          >
            <option value=''>All clients</option>
            {clients.map((c) => (
              <option key={c._id} value={c._id}>{c.clientName}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value=''>All statuses</option>
            {['Draft', 'Sent', 'Accepted', 'Rejected', 'Expired', 'Revised'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            type='button'
            onClick={() => navigate('/add-quotation')}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700'
          >
            + New Quotation
          </button>
        </div>
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
                <th className='px-4 py-3 text-left font-bold'>Quotation #</th>
                <th className='px-4 py-3 text-left font-bold'>Subject</th>
                <th className='px-4 py-3 text-left font-bold'>Client</th>
                <th className='px-4 py-3 text-left font-bold'>Prepared By</th>
                <th className='px-4 py-3 text-left font-bold'>Date</th>
                <th className='px-4 py-3 text-left font-bold'>Valid Until</th>
                <th className='px-4 py-3 text-left font-bold'>Status</th>
                <th className='px-4 py-3 text-right font-bold'>Grand Total</th>
                <th className='px-4 py-3 text-left font-bold'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotations.length === 0 ? (
                <tr>
                  <td colSpan={9} className='px-4 py-10 text-center text-gray-500'>
                    No quotations yet. Create one to get started.
                  </td>
                </tr>
              ) : (
                quotations.map((q) => (
                  <tr key={q._id} className='border-b hover:bg-gray-50'>
                    <td className='px-4 py-3 font-medium text-gray-900'>{q.quotationNumber || '—'}</td>
                    <td className='px-4 py-3'>{q.subject || '—'}</td>
                    <td className='px-4 py-3'>{q.client?.clientName || '—'}</td>
                    <td className='px-4 py-3'>{q.preparedBy?.name || '—'}</td>
                    <td className='px-4 py-3'>{formatDate(q.quotationDate)}</td>
                    <td className='px-4 py-3'>{formatDate(q.validUntil)}</td>
                    <td className='px-4 py-3'>
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_STYLES[q.status] || 'bg-gray-100 text-gray-700'}`}>
                        {q.status || 'Draft'}
                      </span>
                    </td>
                    <td className='px-4 py-3 text-right font-semibold'>{formatInr(q.grandTotal)}</td>
                    <td className='px-4 py-3'>
                      <div className='flex flex-wrap gap-2 items-center'>
                        <button
                          type='button'
                          onClick={() => navigate(`/quotations/${q._id}`)}
                          className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-green-600 text-green-700 text-sm font-medium hover:bg-green-50'
                          title='View quotation'
                        >
                          View
                        </button>
                        {q.quotationUrl && (
                          <a
                            href={q.quotationUrl}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-indigo-600 text-indigo-700 text-sm font-medium hover:bg-indigo-50'
                            title={q.quotationFileName || 'Open quotation file'}
                          >
                            File
                          </a>
                        )}
                        <button
                          type='button'
                          onClick={() => navigate(`/quotations/edit/${q._id}`)}
                          className='p-1.5 rounded-lg text-blue-600 hover:bg-blue-50'
                          title='Edit'
                        >
                          <EditIcon />
                        </button>
                        <button
                          type='button'
                          onClick={() => handleDelete(q._id)}
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

export default QuotationsView
