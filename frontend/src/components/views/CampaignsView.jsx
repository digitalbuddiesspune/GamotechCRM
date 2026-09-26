import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'
import { buildCampaignSummaries } from '../../utils/leadCampaigns'

const platformLabel = (platform) => {
  if (platform === 'meta') return 'Meta Ads'
  if (platform === 'google') return 'Google Ads'
  return 'Mixed / manual'
}

const platformBadgeClass = (platform) => {
  if (platform === 'meta') return 'bg-blue-100 text-blue-800'
  if (platform === 'google') return 'bg-amber-100 text-amber-800'
  return 'bg-gray-100 text-gray-700'
}

const formatDate = (ms) => {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const CampaignsView = () => {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await api.get('/leads')
        setLeads(Array.isArray(res.data) ? res.data : [])
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load campaigns')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const campaigns = useMemo(() => buildCampaignSummaries(leads), [leads])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.campaignId.toLowerCase().includes(q) ||
        c.platform.toLowerCase().includes(q)
    )
  }, [campaigns, search])

  const totals = useMemo(
    () => ({
      campaigns: campaigns.length,
      leads: leads.length,
      interested: leads.filter((l) => l.status === 'Interested').length,
      meetings: leads.filter((l) => l.status === 'Meeting Schedule').length,
    }),
    [campaigns.length, leads]
  )

  const openCampaignLeads = (groupKey) => {
    navigate(`/leads?campaign=${encodeURIComponent(groupKey)}`)
  }

  return (
    <div className='p-6 md:p-8 bg-[#f4f6f9] min-h-full'>
      <div className='mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Campaigns</h1>
          <p className='text-gray-600 mt-1 text-sm'>
            Meta / Google and sheet-import campaigns grouped from your CRM leads.
          </p>
        </div>
        <button
          type='button'
          onClick={() => navigate('/leads')}
          className='bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors'
        >
          View all leads
        </button>
      </div>

      <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6'>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>Campaigns</p>
          <p className='text-2xl font-bold text-gray-900 mt-1'>{loading ? '—' : totals.campaigns}</p>
        </div>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>Total leads</p>
          <p className='text-2xl font-bold text-gray-900 mt-1'>{loading ? '—' : totals.leads}</p>
        </div>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>Interested</p>
          <p className='text-2xl font-bold text-emerald-600 mt-1'>{loading ? '—' : totals.interested}</p>
        </div>
        <div className='bg-white rounded-xl border border-gray-100 shadow-sm p-4'>
          <p className='text-xs text-gray-500 font-medium'>Meetings</p>
          <p className='text-2xl font-bold text-amber-600 mt-1'>{loading ? '—' : totals.meetings}</p>
        </div>
      </div>

      <div className='mb-4'>
        <input
          type='text'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search campaign name or ID…'
          className='w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500'
        />
      </div>

      {loading ? (
        <p className='text-sm text-gray-500'>Loading campaigns…</p>
      ) : error ? (
        <p className='text-sm text-red-600'>{error}</p>
      ) : filtered.length === 0 ? (
        <div className='bg-white rounded-lg shadow-sm border border-gray-100 p-10 text-center text-gray-500 text-sm'>
          No campaigns found. Import Meta sheet CSV or connect the Meta webhook to create leads with campaign data.
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-4'>
          {filtered.map((campaign) => {
            const qualified = campaign.interested + campaign.meetings
            const progress = campaign.leadCount
              ? Math.round((qualified / campaign.leadCount) * 100)
              : 0

            return (
              <div
                key={campaign.groupKey}
                className='bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-l-4 border-purple-500'
              >
                <div className='flex flex-wrap justify-between items-start gap-3 mb-4'>
                  <div className='min-w-0'>
                    <h3 className='text-lg font-bold text-gray-900'>{campaign.name}</h3>
                    {campaign.sublabel ? (
                      <p className='text-sm text-gray-500 mt-0.5'>{campaign.sublabel}</p>
                    ) : null}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${platformBadgeClass(campaign.platform)}`}
                  >
                    {platformLabel(campaign.platform)}
                  </span>
                </div>

                <div className='grid grid-cols-2 md:grid-cols-4 gap-4 mb-4'>
                  <div>
                    <p className='text-xs text-gray-500'>Leads</p>
                    <p className='text-lg font-bold text-gray-900'>{campaign.leadCount}</p>
                  </div>
                  <div>
                    <p className='text-xs text-gray-500'>Interested</p>
                    <p className='text-lg font-bold text-emerald-600'>{campaign.interested}</p>
                  </div>
                  <div>
                    <p className='text-xs text-gray-500'>Meetings</p>
                    <p className='text-lg font-bold text-amber-600'>{campaign.meetings}</p>
                  </div>
                  <div>
                    <p className='text-xs text-gray-500'>Last activity</p>
                    <p className='text-sm font-medium text-gray-900'>{formatDate(campaign.latestAt)}</p>
                  </div>
                </div>

                <div className='mb-4'>
                  <div className='flex justify-between mb-1'>
                    <span className='text-xs font-semibold text-gray-700'>Qualified pipeline</span>
                    <span className='text-xs font-bold text-gray-900'>{progress}%</span>
                  </div>
                  <div className='w-full bg-gray-200 rounded-full h-2'>
                    <div
                      className='bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all'
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <p className='text-xs text-gray-500 mt-1'>
                    {qualified} of {campaign.leadCount} leads interested or in meetings
                  </p>
                </div>

                <button
                  type='button'
                  onClick={() => openCampaignLeads(campaign.groupKey)}
                  className='text-sm font-medium text-purple-700 hover:text-purple-900'
                >
                  View leads in this campaign →
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CampaignsView
