import React, { useCallback, useEffect, useState } from 'react'
import api from '../../api/axios'
import { useNavigate } from 'react-router-dom'
import { EditIcon, DeleteIcon } from '../Icons'

const DetailRow = ({ label, children }) => (
  <div className='grid grid-cols-1 sm:grid-cols-3 gap-1 py-2.5 border-b border-gray-100 last:border-0'>
    <dt className='text-xs font-semibold text-gray-500 uppercase tracking-wide sm:pt-0.5'>{label}</dt>
    <dd className='text-sm text-gray-900 sm:col-span-2 break-words'>{children ?? '—'}</dd>
  </div>
)

const CompaniesView = () => {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [viewCompany, setViewCompany] = useState(null)
  const navigate = useNavigate()

  const closeView = useCallback(() => setViewCompany(null), [])

  useEffect(() => {
    if (!viewCompany) return
    const onKey = (e) => {
      if (e.key === 'Escape') closeView()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewCompany, closeView])

  const fetchCompanies = async () => {
    try {
      setLoading(true)
      const res = await api.get('/companies')
      const list = Array.isArray(res.data) ? res.data : res.data?.data || []
      setCompanies(list)
    } catch (err) {
      setError(err.message || 'Error fetching companies')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompanies()
  }, [])

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this company?')) return
    try {
      await api.delete(`/companies/${id}`)
      fetchCompanies()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error deleting company')
    }
  }

  return (
    <div className='p-8'>
      <div className='flex items-center justify-between mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Company</h1>
          <p className='text-gray-600 mt-1 text-sm'>Manage your company details (logo, address, GST, etc.).</p>
        </div>
        <button
          type='button'
          onClick={() => navigate('/add-company')}
          className='bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium'
        >
          Add Company
        </button>
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
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Logo</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Company Name</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Address</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Email</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Phone</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>GSTIN</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>State</th>
                <th className='px-4 py-3 text-left border-b bg-blue-600 text-white font-bold text-sm text-center'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {companies.length === 0 ? (
                <tr>
                  <td colSpan={8} className='px-4 py-12 text-center text-gray-500'>
                    No companies found. Add one to get started.
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr
                    key={c._id}
                    role='button'
                    tabIndex={0}
                    aria-label={`Open read-only details for ${c.companyName || 'company'}`}
                    onClick={() => setViewCompany(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setViewCompany(c)
                      }
                    }}
                    className='border-b hover:bg-gray-50 cursor-pointer'
                  >
                    <td className='px-4 py-3'>
                      {c.companyLogo ? (
                        <img src={c.companyLogo} alt='' className='w-10 h-10 object-contain border rounded' />
                      ) : (
                        <span className='text-gray-400'>—</span>
                      )}
                    </td>
                    <td className='px-4 py-3 font-medium'>{c.companyName || '—'}</td>
                    <td className='px-4 py-3 max-w-[200px] truncate' title={c.address}>{c.address || '—'}</td>
                    <td className='px-4 py-3'>{c.email || '—'}</td>
                    <td className='px-4 py-3'>{c.phone || '—'}</td>
                    <td className='px-4 py-3'>{c.gstin || '—'}</td>
                    <td className='px-4 py-3'>{c.state || '—'}</td>
                    <td className='px-4 py-3' onClick={(e) => e.stopPropagation()}>
                      <div className='flex items-center gap-2'>
                        <button
                          type='button'
                          onClick={() => navigate(`/companies/edit/${c._id}`)}
                          className='p-1.5 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors'
                          title='Edit'
                        >
                          <EditIcon />
                        </button>
                        <button
                          type='button'
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

      {viewCompany && (
        <div
          className='fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50'
          role='presentation'
          onClick={closeView}
        >
          <div
            className='bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200'
            role='dialog'
            aria-modal='true'
            aria-labelledby='company-view-title'
            onClick={(e) => e.stopPropagation()}
          >
            <div className='flex items-start justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-gray-50'>
              <div>
                <h2 id='company-view-title' className='text-lg font-bold text-gray-900'>
                  Company details
                </h2>
                <p className='text-sm text-gray-600 mt-0.5'>Read-only view</p>
              </div>
              <button
                type='button'
                onClick={closeView}
                className='shrink-0 rounded-lg p-2 text-gray-500 hover:bg-gray-200 hover:text-gray-800'
                aria-label='Close'
              >
                <svg xmlns='http://www.w3.org/2000/svg' className='h-5 w-5' viewBox='0 0 20 20' fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                    clipRule='evenodd'
                  />
                </svg>
              </button>
            </div>
            <div className='overflow-y-auto px-5 py-4'>
              {viewCompany.companyLogo ? (
                <div className='mb-4'>
                  <p className='text-xs font-semibold text-gray-500 uppercase mb-2'>Logo</p>
                  <img src={viewCompany.companyLogo} alt='Company logo' className='max-h-24 object-contain border rounded-lg p-2 bg-gray-50' />
                </div>
              ) : null}
              <dl>
                <DetailRow label='Company name'>{viewCompany.companyName}</DetailRow>
                <DetailRow label='Working hours'>{viewCompany.workingHours}</DetailRow>
                <DetailRow label='Address'>{viewCompany.address}</DetailRow>
                <DetailRow label='Website'>{viewCompany.website}</DetailRow>
                <DetailRow label='Email'>{viewCompany.email}</DetailRow>
                <DetailRow label='Phone'>{viewCompany.phone}</DetailRow>
                <DetailRow label='PAN'>{viewCompany.pan}</DetailRow>
                <DetailRow label='GSTIN'>{viewCompany.gstin}</DetailRow>
                <DetailRow label='GST state code'>{viewCompany.gstCode}</DetailRow>
                <DetailRow label='State'>{viewCompany.state}</DetailRow>
                <DetailRow label='Bank name'>{viewCompany.bankName}</DetailRow>
                <DetailRow label='Bank account number'>{viewCompany.bankAccountNumber}</DetailRow>
                {Array.isArray(viewCompany.personalAccounts) && viewCompany.personalAccounts.length > 0 && (
                  <div className='pt-3'>
                    <p className='text-xs font-semibold text-gray-500 uppercase mb-2'>Personal accounts</p>
                    <ul className='space-y-2'>
                      {viewCompany.personalAccounts.map((pa, i) => (
                        <li key={i} className='text-sm border border-gray-100 rounded-lg p-3 bg-gray-50'>
                          <p><span className='text-gray-500'>Receiver:</span> {pa.receiverName || '—'}</p>
                          <p><span className='text-gray-500'>Bank:</span> {pa.bankName || '—'}</p>
                          <p><span className='text-gray-500'>Account:</span> {pa.bankAccountNumber || '—'}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </dl>
            </div>
            <div className='px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-2 justify-end'>
              <button
                type='button'
                onClick={() => {
                  navigate(`/companies/edit/${viewCompany._id}`)
                  closeView()
                }}
                className='px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-100'
              >
                Edit company
              </button>
              <button
                type='button'
                onClick={closeView}
                className='px-4 py-2 rounded-lg bg-gray-800 text-white text-sm font-medium hover:bg-gray-900'
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CompaniesView
