import React, { useEffect, useMemo, useState } from 'react'
import api from '../../api/axios'
import { EditIcon, DeleteIcon } from '../Icons'
import { useNavigate } from 'react-router-dom'

const normalizeProfiles = (payload) => {
  if (Array.isArray(payload)) return payload
  if (payload?.data && Array.isArray(payload.data)) return payload.data
  if (payload?.clientProfiles && Array.isArray(payload.clientProfiles)) return payload.clientProfiles
  if (payload?.clientProfile) return [payload.clientProfile]
  return []
}

const ClientProfilesView = () => {
  const navigate = useNavigate()
  const [profiles, setProfiles] = useState([])
  const [searchText, setSearchText] = useState('')
  const [filterClientId, setFilterClientId] = useState('')
  const [filterProjectId, setFilterProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchAll = async () => {
    try {
      setLoading(true)
      setError(null)
      const profilesRes = await api.get('/client-profiles')
      setProfiles(normalizeProfiles(profilesRes.data))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load client profiles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const clientOptions = useMemo(() => {
    const map = new Map()
    profiles.forEach((p) => {
      const id = p.client?._id || p.client
      const name = p.client?.clientName || '—'
      if (id && !map.has(String(id))) map.set(String(id), name)
    })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [profiles])

  const projectOptions = useMemo(() => {
    const map = new Map()
    profiles.forEach((p) => {
      const clientId = String(p.client?._id || p.client || '')
      if (filterClientId && clientId !== String(filterClientId)) return
      const id = p.project?._id || p.project
      const name = p.project?.projectName || '—'
      if (id && !map.has(String(id))) map.set(String(id), name)
    })
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }))
  }, [profiles, filterClientId])

  const filteredProfiles = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    return profiles.filter((p) => {
      const clientId = String(p.client?._id || p.client || '')
      const projectId = String(p.project?._id || p.project || '')
      if (filterClientId && clientId !== String(filterClientId)) return false
      if (filterProjectId && projectId !== String(filterProjectId)) return false
      if (!q) return true
      const clientName = (p.client?.clientName || '').toLowerCase()
      const projectName = (p.project?.projectName || '').toLowerCase()
      return clientName.includes(q) || projectName.includes(q)
    })
  }, [profiles, filterClientId, filterProjectId, searchText])

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this client profile?')) return
    try {
      await api.delete(`/client-profiles/${id}`)
      fetchAll()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete client profile')
    }
  }

  return (
    <div className='p-8'>
      <div className='mb-6'>
        <div className='flex items-center justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>Client Profiles</h1>
            <p className='text-gray-600 mt-1 text-sm'>Track task, billing, calendar and deadline metrics client-wise.</p>
          </div>
          <button
            onClick={() => navigate('/client-profiles/new')}
            className='bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700'
          >
            Create Profile
          </button>
        </div>
      </div>

      {!loading && !error && (
        <div className='bg-white rounded-lg border border-gray-100 shadow p-4 mb-4'>
          <div className='grid grid-cols-1 md:grid-cols-4 gap-3'>
            <input
              type='text'
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder='Search by client or project...'
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm'
            />
            <select
              value={filterClientId}
              onChange={(e) => {
                setFilterClientId(e.target.value)
                setFilterProjectId('')
              }}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm'
            >
              <option value=''>All Clients</option>
              {clientOptions.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <select
              value={filterProjectId}
              onChange={(e) => setFilterProjectId(e.target.value)}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm'
            >
              <option value=''>All Projects</option>
              {projectOptions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <button
              type='button'
              onClick={() => {
                setSearchText('')
                setFilterClientId('')
                setFilterProjectId('')
              }}
              className='border border-gray-300 rounded-lg px-3 py-2 text-sm hover:bg-gray-50'
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className='text-sm text-gray-600'>Loading...</p>
      ) : error ? (
        <p className='text-red-600 text-sm'>{error}</p>
      ) : (
        <div className='bg-white rounded-lg shadow overflow-x-auto border border-gray-100'>
          <table className='w-full table-auto text-sm'>
            <thead className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
              <tr className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Client</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Project</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Tasks (Created / Completed / Pending / Delayed)</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Invoices</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Paid</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Pending</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Project Deadline</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Social Calendars</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProfiles.length === 0 ? (
                <tr>
                  <td colSpan={9} className='px-4 py-10 text-center text-gray-500'>No client profiles found.</td>
                </tr>
              ) : (
                filteredProfiles.map((p) => (
                  <tr key={p._id} className='border-b hover:bg-gray-50'>
                    <td className='px-4 py-3 text-center font-medium'>{p.client?.clientName || '—'}</td>
                    <td className='px-4 py-3 text-center'>{p.project?.projectName || '—'}</td>
                    <td className='px-4 py-3 text-center'>{p.totalCreatedTasks || 0} / {p.totalCompletedTasks || 0} / {p.totalPendingTasks || 0} / {p.delayedTasks || 0}</td>
                    <td className='px-4 py-3 text-center'>{p.totalInvoicesGenerated || 0}</td>
                    <td className='px-4 py-3 text-center'>₹{Number(p.totalAmountPaid || 0).toLocaleString('en-IN')}</td>
                    <td className='px-4 py-3 text-center'>₹{Number(p.totalAmountPending || 0).toLocaleString('en-IN')}</td>
                    <td className='px-4 py-3 text-center'>{p.projectDeadline ? new Date(p.projectDeadline).toLocaleDateString() : '—'}</td>
                    <td className='px-4 py-3 text-center'>{Array.isArray(p.socialMediaCalendars) ? p.socialMediaCalendars.length : 0}</td>
                    <td className='px-4 py-3 text-center'>
                      <div className='flex items-center justify-center gap-2'>
                        <button
                          onClick={() => navigate(`/client-profiles/edit/${p._id}`)}
                          className='p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors'
                          title='Edit'
                        >
                          <EditIcon />
                        </button>
                        <button
                          onClick={() => handleDelete(p._id)}
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

export default ClientProfilesView

