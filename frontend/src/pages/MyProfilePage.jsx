import React from 'react'
import { useAuth } from '../context/AuthContext'
import EmployeeProfileView from '../components/views/EmployeeProfileView'

const MyProfilePage = () => {
  const { user } = useAuth()

  if (!user?._id) {
    return <div className='p-8 text-sm text-gray-600'>Please log in to view your profile.</div>
  }

  return <EmployeeProfileView employeeId={user._id} isSelfProfile />
}

export default MyProfilePage
