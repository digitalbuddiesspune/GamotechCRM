import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../../api/axios'

const statusClass = (status) => {
  const s = String(status || '').toUpperCase()
  if (s === 'ACTIVE') return 'bg-green-100 text-green-800'
  if (s === 'PAUSED') return 'bg-amber-100 text-amber-800'
  if (s === 'FROM_CRM_ONLY') return 'bg-gray-100 text-gray-700'
  return 'bg-blue-100 text-blue-800'
}

const formatDate = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

const formatBudget = (value) => {
  if (value == null || value === '') return '—'
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  return `₹${(n / 100).toLocaleString('en-IN')}`
}

const CampaignsView = () => {
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState([])
  const [adAccounts, setAdAccounts] = useState([])
  const [selectedAdAccount, setSelectedAdAccount] = useState('')
  const [metaInfo, setMetaInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setError(null)
        const params = selectedAdAccount ? { adAccount: selectedAdAccount } : {}
        const res = await api.get('/meta/campaigns', { params })
        setCampaigns(Array.isArray(res.data?.campaigns) ? res.data.campaigns : [])
        setAdAccounts(Array.isArray(res.data?.adAccounts) ? res.data.adAccounts : [])
        setMetaInfo(res.data?.meta || null)
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load Meta campaigns')
        setMetaInfo(err.response?.data?.details || null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedAdAccount])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        String(c.id).includes(q) ||
        c.objective?.toLowerCase().includes(q) ||
        c.status?.toLowerCase().includes(q)
    )
  }, [campaigns, search])

  const totals = useMemo(
    () => ({
      campaigns: campaigns.length,
      leads: campaigns.reduce((sum, c) => sum + (c.leadCount || 0), 0),
      interested: campaigns.reduce((sum, c) => sum + (c.interested || 0), 0),
      meetings: campaigns.reduce((sum, c) => sum + (c.meetings || 0), 0),
    }),
    [campaigns]
  )

  const openCampaignLeads = (campaignId) => {
    navigate(`/leads?campaign=${encodeURIComponent(campaignId)}`)
  }

  return (
    <div className='p-6 md:p-8 bg-[#f4f6f9] min-h-full'>
      <div className='mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Meta Ads Campaigns</h1>
          <p className='text-gray-600 mt-1 text-sm'>
            Loaded from Meta Graph API, with CRM lead counts from your webhook imports.
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
          <p className='text-xs text-gray-500 font-medium'>CRM leads</p>
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

      {metaInfo && !loading && !error ? (
        <p className='text-xs text-gray-500 mb-3'>
          Graph mode: {metaInfo.fetchMode}
          {metaInfo.adAccountCount != null ? ` · Ad accounts: ${metaInfo.adAccountCount}` : ''}
          {metaInfo.hint ? ` · ${metaInfo.hint}` : ''}
        </p>
      ) : null}

      <div className='mb-4 flex flex-col sm:flex-row gap-3'>
        <select
          value={selectedAdAccount}
          onChange={(e) => setSelectedAdAccount(e.target.value)}
          className='border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white min-w-[220px] focus:outline-none focus:ring-2 focus:ring-purple-500'
        >
          <option value=''>All ad accounts ({adAccounts.length})</option>
          {adAccounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name} ({acc.id})
            </option>
          ))}
        </select>
        <input
          type='text'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder='Search Meta campaign name or ID…'
          className='flex-1 max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500'
        />
      </div>

      {loading ? (
        <p className='text-sm text-gray-500'>Loading Meta campaigns…</p>
      ) : error ? (
        <div className='bg-white rounded-lg border border-red-100 p-6 text-sm text-red-700 max-w-2xl'>
          <p className='font-semibold mb-2'>{error}</p>
          <ul className='list-disc pl-5 space-y-1 text-gray-700'>
            <li>Set <code className='text-xs bg-gray-100 px-1'>META_PAGE_ACCESS_TOKEN</code> on the production backend.</li>
            <li>Token needs <strong>ads_read</strong> (and often <strong>leads_retrieval</strong> for webhooks).</li>
            <li>Leave <code className='text-xs bg-gray-100 px-1'>META_AD_ACCOUNT_ID</code> empty for all client accounts (100+).</li>
            <li>Use a Business Manager <strong>System User</strong> token with access to all client ad accounts.</li>
            <li>Only if needed: <code className='text-xs bg-gray-100 px-1'>META_AD_ACCOUNT_IDS=act_1,act_2,…</code></li>
            <li>Deploy the latest backend with route <code className='text-xs bg-gray-100 px-1'>GET /meta/campaigns</code>.</li>
          </ul>
        </div>
      ) : filtered.length === 0 ? (
        <div className='bg-white rounded-lg shadow-sm border border-gray-100 p-8 text-sm text-gray-600 max-w-2xl'>
          No Meta campaigns returned. Check ad account access and that campaigns exist in Ads Manager.
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-4'>
          {filtered.map((campaign) => {
            const qualified = (campaign.interested || 0) + (campaign.meetings || 0)
            const progress = campaign.leadCount
              ? Math.round((qualified / campaign.leadCount) * 100)
              : 0

            return (
              <div
                key={campaign.id}
                className='bg-white rounded-xl shadow-sm border border-gray-100 p-5 border-l-4 border-purple-500'
              >
                <div className='flex flex-wrap justify-between items-start gap-3 mb-4'>
                  <div className='min-w-0'>
                    <h3 className='text-lg font-bold text-gray-900'>{campaign.name}</h3>
                    <p className='text-xs text-gray-500 mt-1 font-mono'>Campaign ID: {campaign.id}</p>
                    {campaign.adAccountName ? (
                      <p className='text-xs text-gray-500 mt-0.5'>
                        Ad account: {campaign.adAccountName}
                        {campaign.adAccountId ? ` (${campaign.adAccountId})` : ''}
                      </p>
                    ) : null}
                    {campaign.objective ? (
                      <p className='text-sm text-gray-600 mt-1'>Objective: {campaign.objective}</p>
                    ) : null}
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusClass(campaign.status)}`}>
                    {campaign.status}
                  </span>
                </div>

                <div className='grid grid-cols-2 md:grid-cols-5 gap-4 mb-4'>
                  <div>
                    <p className='text-xs text-gray-500'>Leads (CRM)</p>
                    <p className='text-lg font-bold text-gray-900'>{campaign.leadCount || 0}</p>
                  </div>
                  <div>
                    <p className='text-xs text-gray-500'>Interested</p>
                    <p className='text-lg font-bold text-emerald-600'>{campaign.interested || 0}</p>
                  </div>
                  <div>
                    <p className='text-xs text-gray-500'>Meetings</p>
                    <p className='text-lg font-bold text-amber-600'>{campaign.meetings || 0}</p>
                  </div>
                  <div>
                    <p className='text-xs text-gray-500'>Daily budget</p>
                    <p className='text-sm font-medium text-gray-900'>{formatBudget(campaign.dailyBudget)}</p>
                  </div>
                  <div>
                    <p className='text-xs text-gray-500'>Created</p>
                    <p className='text-sm font-medium text-gray-900'>{formatDate(campaign.createdTime)}</p>
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
                </div>

                <button
                  type='button'
                  onClick={() => openCampaignLeads(campaign.id)}
                  className='text-sm font-medium text-purple-700 hover:text-purple-900'
                >
                  View CRM leads for this campaign →
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
