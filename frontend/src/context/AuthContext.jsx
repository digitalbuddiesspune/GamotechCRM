import React, { createContext, useContext, useState, useEffect } from 'react'
import api from '../api/axios'
import { getDashboardPathForUser } from '../config/dashboardRoutes'
import { disconnectRealtimeSocket } from '../utils/realtimeSocket'
import {
  canAddProjectForUser,
  canEditProjectForUser,
  canAssignTaskForUser,
  canRateTaskForUser,
  hasFullAccessForUser,
  canViewProjectsForUser,
  canApproveLeaveForUser,
  canManageEmployeesForUser,
  canManageLeadsForUser,
  canManageClientsForUser,
  getSidebarSectionsForUser,
  isAdminUser,
  getDesignationTitle as getUserDesignationTitle,
} from '../config/authPermissions'

const AUTH_KEY = 'crm_user'

const normalizeStoredUser = (user) => {
  if (!user || !isAdminUser(user)) return user
  return {
    ...user,
    designation: {
      ...user.designation,
      accessRole: 'admin',
      permissions: {
        hasFullAccess: true,
        canAddProject: true,
        canEditProject: true,
        canViewProjects: true,
        canAssignTask: true,
        canApproveLeave: true,
        canManageEmployees: true,
        canManageSocialCalendar: true,
        ...(user.designation?.permissions || {}),
      },
    },
    access: {
      ...(user.access || {}),
      sidebarSections: getSidebarSectionsForUser(user),
    },
  }
}

const AuthContext = createContext(null)

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(AUTH_KEY)
    if (stored) {
      try {
        const parsed = normalizeStoredUser(JSON.parse(stored))
        setUser(parsed)
        localStorage.setItem(AUTH_KEY, JSON.stringify(parsed))
      } catch {
        localStorage.removeItem(AUTH_KEY)
      }
    }
    setLoading(false)
  }, [])

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password })
    const u = normalizeStoredUser(res.data?.user)
    if (u) {
      setUser(u)
      localStorage.setItem(AUTH_KEY, JSON.stringify(u))
      return u
    }
    throw new Error(res.data?.message || 'Login failed')
  }

  const logout = () => {
    disconnectRealtimeSocket()
    setUser(null)
    localStorage.removeItem(AUTH_KEY)
  }

  const updateUser = (patch) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = normalizeStoredUser({ ...prev, ...patch })
      localStorage.setItem(AUTH_KEY, JSON.stringify(next))
      return next
    })
  }

  const getDesignationTitle = () => getUserDesignationTitle(user)

  const isAdmin = () => isAdminUser(user)

  const isHRManager = () => {
    if (isAdminUser(user)) return true
    const title = getDesignationTitle()
    return title === 'hr manager'
  }

  const hasFullAccess = () => hasFullAccessForUser(user)

  const canAddProject = () => canAddProjectForUser(user)

  const canEditProject = () => canEditProjectForUser(user)

  const canManageSocialCalendar = () => isAdminUser(user) || Boolean(user)

  const canViewProjects = () => canViewProjectsForUser(user)

  const canAssignTask = () => canAssignTaskForUser(user)

  const canRateTask = () => canRateTaskForUser(user)

  const canApproveLeave = () => canApproveLeaveForUser(user)

  const canManageEmployees = () => canManageEmployeesForUser(user)

  const canManageClients = () => canManageClientsForUser(user)

  const canManageLeads = () => canManageLeadsForUser(user)

  const getSidebarSections = () => getSidebarSectionsForUser(user)

  const getDashboardPath = () => getDashboardPathForUser(user)

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        updateUser,
        isHRManager,
        hasFullAccess,
        canAddProject,
        canEditProject,
        canManageSocialCalendar,
        canViewProjects,
        canAssignTask,
        canRateTask,
        canApproveLeave,
        canManageEmployees,
        canManageClients,
        canManageLeads,
        getSidebarSections,
        getDashboardPath,
        isAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
