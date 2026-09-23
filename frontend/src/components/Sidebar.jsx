import React, { useEffect, useMemo, useRef, useState } from 'react'
import Logo from '../assets/gamotech-Photoroom.png'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../api/axios'
import { getSidebarNav } from '../config/sidebarNav'
import { getDashboardKind } from '../config/dashboardRoutes'
import { SidebarSectionIcon } from '../config/sidebarIcons'
import { SettingsIcon, LogoutIcon } from './Icons'
import {
  enableTaskAssignmentAlerts,
  initTaskAssignmentAudio,
  notifyNewTaskAssigned,
} from '../utils/taskAssignmentAlert'
import {
  connectRealtimeSocket,
  getTenantId,
  onTaskChanged,
} from '../utils/realtimeSocket'

const MenuToggleIcon = () => (
  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={1.5} stroke='currentColor' className='size-6'>
    <path strokeLinecap='round' strokeLinejoin='round' d='M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5' />
  </svg>
)

const ChevronIcon = ({ open }) => (
  <svg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' strokeWidth={2} stroke='currentColor' className={`size-4 transition-transform ${open ? 'rotate-90' : ''}`}>
    <path strokeLinecap='round' strokeLinejoin='round' d='m8.25 4.5 7.5 7.5-7.5 7.5' />
  </svg>
)

const isPathActive = (pathname, path) => {
  if (pathname === path) return true
  if (path !== '/' && pathname.startsWith(`${path}/`)) return true
  return false
}

