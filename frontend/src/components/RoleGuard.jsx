import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const HR_ONLY_PATHS = [
  '/admin-dashboard',
  '/salaries',
  '/add-salary',
  '/billings',
  '/campaigns',
  '/reports',
  '/calendar',
  '/company-profile',
]

const isClientPath = (pathname) =>
  pathname === '/clients'
  || pathname === '/add-client'
  || pathname.startsWith('/clients/edit/')

const isEmployeeManagePath = (pathname) =>
  pathname === '/employees'
  || pathname === '/add-employee'
  || pathname.startsWith('/employees/edit/')

const isHROnlyPath = (pathname) => {
  return HR_ONLY_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

const isAddProjectPath = (pathname) => pathname === '/add-project'

const isEditProjectPath = (pathname) => pathname.startsWith('/projects/edit/')

const isProjectsOnlyPath = (pathname) => {
  if (pathname === '/projects') return true
  if (/^\/projects\/[^/]+\/dashboard$/.test(pathname)) return true
  if (pathname.startsWith('/projects/edit/')) return true
  return false
}

const isTasksListPath = (pathname) => pathname === '/tasks'

const RoleGuard = ({ children }) => {
  const {
    user,
    hasFullAccess,
    canAddProject,
    canEditProject,
    canViewProjects,
    canManageClients,
    canManageEmployees,
    getDashboardPath,
  } = useAuth()
  const location = useLocation()
  const dashboardPath = getDashboardPath()

  const ownProfileMatch = location.pathname.match(/^\/employees\/([^/]+)\/profile$/)
  const isOwnProfile = ownProfileMatch && user?._id && String(ownProfileMatch[1]) === String(user._id)

  if (hasFullAccess()) return children

  if (isOwnProfile) return children

  const tasksDetailMatch = location.pathname.match(/^\/tasks\/([^/]+)$/)
  if (tasksDetailMatch) {
    return <Navigate to={`/my-tasks/${tasksDetailMatch[1]}`} replace />
  }
  if (isHROnlyPath(location.pathname)) {
    return <Navigate to={dashboardPath} replace />
  }
  if (isClientPath(location.pathname) && !canManageClients()) {
    return <Navigate to={dashboardPath} replace />
  }
  if (isEmployeeManagePath(location.pathname) && !canManageEmployees()) {
    return <Navigate to={dashboardPath} replace />
  }
  if (isProjectsOnlyPath(location.pathname) && !canViewProjects()) {
    return <Navigate to={dashboardPath} replace />
  }
  if (isAddProjectPath(location.pathname) && !canAddProject()) {
    return <Navigate to={dashboardPath} replace />
  }
  if (isEditProjectPath(location.pathname) && !canEditProject()) {
    return <Navigate to={dashboardPath} replace />
  }
  if (isTasksListPath(location.pathname) && !hasFullAccess()) {
    return <Navigate to='/my-tasks' replace />
  }
  return children
}

export default RoleGuard
