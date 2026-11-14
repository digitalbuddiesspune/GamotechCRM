import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import StatusFilterChips from '../StatusFilterChips'
import BrandLogo from '../BrandLogo'

const STATUS_OPTIONS = [
  'Call not Received',
  'Call You After Sometime',
  'Interested',
  'Not Interested',
  'Meeting Schedule',
]

const statusClass = (status) => {
  if (status === 'Interested') return 'bg-emerald-50 text-emerald-800'
  if (status === 'Meeting Schedule') return 'bg-amber-50 text-amber-800'
  if (status === 'Not Interested') return 'bg-gray-100 text-gray-600'
  if (status === 'Call You After Sometime') return 'bg-violet-50 text-violet-800'
  return 'bg-blue-50 text-blue-800'
}

const formatWhen = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const sectionKey = (section) => section?.campaignId || section?.campaignName || ''

const ClientLeadsDashboard = () => {
  const { user, updateUser } = useAuth()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedKey = searchParams.get('campaign') || ''
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [savingId, setSavingId] = useState('')
  const [fetching, setFetching] = useState(false)
  const [fetchNotice, setFetchNotice] = useState(null)

  const load = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    setError('')
    try {
      const res = await api.get('/client-portal/leads')
      setSections(Array.isArray(res.data?.sections) ? res.data.sections : [])
      updateUser({ logoUrl: res.data?.logoUrl || '' })
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not load your leads')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const fetchNewLeads = async () => {
    if (!selectedSection || fetching) return
    setFetching(true)
    setFetchNotice(null)
    setError('')
    try {
      const res = await api.post('/client-portal/leads/fetch', {
        campaignId: selectedSection.campaignId || '',
        campaignName: selectedSection.campaignName || '',
      })
      setFetchNotice(res.data || { message: 'Fetch finished.' })
      await load({ silent: true })
    } catch (err) {
      setFetchNotice({
        error: err.response?.data?.message || err.message || 'Could not fetch new leads',
      })
    } finally {
      setFetching(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (loading || selectedKey || sections.length === 0) return
    const key = sectionKey(sections[0])
    if (key) setSearchParams({ campaign: key }, { replace: true })
  }, [loading, selectedKey, sections, setSearchParams])

  const selectedSection = useMemo(() => {
    if (!sections.length) return null
    if (!selectedKey) return sections[0]
    return sections.find((section) => section.campaignId === selectedKey || section.campaignName === selectedKey) || null
  }, [sections, selectedKey])

  const totals = useMemo(() => {
    const leads = selectedSection?.leads || []
    return {
      leads: leads.length,
      interested: leads.filter((lead) => lead.status === 'Interested').length,
      meetings: leads.filter((lead) => lead.status === 'Meeting Schedule').length,
    }
  }, [selectedSection])

  const searchedLeads = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (selectedSection?.leads || []).filter((lead) => {
      if (!q) return true
      return `${lead.name} ${lead.phone} ${lead.businessName} ${lead.city}`.toLowerCase().includes(q)
    })
  }, [selectedSection, query])

  const statusCounts = useMemo(() => {
    const counts = { '': searchedLeads.length }
    for (const status of STATUS_OPTIONS) {
      counts[status] = searchedLeads.filter((lead) => lead.status === status).length
    }
    return counts
  }, [searchedLeads])

  const visibleLeads = useMemo(() => {
    if (!statusFilter) return searchedLeads
    return searchedLeads.filter((lead) => lead.status === statusFilter)
  }, [searchedLeads, statusFilter])

  const openLead = (lead, mode = 'view') => {
    const params = new URLSearchParams()
    if (selectedKey) params.set('campaign', selectedKey)
    const query = params.toString()
    navigate(`/client-leads/${mode}/${lead.source}/${lead.recordId}${query ? `?${query}` : ''}`)
  }

  const updateLead = async (lead, patch) => {
    setSavingId(lead.id)
    setError('')
    try {
      const res = await api.patch('/client-portal/leads', {
        source: lead.source,
        recordId: lead.recordId,
        status: patch.status ?? lead.status,
        remark: patch.remark ?? lead.remark,
      })
      setSections((prev) => prev.map((section) => ({
        ...section,
        leads: section.leads.map((item) => (
          item.id === lead.id
            ? { ...item, status: res.data?.status || patch.status || item.status, remark: res.data?.remark ?? patch.remark ?? item.remark }
            : item
        )),
      })))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not update this lead')
    } finally {
      setSavingId('')
    }
  }

  return (
    <div className='p-6 sm:p-8'>
      <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
        <div className='flex items-center gap-4 min-w-0'>
          <div className='h-14 w-28 shrink-0 rounded-lg border border-gray-200 bg-white p-1.5 flex items-center justify-center'>
            <BrandLogo logoUrl={user?.logoUrl} alt={user?.name || 'Client logo'} className='max-h-full max-w-full object-contain' />
          </div>
          <div className='min-w-0'>
            <h1 className='text-2xl font-bold text-gray-900'>
              {selectedSection?.campaignName || user?.name || 'Lead dashboard'}
            </h1>
            <p className='text-sm text-gray-600 mt-1'>Showing this campaign only. Choose another campaign from the sidebar.</p>
          </div>
        </div>
        <button
          type='button'
          onClick={fetchNewLeads}
          disabled={fetching || !selectedSection}
          className='bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors cursor-pointer'
        >
          {fetching ? 'Fetching leads…' : 'Fetch new leads'}
        </button>
      </div>

      {fetchNotice ? (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            fetchNotice.error
              ? 'bg-red-50 border-red-100 text-red-700'
              : 'bg-emerald-50 border-emerald-100 text-emerald-800'
          }`}
        >
          <p className='font-medium'>{fetchNotice.error || fetchNotice.message}</p>
        </div>
      ) : null}

      <div className='grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6'>
        {[
          ['Leads', totals.leads],
          ['Interested', totals.interested],
          ['Meetings', totals.meetings],
        ].map(([label, value]) => (
          <div key={label} className='bg-white rounded-lg shadow p-4 border-l-4 border-blue-500'>
            <p className='text-xs font-medium text-gray-500'>{label}</p>
            <p className='text-2xl font-bold text-gray-900 mt-1'>{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      <div className='bg-white rounded-lg shadow p-4 mb-6 flex flex-wrap gap-3'>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search name or phone'
          className='border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-[200px]'
        />
        <div className='w-full'>
          <StatusFilterChips value={statusFilter} onChange={setStatusFilter} counts={statusCounts} />
        </div>
      </div>

      {error ? <p className='mb-4 text-sm text-red-600'>{error}</p> : null}
      {loading ? <p className='text-sm text-gray-500'>Loading your leads…</p> : null}

      {!loading && !selectedSection ? (
        <p className='bg-white rounded-lg shadow p-8 text-center text-sm text-gray-500'>Select a campaign from the sidebar.</p>
      ) : null}

      {selectedSection ? (
          <section className='bg-white rounded-lg shadow overflow-hidden'>
            <div className='px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2'>
              <div>
                <h2 className='text-base font-semibold text-gray-900'>{selectedSection.campaignName || 'Campaign'}</h2>
                {selectedSection.campaignId ? <p className='text-xs text-gray-500 font-mono mt-0.5'>{selectedSection.campaignId}</p> : null}
              </div>
              <span className='rounded-full bg-blue-50 text-blue-800 px-2.5 py-1 text-xs font-semibold'>
                {visibleLeads.length} lead{visibleLeads.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left text-gray-500 border-b'>
                    <th className='px-4 py-3 font-medium'>Name</th>
                    <th className='px-4 py-3 font-medium'>Phone</th>
                    <th className='px-4 py-3 font-medium'>Received</th>
                    <th className='px-4 py-3 font-medium'>Status</th>
                    <th className='px-4 py-3 font-medium'>Note</th>
                    <th className='px-4 py-3 font-medium'>Edit</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLeads.length === 0 ? (
                    <tr>
                      <td colSpan={6} className='px-4 py-8 text-center text-gray-500'>No leads in this campaign yet.</td>
                    </tr>
                  ) : visibleLeads.map((lead) => (
                    <tr
                      key={lead.id}
                      className='border-b last:border-b-0 hover:bg-gray-50 cursor-pointer'
                      onClick={() => openLead(lead)}
                    >
                      <td className='px-4 py-3'>
                        <p className='font-medium text-indigo-700'>{lead.name || '—'}</p>
                        {lead.businessName ? <p className='text-xs text-gray-500'>{lead.businessName}</p> : null}
                      </td>
                      <td className='px-4 py-3 whitespace-nowrap'>{lead.phone || '—'}</td>
                      <td className='px-4 py-3 whitespace-nowrap text-gray-600'>{formatWhen(lead.createdAt)}</td>
                      <td className='px-4 py-3'>
                        <select
                          value={lead.status}
                          disabled={savingId === lead.id}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => updateLead(lead, { status: e.target.value })}
                          className={`cursor-pointer border border-transparent rounded-lg px-2 py-1 text-xs font-semibold ${statusClass(lead.status)}`}
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                        </select>
                      </td>
                      <td className='px-4 py-3 min-w-[180px]'>
                        <input
                          defaultValue={lead.remark || ''}
                          key={`${lead.id}:${lead.remark || ''}`}
                          onClick={(e) => e.stopPropagation()}
                          onBlur={(e) => {
                            const next = e.target.value.trim()
                            if (next !== (lead.remark || '')) updateLead(lead, { remark: next })
                          }}
                          placeholder='Add a note'
                          className='w-full cursor-text border border-gray-200 rounded-lg px-2 py-1 text-sm'
                        />
                      </td>
                      <td className='px-4 py-3' onClick={(e) => e.stopPropagation()}>
                        <button
                          type='button'
                          onClick={() => openLead(lead, 'edit')}
                          className='cursor-pointer rounded-lg border border-blue-200 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50'
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
      ) : null}
    </div>
  )
}

export default ClientLeadsDashboard
