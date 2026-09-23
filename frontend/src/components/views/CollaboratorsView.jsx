import React, { useEffect, useState } from 'react'
import api from '../../api/axios'
import { useNavigate } from 'react-router-dom'
import { EditIcon, DeleteIcon } from '../Icons'

const RATE_TYPES = ['Per Hour', 'Per Day', 'Per Project', 'Fixed']
const INDIVIDUAL_TYPES = ['Influencer', 'Model', 'Video Editor', 'Cinematographer', 'Content Writer']

const CollaboratorsView = () => {
  const [collaborators, setCollaborators] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterRateType, setFilterRateType] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterIndividualType, setFilterIndividualType] = useState('')
  const navigate = useNavigate()

  const fetchCollaborators = async () => {
    try {
      setLoading(true)
      const params = {}
      if (filterRateType) params.rateType = filterRateType
      if (filterCity) params.city = filterCity
      if (filterIndividualType) params.individualType = filterIndividualType
      const res = await api.get('/collaborators', { params })
      const payload = res.data
      const list = Array.isArray(payload) ? payload : payload?.data || []
      setCollaborators(list)
    } catch (err) {
      setError(err.message || 'Error fetching collaborators')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCollaborators()
  }, [filterRateType, filterCity, filterIndividualType])

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this collaborator?')) return
    try {
      await api.delete(`/collaborators/${id}`)
      fetchCollaborators()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error deleting collaborator')
    }
  }

  return (
    <div className='p-8'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Collaborators</h1>
          <p className='text-gray-600 mt-1 text-sm'>Manage influencers, models, editors, and other collaborators.</p>
        </div>
        <button
          onClick={() => navigate('/add-collaborator')}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium'
        >
          Add Collaborator
        </button>
      </div>

      {/* Filters */}
      <div className='bg-white rounded-lg shadow border border-gray-100 p-4 mb-6 flex flex-wrap items-center gap-4'>
        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium text-gray-700'>Rate Type</label>
          <select
            value={filterRateType}
            onChange={(e) => setFilterRateType(e.target.value)}
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[140px]'
          >
            <option value=''>All</option>
            {RATE_TYPES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium text-gray-700'>City</label>
          <input
            type='text'
            value={filterCity}
            onChange={(e) => setFilterCity(e.target.value)}
            placeholder='Filter by city'
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]'
          />
        </div>
        <div className='flex items-center gap-2'>
          <label className='text-sm font-medium text-gray-700'>Individual Type</label>
          <select
            value={filterIndividualType}
            onChange={(e) => setFilterIndividualType(e.target.value)}
            className='border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[160px]'
          >
            <option value=''>All</option>
            {INDIVIDUAL_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p className='text-sm text-gray-600'>Loading...</p>
      ) : error ? (
        <p className='text-red-600 text-sm'>{error}</p>
      ) : (
        <div className='bg-white rounded-lg shadow overflow-x-auto border border-gray-100'>
          <table className='w-full table-auto text-sm'>
            <thead className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
              <tr className='text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Name</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Contact No.</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Email</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>City</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>State</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Rate</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Individual Type</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Links</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {collaborators.length === 0 ? (
                <tr>
                  <td colSpan={9} className='px-4 py-12 text-center text-gray-500'>
                    No collaborators found. Add one to get started.
                  </td>
                </tr>
              ) : (
                collaborators.map((c) => (
                  <tr key={c._id} className='border-b hover:bg-gray-50'>
                    <td className='px-4 py-3 font-medium'>{c.name || '—'}</td>
                    <td className='px-4 py-3'>{c.contactNo || '—'}</td>
                    <td className='px-4 py-3'>{c.email || '—'}</td>
                    <td className='px-4 py-3'>{c.city || '—'}</td>
                    <td className='px-4 py-3'>{c.state || '—'}</td>
                    <td className='px-4 py-3'>
                      {c.rate != null && c.rate !== ''
                        ? `${c.rateType ? c.rateType + ' ' : ''}₹${Number(c.rate).toLocaleString('en-IN')}`
                        : '—'}
                    </td>
                    <td className='px-4 py-3'>
                      {c.individualType ? (
                        <span className='px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800'>
                          {c.individualType}
                        </span>
                      ) : '—'}
                    </td>
                    <td className='px-4 py-3 max-w-[180px]'>
                      <div className='flex flex-col gap-0.5'>
                        {c.socialMediaLink && (
                          <a href={c.socialMediaLink} target='_blank' rel='noopener noreferrer' className='text-blue-600 truncate hover:underline'>
                            Social
                          </a>
                        )}
                        {c.portfolioLink && (
                          <a href={c.portfolioLink} target='_blank' rel='noopener noreferrer' className='text-blue-600 truncate hover:underline'>
                            Portfolio
                          </a>
                        )}
                        {!c.socialMediaLink && !c.portfolioLink && '—'}
                      </div>
                    </td>
                    <td className='px-4 py-3'>
                      <div className='flex items-center gap-2'>
                        <button
                          onClick={() => navigate(`/collaborators/edit/${c._id}`)}
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

export default CollaboratorsView
