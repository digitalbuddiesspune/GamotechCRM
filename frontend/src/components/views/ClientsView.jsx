import React, { useEffect, useState, useMemo } from 'react'
import api from '../../api/axios'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { EditIcon, DeleteIcon, DashboardIcon } from '../Icons'

const ClientsView = () => {
  const [searchParams] = useSearchParams()
  const focusId = (searchParams.get('focus') || '').trim()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const [searchText, setSearchText] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterOnboardBy, setFilterOnboardBy] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [categoryTab, setCategoryTab] = useState('All')

  const fetchClients = async () => {
    try {
      setLoading(true)
      const res = await api.get('/clients')
      const payload = res.data
      let list = []
      if (Array.isArray(payload)) {
        list = payload
      } else if (payload && Array.isArray(payload.data)) {
        list = payload.data
      } else if (payload && payload.clients && Array.isArray(payload.clients)) {
        list = payload.clients
      } else {
        list = payload && typeof payload === 'object' ? [payload] : []
      }
      setClients(list)
    } catch (err) {
      setError(err.message || 'Error fetching clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClients()
  }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client?')) return
    try {
      await api.delete(`/clients/${id}`)
      fetchClients()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error deleting client')
    }
  }

  const onboardByOptions = useMemo(() => {
    const map = new Map()
    clients.forEach((c) => {
      if (c.onboardBy?._id && c.onboardBy?.name) {
        map.set(c.onboardBy._id, c.onboardBy.name)
      }
    })
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    )
  }, [clients])

  const filteredClients = useMemo(() => {
    return clients.filter((c) => {
      const isFocused = focusId && String(c._id) === focusId
      if (!isFocused) {
        if (searchText) {
          const q = searchText.toLowerCase()
          const match =
            (c.clientName || '').toLowerCase().includes(q) ||
            (c.mailId || '').toLowerCase().includes(q) ||
            (c.businessType || '').toLowerCase().includes(q) ||
            (c.clientNumber || '').toLowerCase().includes(q)
          if (!match) return false
        }

        if (dateFrom) {
          const from = new Date(dateFrom)
          from.setHours(0, 0, 0, 0)
          if (!c.date || new Date(c.date) < from) return false
        }
        if (dateTo) {
          const to = new Date(dateTo)
          to.setHours(23, 59, 59, 999)
          if (!c.date || new Date(c.date) > to) return false
        }

        if (filterOnboardBy && String(c.onboardBy?._id || '') !== String(filterOnboardBy)) return false

        if (filterStatus) {
          const clientStatus = c.status || 'Active'
          if (clientStatus !== filterStatus) return false
        }

        if (categoryTab !== 'All') {
          const category = c.clientCategory || 'Marketing'
          if (category !== categoryTab) return false
        }
      }

      return true
    })
  }, [clients, searchText, dateFrom, dateTo, filterOnboardBy, filterStatus, categoryTab, focusId])

  useEffect(() => {
    if (!focusId || loading) return
    const t = window.setTimeout(() => {
      document.getElementById(`client-focus-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    return () => window.clearTimeout(t)
  }, [focusId, loading, filteredClients.length])

  const hasActiveFilters = searchText || dateFrom || dateTo || filterOnboardBy || filterStatus

  const clearFilters = () => {
    setSearchText('')
    setDateFrom('')
    setDateTo('')
    setFilterOnboardBy('')
    setFilterStatus('')
  }

  return (
    <div className='p-8'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Clients</h1>
          <p className='text-gray-600 mt-1 text-sm'>Manage marketing clients and property clients separately.</p>
        </div>
        <div>
          <button
            onClick={() => navigate('/add-client')}
            className='bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 text-sm'
          >
            Add Client
          </button>
        </div>
      </div>

      <div className='flex flex-wrap gap-2 mb-4'>
        {['All', 'Property', 'Marketing'].map((tab) => (
          <button
            key={tab}
            type='button'
            onClick={() => setCategoryTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              categoryTab === tab
                ? 'bg-blue-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab === 'All' ? 'All Clients' : `${tab} Clients`}
          </button>
        ))}
      </div>

      <div className='bg-white rounded-lg shadow border border-gray-100 p-4 mb-4'>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end'>
          <div className='lg:col-span-2'>
            <label className='block text-xs font-medium text-gray-600 mb-1'>Search</label>
            <input
              type='text'
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder='Search by name, email, number, business...'
              className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>Date From</label>
            <input
              type='date'
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>Date To</label>
            <input
              type='date'
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            />
          </div>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>Onboard By</label>
            <select
              value={filterOnboardBy}
              onChange={(e) => setFilterOnboardBy(e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All</option>
              {onboardByOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className='block text-xs font-medium text-gray-600 mb-1'>Status</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className='w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'
            >
              <option value=''>All status</option>
              <option value='Active'>Active</option>
              <option value='Inactive'>Inactive</option>
            </select>
          </div>
        </div>
        {hasActiveFilters && (
          <div className='flex items-center justify-between mt-3 pt-3 border-t border-gray-100'>
            <p className='text-xs text-gray-500'>
              Showing {filteredClients.length} of {clients.length} clients
            </p>
            <button
              onClick={clearFilters}
              className='text-xs text-blue-600 hover:text-blue-800 font-medium'
            >
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className='text-sm'>Loading...</p>
      ) : error ? (
        <p className='text-red-600 text-sm'>{error}</p>
      ) : (
        <div className='bg-white rounded-lg shadow overflow-x-auto'>
          <table className='w-full table-auto text-sm'>
            <thead className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
              <tr className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Client Name</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Client Number</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Mail ID</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Business Type</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Services</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Date</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Category</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Type</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Status</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Onboard By</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={11} className='px-4 py-8 text-center text-gray-400'>
                    No clients found.
                  </td>
                </tr>
              ) : (
                filteredClients.map((c) => (
                  <tr
                    key={c._id}
                    id={`client-focus-${c._id}`}
                    className={`border-b hover:bg-gray-50 ${
                      focusId && String(c._id) === focusId ? 'bg-amber-50 ring-2 ring-inset ring-blue-500' : ''
                    }`}
                  >
                    <td className='px-4 py-3 font-medium'>{c.clientName}</td>
                    <td className='px-4 py-3'>{c.clientNumber}</td>
                    <td className='px-4 py-3'>{c.mailId}</td>
                    <td className='px-4 py-3'>{c.businessType}</td>
                    <td className='px-4 py-3'>{Array.isArray(c.services) ? c.services.join(', ') : '—'}</td>
                    <td className='px-4 py-3'>{c.date ? new Date(c.date).toLocaleDateString() : '—'}</td>
                    <td className='px-4 py-3'>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        (c.clientCategory || 'Marketing') === 'Marketing'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {c.clientCategory || 'Marketing'}
                      </span>
                    </td>
                    <td className='px-4 py-3'>{c.clientType || '—'}</td>
                    <td className='px-4 py-3'>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${(c.status || 'Active') === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {c.status || 'Active'}
                      </span>
                    </td>
                    <td className='px-4 py-3'>{c.onboardBy?.name || '—'}</td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-2'>
                        <button
                          onClick={() => navigate(`/clients/${c._id}/dashboard`)}
                          className='p-1.5 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors'
                          title='Client dashboard'
                        >
                          <DashboardIcon />
                        </button>
                        <button
                          onClick={() => navigate(`/clients/edit/${c._id}`)}
                          className='p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors'
                          title='Edit'
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={() => handleDelete(c._id)}
                          className='p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors'
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

export default ClientsView