const Sidebar = ({ isOpen = true, onToggle }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, hasFullAccess, canViewProjects, canManageClients, canManageEmployees, getSidebarSections, getDashboardPath } = useAuth()
  const fullAccess = hasFullAccess()
  const canViewProjectsValue = canViewProjects()
  const canManageClientsValue = canManageClients()
  const canManageEmployeesValue = canManageEmployees()
  const allowedSections = getSidebarSections()
  const dashboardPath = getDashboardPath()
  const isTeamLeader = getDashboardKind(user) === 'team_leader'

  const sections = useMemo(
    () => getSidebarNav({
      fullAccess,
      canViewProjects: canViewProjectsValue,
      canManageClients: canManageClientsValue,
      canManageEmployees: canManageEmployeesValue,
      allowedSections,
      dashboardPath,
      isTeamLeader,
    }),
    [fullAccess, canViewProjectsValue, canManageClientsValue, canManageEmployeesValue, allowedSections, dashboardPath, isTeamLeader]
  )

  const defaultExpanded = useMemo(() => {
    const activeGroup = sections.find(
      (s) => s.type === 'group' && s.children.some((c) => isPathActive(location.pathname, c.path))
    )
    if (activeGroup) return { [activeGroup.id]: true }
    return fullAccess ? { crm: true } : { workspace: true }
  }, [sections, location.pathname, fullAccess])

  const [expanded, setExpanded] = useState(defaultExpanded)
  const [pendingMyTasksCount, setPendingMyTasksCount] = useState(0)
  const [alertsEnabled, setAlertsEnabled] = useState(false)
  const alertsEnabledRef = useRef(false)
  const navigateRef = useRef(navigate)

  useEffect(() => {
    alertsEnabledRef.current = alertsEnabled
  }, [alertsEnabled])

  useEffect(() => {
    navigateRef.current = navigate
  }, [navigate])

  useEffect(() => {
    initTaskAssignmentAudio()
  }, [])

  useEffect(() => {
    const activeGroup = sections.find(
      (s) => s.type === 'group' && s.children.some((c) => isPathActive(location.pathname, c.path))
    )
    if (!activeGroup) return
    setExpanded((prev) => {
      if (prev[activeGroup.id] && Object.keys(prev).length === 1) return prev
      return { [activeGroup.id]: true }
    })
  }, [location.pathname, sections])

  useEffect(() => {
    const unlockAlerts = () => {
      setAlertsEnabled(true)
      enableTaskAssignmentAlerts()
    }
    window.addEventListener('click', unlockAlerts, { once: true })
    window.addEventListener('keydown', unlockAlerts, { once: true })
    return () => {
      window.removeEventListener('click', unlockAlerts)
      window.removeEventListener('keydown', unlockAlerts)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    let previousPendingCount = null
    let inFlight = false
    let refreshTimer = null

    const fetchPendingMyTasks = async ({ playAlert = false } = {}) => {
      if (!user?._id) {
        if (!cancelled) setPendingMyTasksCount(0)
        return
      }
      if (inFlight) return
      inFlight = true
      try {
        const res = await api.get('/tasks', { params: { employeeId: user._id } })
        const list = Array.isArray(res.data) ? res.data : []
        const pendingCount = list.filter((task) => String(task?.status || '').trim() === 'Pending').length
        if (
          playAlert &&
          alertsEnabledRef.current &&
          previousPendingCount !== null &&
          pendingCount > previousPendingCount
        ) {
          notifyNewTaskAssigned({
            pendingCount,
            navigate: navigateRef.current,
          })
        }
        previousPendingCount = pendingCount
        if (!cancelled) setPendingMyTasksCount(pendingCount)
      } catch {
        if (!cancelled) setPendingMyTasksCount(0)
      } finally {
        inFlight = false
      }
    }

    const scheduleRefresh = (opts) => {
      if (refreshTimer) window.clearTimeout(refreshTimer)
      refreshTimer = window.setTimeout(() => {
        fetchPendingMyTasks(opts)
      }, 150)
    }

    // Initial badge load only — further updates come from Socket.IO.
    fetchPendingMyTasks()
    connectRealtimeSocket(user._id, { tenantId: getTenantId() })
    const unsubscribe = onTaskChanged((payload) => {
      const reason = String(payload?.reason || '')
      scheduleRefresh({ playAlert: reason === 'assigned' })
    })

    const handleFocus = () => {
      // One catch-up fetch if the tab was away (missed socket while sleeping).
      if (!document.hidden) fetchPendingMyTasks()
    }
    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      if (refreshTimer) window.clearTimeout(refreshTimer)
      unsubscribe()
      window.removeEventListener('focus', handleFocus)
    }
  }, [user?._id])

  const toggleSection = (id) => {
    setExpanded((prev) => (prev[id] ? {} : { [id]: true }))
  }

  const renderChild = (child, pl = 'pl-9') => {
    const active = isPathActive(location.pathname, child.path)
    return (
      <button
        key={child.id}
        type='button'
        onClick={() => navigate(child.path)}
        className={`w-full flex items-center gap-2 py-2 rounded-lg text-sm transition-colors ${
          active
            ? 'bg-[#2563EB] text-[#E5E7EB] hover:bg-[#3B82F6]'
            : 'text-[#94A3B8] hover:bg-[#111827] hover:text-[#E5E7EB]'
        } ${isOpen ? `${pl} pr-3` : 'px-3 justify-center'}`}
        title={!isOpen ? child.label : undefined}
      >
        {isOpen ? (
          <>
            <span className='text-[#94A3B8]'>•</span>
            <span className='truncate flex-1 text-left'>{child.label}</span>
            {child.id === 'my-tasks' && pendingMyTasksCount > 0 && (
              <span className='ml-auto inline-flex min-w-5 h-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white'>
                {pendingMyTasksCount > 99 ? '99+' : pendingMyTasksCount}
              </span>
            )}
          </>
        ) : (
          <span className='w-1.5 h-1.5 rounded-full bg-[#94A3B8]' />
        )}
      </button>
    )
  }

  return (
    <aside className={`bg-[#0F172A] text-[#E5E7EB] text-sm h-screen flex flex-col shadow-2xl border-r border-[#1E293B] transition-all duration-200 flex-shrink-0 ${isOpen ? 'w-64' : 'w-16'}`}>
      <div className='px-3 py-4 border-b border-[#1E293B] flex items-center justify-center shrink-0'>
        {isOpen ? (
          <div className='w-full flex items-center justify-between px-2'>
            <button
              type='button'
              onClick={() => navigate(dashboardPath)}
              className='flex cursor-pointer items-center gap-3 min-w-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]'
              title='Dashboard'
            >
              <div className='h-10 max-w-[140px] rounded-lg flex-shrink-0 overflow-hidden'>
                <img src={Logo} alt='CRM' className='h-full w-auto object-contain' />
              </div>
            </button>
            <button type='button' onClick={onToggle} className='p-2 rounded-lg hover:bg-[#111827] text-[#94A3B8] hover:text-[#E5E7EB] transition-colors flex-shrink-0' title='Collapse menu'>
              <MenuToggleIcon />
            </button>
          </div>
        ) : (
          <button type='button' onClick={onToggle} className='p-2 rounded-lg hover:bg-[#111827] text-[#94A3B8] hover:text-[#E5E7EB] transition-colors' title='Expand menu'>
            <MenuToggleIcon />
          </button>
        )}
      </div>

      <nav className={`sidebar-scrollbar-desktop-hide flex-1 py-3 overflow-y-auto overflow-x-hidden ${isOpen ? 'px-3' : 'px-2'}`}>
        <div className='space-y-1'>
          {sections.map((section) => {
            if (section.type === 'link') {
              const active = isPathActive(location.pathname, section.path)
              return (
                <button
                  key={section.id}
                  type='button'
                  onClick={() => navigate(section.path)}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-lg transition-colors ${
                    active
                      ? 'bg-[#2563EB] text-[#E5E7EB] hover:bg-[#3B82F6]'
                      : 'text-[#E5E7EB] hover:bg-[#111827]'
                  } ${isOpen ? 'px-3' : 'px-2 justify-center'}`}
                  title={!isOpen ? section.label : undefined}
                >
                  <SidebarSectionIcon id={section.id} className='size-5 shrink-0' />
                  {isOpen && <span className='text-sm font-medium truncate'>{section.label}</span>}
                </button>
              )
            }

            const isExpanded = expanded[section.id]
            const groupActive = section.children.some((c) => isPathActive(location.pathname, c.path))

            return (
              <div key={section.id} className='pt-1'>
                <button
                  type='button'
                  onClick={() => (isOpen ? toggleSection(section.id) : navigate(section.children[0]?.path))}
                  className={`w-full flex items-center gap-3 py-2.5 rounded-lg transition-colors ${
                    groupActive ? 'text-[#E5E7EB]' : 'text-[#94A3B8] hover:bg-[#111827] hover:text-[#E5E7EB]'
                  } ${isOpen ? 'px-3' : 'px-2 justify-center'}`}
                  title={!isOpen ? section.label : undefined}
                >
                  <SidebarSectionIcon id={section.id} className='size-5 shrink-0' />
                  {isOpen && (
                    <>
                      <span className='text-sm font-medium truncate flex-1 text-left'>{section.label}</span>
                      <ChevronIcon open={isExpanded} />
                    </>
                  )}
                </button>
                {isOpen && isExpanded && (
                  <div className='mt-0.5 mb-1 space-y-0.5'>
                    {section.children.map((child) => renderChild(child))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      <div className={`border-t border-[#1E293B] py-3 shrink-0 ${isOpen ? 'px-3' : 'px-2'}`}>
        {isOpen && user?.name && (
          <div className='px-3 py-2 mb-2 rounded-lg bg-[#111827]'>
            <p className='text-xs font-semibold text-[#E5E7EB] truncate'>{user.name}</p>
            <p className='text-[10px] text-[#94A3B8] truncate'>{user.designation?.title || 'Employee'}</p>
          </div>
        )}
        <div className='space-y-1'>
          <button
            type='button'
            onClick={() => navigate('/settings')}
            className={`w-full flex items-center gap-3 py-2.5 rounded-lg transition-colors ${
              location.pathname === '/settings'
                ? 'bg-[#2563EB] text-[#E5E7EB] hover:bg-[#3B82F6]'
                : 'text-[#E5E7EB] hover:bg-[#111827]'
            } ${isOpen ? 'px-3' : 'px-2 justify-center'}`}
            title={!isOpen ? 'Settings' : undefined}
          >
            <span className='text-lg'><SettingsIcon /></span>
            {isOpen && <span className='font-medium'>Settings</span>}
          </button>
          <button
            type='button'
            onClick={() => { logout(); navigate('/login') }}
            className={`w-full flex items-center gap-3 py-2.5 text-[#94A3B8] hover:bg-red-900/40 hover:text-red-200 rounded-lg transition-colors ${isOpen ? 'px-3' : 'px-2 justify-center'}`}
            title={!isOpen ? 'Logout' : undefined}
          >
            <span className='text-lg'><LogoutIcon /></span>
            {isOpen && <span className='font-medium'>Logout</span>}
          </button>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
