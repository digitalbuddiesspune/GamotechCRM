import React, { useEffect, useMemo, useRef, useState } from 'react'
import api from '../../api/axios'
import { uploadFile } from '../../utils/uploadFile'
import BrandLogo from '../BrandLogo'

const emptyForm = {
  clientName: '',
  email: '',
  password: '',
  status: 'Active',
  campaignKeys: [],
  logoUrl: '',
}

const campaignKey = (campaign) => campaign.campaignId || `name::${campaign.campaignName}`

const makePassword = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = new Uint32Array(10)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join('')
}

const ClientLeadPortalsView = () => {
  const [portals, setPortals] = useState([])
  const [campaigns, setCampaigns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [credentials, setCredentials] = useState(null)
  const [campaignSearch, setCampaignSearch] = useState('')
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef(null)

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [portalRes, campaignRes] = await Promise.all([
        api.get('/client-lead-portals'),
        api.get('/client-lead-portals/campaign-options'),
      ])
      setPortals(Array.isArray(portalRes.data) ? portalRes.data : [])
      setCampaigns(Array.isArray(campaignRes.data?.campaigns) ? campaignRes.data.campaigns : [])
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load client dashboards')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const visibleCampaigns = useMemo(() => {
    const q = campaignSearch.trim().toLowerCase()
    if (!q) return campaigns
    return campaigns.filter((c) =>
      `${c.campaignName} ${c.campaignId}`.toLowerCase().includes(q)
    )
  }, [campaigns, campaignSearch])

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...emptyForm, password: makePassword() })
    setCampaignSearch('')
    setFormOpen(true)
  }

  const openEdit = (portal) => {
    const keys = (portal.campaigns || []).map(campaignKey)
    setEditingId(portal._id)
    setForm({
      clientName: portal.clientName || '',
      email: portal.email || '',
      password: '',
      status: portal.status || 'Active',
      campaignKeys: keys,
      logoUrl: portal.logoUrl || '',
    })
    setCampaignSearch('')
    setFormOpen(true)
  }

  const toggleCampaign = (key) => {
    setForm((prev) => ({
      ...prev,
      campaignKeys: prev.campaignKeys.includes(key)
        ? prev.campaignKeys.filter((item) => item !== key)
        : [...prev.campaignKeys, key],
    }))
  }

  const selectedCampaigns = () =>
    campaigns
      .filter((c) => form.campaignKeys.includes(campaignKey(c)))
      .map((c) => ({ campaignId: c.campaignId, campaignName: c.campaignName }))

  const save = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = {
        clientName: form.clientName.trim(),
        email: form.email.trim(),
        status: form.status,
        campaigns: selectedCampaigns(),
        logoUrl: form.logoUrl.trim(),
      }
      if (form.password.trim()) payload.password = form.password.trim()
      const res = editingId
        ? await api.put(`/client-lead-portals/${editingId}`, payload)
        : await api.post('/client-lead-portals', payload)
      if (res.data?.credentials) setCredentials(res.data.credentials)
      setFormOpen(false)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not save client dashboard')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (portal) => {
    if (!window.confirm(`Delete the dashboard for ${portal.clientName}? Their login will stop working.`)) return
    setError('')
    try {
      await api.delete(`/client-lead-portals/${portal._id}`)
      await load()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not delete dashboard')
    }
  }

  const uploadLogo = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      setError('Upload a PNG, JPG, or WebP logo')
      return
    }
    setUploadingLogo(true)
    setError('')
    try {
      const uploaded = await uploadFile(file, { folder: 'logos' })
      if (!uploaded.url) throw new Error('Upload did not return a logo address')
      setForm((prev) => ({ ...prev, logoUrl: uploaded.url }))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Could not upload the logo')
    } finally {
      setUploadingLogo(false)
    }
  }

  const copyCredentials = async () => {
    if (!credentials) return
    const text = `Client lead dashboard\nEmail: ${credentials.email}\nPassword: ${credentials.password}\nLogin: ${window.location.origin}/login`
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // clipboard can be blocked; the credentials stay visible on screen
    }
  }

  return (
    <div className='p-8'>
      <div className='flex flex-wrap items-center justify-between gap-3 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Client lead dashboards</h1>
          <p className='text-gray-600 mt-1 text-sm'>
            Create a login for each client. They only see the campaigns you select, and they can update lead status.
          </p>
        </div>
        <button
          type='button'
          onClick={openCreate}
          className='bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium'
        >
          + New client dashboard
        </button>
      </div>

      {error ? <p className='mb-4 text-sm text-red-600'>{error}</p> : null}

      {credentials ? (
        <div className='mb-6 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950'>
          <p className='font-semibold'>Share these credentials with the client. The password is shown only this once.</p>
          <p className='mt-2'>Email: <span className='font-mono'>{credentials.email}</span></p>
          <p>Password: <span className='font-mono'>{credentials.password}</span></p>
          <button type='button' onClick={copyCredentials} className='mt-2 text-emerald-800 underline'>
            Copy login details
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className='text-sm text-gray-500'>Loading dashboards…</p>
      ) : portals.length === 0 ? (
        <div className='bg-white rounded-lg shadow p-8 text-center text-sm text-gray-500'>
          No client dashboards yet. Create one and assign the campaigns that client should see.
        </div>
      ) : (
        <div className='bg-white rounded-lg shadow overflow-x-auto'>
          <table className='w-full text-sm'>
            <thead>
              <tr className='text-left border-b bg-blue-600 text-white'>
                <th className='px-4 py-3'>Logo</th>
                <th className='px-4 py-3'>Client</th>
                <th className='px-4 py-3'>Login email</th>
                <th className='px-4 py-3'>Campaigns</th>
                <th className='px-4 py-3'>Status</th>
                <th className='px-4 py-3'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {portals.map((portal) => (
                <tr key={portal._id} className='border-b'>
                  <td className='px-4 py-3'>
                    <div className='h-10 w-16 rounded border border-gray-200 bg-white p-1 flex items-center justify-center'>
                      <BrandLogo logoUrl={portal.logoUrl} alt='' className='max-h-full max-w-full object-contain' />
                    </div>
                  </td>
                  <td className='px-4 py-3 font-medium text-gray-900'>{portal.clientName}</td>
                  <td className='px-4 py-3'>{portal.email}</td>
                  <td className='px-4 py-3'>
                    <div className='flex flex-wrap gap-1'>
                      {(portal.campaigns || []).map((c) => (
                        <span key={campaignKey(c)} className='rounded-full bg-blue-50 text-blue-800 px-2 py-0.5 text-xs'>
                          {c.campaignName || c.campaignId}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className='px-4 py-3'>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${portal.status === 'Active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                      {portal.status}
                    </span>
                  </td>
                  <td className='px-4 py-3'>
                    <button type='button' onClick={() => openEdit(portal)} className='text-blue-700 font-medium mr-3'>Edit</button>
                    <button type='button' onClick={() => remove(portal)} className='text-red-600 font-medium'>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formOpen ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4' role='presentation' onClick={() => setFormOpen(false)}>
          <form
            onSubmit={save}
            onClick={(event) => event.stopPropagation()}
            className='bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6'
            role='dialog'
            aria-labelledby='client-portal-form-title'
          >
            <h2 id='client-portal-form-title' className='text-lg font-bold text-gray-900'>
              {editingId ? 'Edit client dashboard' : 'New client dashboard'}
            </h2>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4'>
              <label className='block text-sm'>
                <span className='font-medium text-gray-700'>Client name</span>
                <input
                  required
                  value={form.clientName}
                  onChange={(e) => setForm((prev) => ({ ...prev, clientName: e.target.value }))}
                  className='mt-1 w-full border border-gray-300 rounded-lg px-3 py-2'
                />
              </label>
              <label className='block text-sm'>
                <span className='font-medium text-gray-700'>Login email</span>
                <input
                  required
                  type='email'
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  className='mt-1 w-full border border-gray-300 rounded-lg px-3 py-2'
                />
              </label>
              <label className='block text-sm'>
                <span className='font-medium text-gray-700'>{editingId ? 'New password (optional)' : 'Password'}</span>
                <input
                  required={!editingId}
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  className='mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 font-mono'
                />
              </label>
              <label className='block text-sm'>
                <span className='font-medium text-gray-700'>Status</span>
                <select
                  value={form.status}
                  onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                  className='mt-1 w-full border border-gray-300 rounded-lg px-3 py-2'
                >
                  <option value='Active'>Active</option>
                  <option value='Inactive'>Inactive</option>
                </select>
              </label>
            </div>
            <div className='mt-4'>
              <p className='text-sm font-medium text-gray-700'>Client logo</p>
              <p className='text-xs text-gray-500 mt-0.5'>Shown on this client’s dashboard. If you leave it empty, the company logo is used.</p>
              <input ref={logoInputRef} type='file' accept='image/png,image/jpeg,image/webp,image/gif' onChange={uploadLogo} className='hidden' />
              <div className='mt-2 flex items-center gap-3'>
                <div className='h-14 w-24 rounded-lg border border-gray-200 bg-gray-50 p-1.5 flex items-center justify-center'>
                  <BrandLogo logoUrl={form.logoUrl} alt='Client logo preview' className='max-h-full max-w-full object-contain' />
                </div>
                <button
                  type='button'
                  onClick={() => logoInputRef.current?.click()}
                  disabled={uploadingLogo}
                  className='cursor-pointer rounded-lg border border-gray-300 px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50'
                >
                  {uploadingLogo ? 'Uploading…' : 'Upload logo'}
                </button>
                {form.logoUrl ? (
                  <button
                    type='button'
                    onClick={() => setForm((prev) => ({ ...prev, logoUrl: '' }))}
                    className='cursor-pointer text-sm text-red-600'
                  >
                    Remove
                  </button>
                ) : null}
              </div>
            </div>
            <div className='mt-4'>
              <div className='flex items-center justify-between gap-3'>
                <p className='text-sm font-medium text-gray-700'>Campaigns this client can see</p>
                <button type='button' onClick={() => setForm((prev) => ({ ...prev, password: makePassword() }))} className='text-xs text-blue-700'>
                  Generate password
                </button>
              </div>
              <input
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                placeholder='Search campaigns'
                className='mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
              />
              <div className='mt-2 max-h-56 overflow-y-auto border border-gray-200 rounded-lg divide-y'>
                {visibleCampaigns.length === 0 ? (
                  <p className='p-3 text-sm text-gray-500'>No campaigns found. Import leads first so campaigns appear here.</p>
                ) : visibleCampaigns.map((campaign) => {
                  const key = campaignKey(campaign)
                  return (
                    <label key={key} className='flex items-start gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50'>
                      <input
                        type='checkbox'
                        checked={form.campaignKeys.includes(key)}
                        onChange={() => toggleCampaign(key)}
                        className='mt-1'
                      />
                      <span>
                        <span className='font-medium text-gray-900'>{campaign.campaignName || campaign.campaignId}</span>
                        <span className='block text-xs text-gray-500'>
                          {campaign.leadCount} lead{campaign.leadCount === 1 ? '' : 's'}
                          {campaign.campaignId ? ` · ${campaign.campaignId}` : ''}
                        </span>
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>
            <div className='mt-5 flex justify-end gap-2'>
              <button type='button' onClick={() => setFormOpen(false)} className='px-4 py-2 text-sm rounded-md border border-gray-300'>
                Cancel
              </button>
              <button type='submit' disabled={saving} className='px-4 py-2 text-sm rounded-md bg-blue-600 text-white disabled:opacity-50'>
                {saving ? 'Saving…' : 'Save dashboard'}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}

export default ClientLeadPortalsView
