import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import { useNavigate } from 'react-router-dom'
import { EditIcon, DeleteIcon } from '../Icons'

const BillingView = () => {
  const [billings, setBillings] = useState([])
  const [clients, setClients] = useState([])
  const [tracking, setTracking] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterType, setFilterType] = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const f = async () => {
      try {
        const res = await api.get('/clients')
        const list = Array.isArray(res.data) ? res.data : res.data?.data || []
        setClients(list)
      } catch (err) {
        console.error('Failed to fetch clients', err)
      }
    }
    f()
  }, [])

  const fetchBillings = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filterType) params.billType = filterType
      if (filterClientId) params.clientId = filterClientId
      const res = await api.get('/billing', { params })
      setBillings(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      setError(err.message || 'Error fetching billings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBillings()
  }, [filterType, filterClientId])

  useEffect(() => {
    if (!filterClientId) {
      setTracking([])
      return
    }
    const fetchTracking = async () => {
      try {
        const res = await api.get(`/billing/tracking/${filterClientId}`)
        setTracking(res.data?.tracking || [])
      } catch (err) {
        setTracking([])
      }
    }
    fetchTracking()
  }, [filterClientId, billings])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this billing record?')) return
    try {
      await api.delete(`/billing/${id}`)
      fetchBillings()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error deleting')
    }
  }

  /** Compute cumulative remaining after each bill (per client, chronological). billingId -> total remaining after that bill */
  const getCumulativeRemainingByBilling = () => {
    const byClient = {}
    billings.forEach((b) => {
      const cid = (b.client?._id || b.client)?.toString?.()
      if (!cid) return
      if (!byClient[cid]) byClient[cid] = []
      byClient[cid].push(b)
    })
    const billingRemainingAfter = {}
    Object.values(byClient).forEach((clientBillings) => {
      const sorted = [...clientBillings].sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0))
      const projectCostMap = {}
      sorted.forEach((b) => {
        (b.projects || []).forEach((p) => {
          const id = (p.project?._id || p.project)?.toString?.()
          if (id) projectCostMap[id] = Math.max(projectCostMap[id] || 0, Number(p.projectCost) || 0)
        })
      })
      const remaining = { ...projectCostMap }
      sorted.forEach((b) => {
        const paymentAmount = Number(b.paymentDetails?.amount) || 0
        const projects = b.projects || []
        let remainingToDistribute = paymentAmount
        let afterSum = 0
        projects.forEach((p) => {
          const id = (p.project?._id || p.project)?.toString?.()
          if (!id) return
          const paid = Math.min(remaining[id] || 0, Math.max(0, remainingToDistribute))
          remainingToDistribute -= paid
          remaining[id] = (remaining[id] || 0) - paid
          afterSum += remaining[id] || 0
        })
        billingRemainingAfter[b._id] = afterSum
      })
    })
    return billingRemainingAfter
  }

  const cumulativeRemainingMap = getCumulativeRemainingByBilling()

  return (
    <div className='p-4 md:p-5'>
      <div className='flex flex-wrap items-center justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Billing</h1>
          <p className='text-gray-600 text-sm mt-1'>Manage GST and Non-GST bills.</p>
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
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
          >
            <option value=''>All</option>
            <option value='GST'>GST</option>
            <option value='Non-GST'>Non-GST</option>
          </select>
          <button
            onClick={() => navigate('/add-billing')}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700'
          >
            Add Billing
          </button>
        </div>
      </div>

      {error && (
        <div className='mb-4 rounded-lg bg-red-50 border border-red-100 px-3 py-2'>
          <p className='text-red-600 text-sm'>{error}</p>
        </div>
      )}

      {filterClientId && tracking.length > 0 && (
        <div className='mb-6 rounded-xl border border-gray-200 bg-white overflow-hidden'>
          <div className='px-4 py-3 bg-gray-50 border-b border-gray-200'>
            <h2 className='text-sm font-semibold text-gray-800'>Payment tracking — Paid amount minus from project cost, Remaining displayed</h2>
          </div>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm'>
              <thead className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
                <tr className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
                  <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Project</th>
                  <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Project Cost</th>
                  <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Total Paid</th>
                  <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Remaining</th>
                </tr>
              </thead>
              <tbody>
                {tracking.map((t, i) => (
                  <tr key={i} className='border-b hover:bg-gray-50'>
                    <td className='px-4 py-3 font-medium'>{t.project?.projectName || '—'}</td>
                    <td className='px-4 py-3 text-right'>₹{Number(t.projectCost || 0).toLocaleString('en-IN')}</td>
                    <td className='px-4 py-3 text-right'>₹{Number(t.totalPaid || 0).toLocaleString('en-IN')}</td>
                    <td className='px-4 py-3 text-right font-semibold text-gray-900'>₹{Number(t.remaining ?? 0).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <p className='text-sm text-gray-600'>Loading...</p>
      ) : (
        <div className='bg-white rounded-xl shadow border border-gray-200 overflow-x-auto'>
          <table className='w-full table-auto text-sm'>
            <thead className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
              <tr className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Type</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Company</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Client</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Paid (this bill)</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Remaining</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {billings.length === 0 ? (
                <tr>
                  <td colSpan={6} className='px-4 py-10 text-center text-gray-500'>
                    No billing records. Add one to get started.
                  </td>
                </tr>
              ) : (
                billings.map((b) => {
                  const totalRemaining = cumulativeRemainingMap[b._id] ?? (b.projects || []).reduce((s, p) => s + (Number(p.remainingCost) || 0), 0)
                  return (
                  <tr key={b._id} className='border-b hover:bg-gray-50'>
                    <td className='px-4 py-3'>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${b.billType === 'GST' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {b.billType}
                      </span>
                    </td>
                    <td className='px-4 py-3'>{b.company?.name || '—'}</td>
                    <td className='px-4 py-3'>{b.client?.clientName || '—'}</td>
                    <td className='px-4 py-3'>{b.paymentDetails?.amount != null ? `₹${Number(b.paymentDetails.amount).toLocaleString('en-IN')}` : '—'}</td>
                    <td className='px-4 py-3 font-medium text-gray-900'>{totalRemaining != null ? `₹${Number(totalRemaining).toLocaleString('en-IN')}` : '—'}</td>
                    <td className='px-4 py-3 flex flex-wrap gap-2 items-center'>
                      <button
                        onClick={() => navigate(`/billings/${b._id}/invoice`)}
                        className='inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-green-600 text-green-700 text-sm font-medium hover:bg-green-50'
                        title='Generate Invoice'
                      >
                        <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' /></svg>
                        Generate Invoice
                      </button>
                      <button
                        onClick={() => navigate(`/billings/edit/${b._id}`)}
                        className='p-1.5 rounded-lg text-blue-600 hover:bg-blue-50'
                        title='Edit'
                      >
                        <EditIcon />
                      </button>
                      <button
                        onClick={() => handleDelete(b._id)}
                        className='p-1.5 rounded-lg text-red-600 hover:bg-red-50'
                        title='Delete'
                      >
                        <DeleteIcon />
                      </button>
                    </td>
                  </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default BillingView
