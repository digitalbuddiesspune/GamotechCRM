import React, { useCallback, useEffect, useState } from 'react'
import api from '../api/axios'

const MetaIntegrationSettings = () => {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState(null)
  const [accessToken, setAccessToken] = useState('')
  const [note, setNote] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await api.get('/meta/token/status')
      setStatus(res.data)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load Meta token status')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const res = await api.put('/meta/token', {
        accessToken: accessToken.trim(),
        note: note.trim(),
      })
      setMessage(res.data?.message || 'Token saved')
      setAccessToken('')
      await loadStatus()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to save token')
    } finally {
      setSaving(false)
    }
  }

  const inspection = status?.inspection
  const storage = status?.storage
  const expiresAt = inspection?.expiresAt || storage?.expiresAt

  return (
    <div className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mt-6'>
      <div className='px-6 py-4 bg-gray-50 border-b border-gray-200'>
        <h2 className='text-lg font-semibold text-gray-900'>Meta Ads integration</h2>
        <p className='text-sm text-gray-500 mt-0.5'>
          Webhooks and campaigns use a Meta Graph API token. CRM login sessions are separate from this token.
        </p>
      </div>

      <div className='p-6 space-y-4'>
        {loading ? (
          <p className='text-sm text-gray-500'>Checking Meta token…</p>
        ) : (
          <>
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm'>
              <div>
                <p className='text-gray-500'>Status</p>
                <p className={`font-semibold ${inspection?.valid ? 'text-emerald-600' : 'text-red-600'}`}>
                  {inspection?.valid ? 'Valid' : inspection?.message || 'Not configured'}
                </p>
              </div>
              <div>
                <p className='text-gray-500'>Token source</p>
                <p className='font-medium text-gray-900'>{storage?.source || '—'}</p>
              </div>
              <div>
                <p className='text-gray-500'>Expires</p>
                <p className='font-medium text-gray-900'>
                  {expiresAt ? new Date(expiresAt).toLocaleString('en-IN') : 'No expiry shown (use System User token)'}
                </p>
              </div>
              <div>
                <p className='text-gray-500'>Active token</p>
                <p className='font-mono text-xs text-gray-700'>{storage?.tokenPreview || '—'}</p>
              </div>
            </div>

            <div className='rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-sm text-blue-900'>
              <p className='font-semibold mb-1'>Recommended (no weekly expiry)</p>
              <p>
                Use a <strong>Meta Business Manager → System User</strong> token with{' '}
                <strong>ads_read</strong> and <strong>leads_retrieval</strong>. Generate token with expiration{' '}
                <strong>Never</strong>, then paste it below. Do not use short-lived user session tokens in production.
              </p>
            </div>

            <form onSubmit={handleSave} className='space-y-3 border-t border-gray-100 pt-4'>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>New Meta access token</label>
                <textarea
                  value={accessToken}
                  onChange={(e) => setAccessToken(e.target.value)}
                  rows={3}
                  placeholder='Paste System User or long-lived token…'
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono'
                />
              </div>
              <div>
                <label className='block text-sm font-medium text-gray-700 mb-1'>Note (optional)</label>
                <input
                  type='text'
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder='e.g. System user – main BM – renewed Sep 2026'
                  className='w-full border border-gray-300 rounded-lg px-3 py-2 text-sm'
                />
              </div>
              {message ? <p className='text-sm text-emerald-600'>{message}</p> : null}
              {error ? <p className='text-sm text-red-600'>{error}</p> : null}
              <button
                type='submit'
                disabled={saving || !accessToken.trim()}
                className='px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50'
              >
                {saving ? 'Saving…' : 'Save Meta token'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default MetaIntegrationSettings
