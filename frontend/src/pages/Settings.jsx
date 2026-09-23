import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const Settings = () => {
  const { user } = useAuth()
  const navigate = useNavigate()

  const formatDate = (d) => {
    if (!d) return '—'
    const date = new Date(d)
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const formatDateTime = (d) => {
    if (!d) return '—'
    const date = new Date(d)
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const designationName = user?.designation?.title || user?.designation?.name || '—'

  const profileFields = [
    { label: 'Name', value: user?.name },
    { label: 'Email', value: user?.email },
    { label: 'Designation', value: designationName },
    { label: 'Department', value: user?.department },
    { label: 'Date of Joining', value: formatDate(user?.dateOfJoining) },
    { label: 'Salary', value: user?.salary != null ? `₹${Number(user.salary).toLocaleString('en-IN')}` : '—' },
    { label: 'Working Hours', value: user?.workingHours },
    { label: 'Status', value: user?.status },
    { label: 'Account Created', value: formatDateTime(user?.createdAt) },
    { label: 'Last Updated', value: formatDateTime(user?.updatedAt) },
  ]

  return (
    <div className='p-6 md:p-8 w-full'>
      <div className='flex flex-wrap items-center justify-between gap-4 mb-6'>
        <div>
          <h1 className='text-2xl font-bold text-gray-900'>Settings</h1>
          <p className='text-sm text-gray-500 mt-1'>Your account overview</p>
        </div>
        {user?._id && (
          <button
            type='button'
            onClick={() => navigate(`/employees/${user._id}/profile`)}
            className='px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700'
          >
            View Full Profile
          </button>
        )}
      </div>

      <div className='bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'>
        <div className='px-6 py-4 bg-gray-50 border-b border-gray-200'>
          <h2 className='text-lg font-semibold text-gray-900'>User Profile</h2>
          <p className='text-sm text-gray-500 mt-0.5'>Your account details</p>
        </div>
        <div className='p-6 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4'>
          {profileFields.map(({ label, value }) => (
            <div key={label} className='flex flex-col gap-1'>
              <span className='text-sm font-medium text-gray-500'>{label}</span>
              <span className='text-sm text-gray-900 font-medium'>{value || '—'}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Settings
