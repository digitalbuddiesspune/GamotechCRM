import { SIDEBAR_PARENT_SECTIONS } from './sidebarParentSections'

const ALL_SECTION_IDS = SIDEBAR_PARENT_SECTIONS.map((section) => section.id)
const EMPTY_SECTION_IDS = []

export const getDesignationTitle = (user) =>
  (user?.designation?.title || user?.designation?.name || '').toLowerCase()

const MANAGER_ADD_PROJECT_DENY = new Set(['engineering manager', 'social media manager'])

/** Manager / operations roles (excludes HR). Mirrors dashboardRoutes manager detection. */
export const isOperationalManagerUser = (user) => {
  if (!user || isAdminUser(user)) return false
  const accessRole = String(user?.designation?.accessRole || '').toLowerCase()
  const title = getDesignationTitle(user)
  if (title === 'hr manager' || accessRole === 'hr') return false
  if (accessRole === 'manager') return true
  if (title === 'manager') return true
  if (title.includes('manager')) return true
  if (title.includes('operations')) return true
  return false
}

export const isTeamLeaderUser = (user) => {
  if (!user || isAdminUser(user)) return false
  const accessRole = String(user?.designation?.accessRole || '').toLowerCase()
  const title = getDesignationTitle(user)
  if (accessRole === 'team_leader') return true
  if (title === 'team leader' || title === 'team lead') return true
  if (title.includes('team leader') || title.includes('team lead')) return true
  return false
}

/** Manager, team leader, or operations head — operational people management. */
export const isPeopleManagerUser = (user) =>
  isOperationalManagerUser(user) || isTeamLeaderUser(user)

export const isAdminUser = (user) => {
  const title = getDesignationTitle(user)
  const accessRole = String(user?.designation?.accessRole || '').toLowerCase()
  return title === 'admin' || accessRole === 'admin'
}

export const getDesignationPermission = (user, key) => {
  if (isAdminUser(user)) return true
  const val = user?.designation?.permissions?.[key]
  return typeof val === 'boolean' ? val : null
}

export const hasFullAccessForUser = (user) => {
  if (isAdminUser(user)) return true
  const fromDesignation = user?.designation?.permissions?.hasFullAccess
  if (typeof fromDesignation === 'boolean') return fromDesignation
  const title = getDesignationTitle(user)
  return ['admin', 'hr manager', 'technical lead'].includes(title)
}

export const canViewProjectsForUser = (user) => {
  if (isAdminUser(user)) return true
  const fromDesignation = user?.designation?.permissions?.canViewProjects
  if (typeof fromDesignation === 'boolean') return fromDesignation
  if (isPeopleManagerUser(user)) return true
  const title = getDesignationTitle(user)
  return [
    'admin',
    'hr manager',
    'technical lead',
    'social media manager',
    'product manager',
    'senior software engineer',
    'project manager',
    'engineering manager',
  ].includes(title)
}

export const canAddProjectForUser = (user) => {
  if (isAdminUser(user)) return true
  const fromDesignation = getDesignationPermission(user, 'canAddProject')
  if (fromDesignation === true) return true

  const title = getDesignationTitle(user)
  if (MANAGER_ADD_PROJECT_DENY.has(title)) return false
  if (isPeopleManagerUser(user)) return true

  if (fromDesignation === false) return false
  return [
    'admin',
    'hr manager',
    'technical lead',
    'senior software engineer',
    'product manager',
    'project manager',
  ].includes(title)
}

export const canEditProjectForUser = (user) => {
  if (isAdminUser(user)) return true
  const fromDesignation = getDesignationPermission(user, 'canEditProject')
  if (fromDesignation === true) return true
  if (canAddProjectForUser(user)) return true
  if (isPeopleManagerUser(user)) return true
  const title = getDesignationTitle(user)
  return ['engineering manager', 'project manager'].includes(title)
}

/** Managers who can create projects can also add clients needed for those projects. */
export const canManageClientsForUser = (user) => {
  if (isAdminUser(user)) return true
  if (hasFullAccessForUser(user)) return true
  return canAddProjectForUser(user)
}

/** Any logged-in employee can assign tasks to other employees. */
export const canAssignTaskForUser = (user) => Boolean(user?._id)

/** Rating stays limited to admins / designations with assign permission historically. */
export const canRateTaskForUser = (user) => {
  if (isAdminUser(user)) return true
  const fromDesignation = getDesignationPermission(user, 'canAssignTask')
  if (fromDesignation !== null) return fromDesignation
  const title = getDesignationTitle(user)
  return [
    'admin',
    'social media manager',
    'hr manager',
    'technical lead',
    'product manager',
    'senior software engineer',
    'project manager',
    'engineering manager',
  ].includes(title)
}

export const canApproveLeaveForUser = (user) => {
  if (isAdminUser(user)) return true
  const accessRole = String(user?.designation?.accessRole || '').toLowerCase()
  const title = getDesignationTitle(user)
  if (['team_leader', 'manager', 'hr'].includes(accessRole)) return true
  if (title.includes('team lead') || title.includes('manager')) return true
  const fromDesignation = getDesignationPermission(user, 'canApproveLeave')
  if (fromDesignation !== null) return fromDesignation
  return [
    'admin',
    'hr manager',
    'project manager',
    'technical lead',
    'engineering manager',
    'product manager',
    'senior software engineer',
  ].includes(title)
}

export const canManageEmployeesForUser = (user) => {
  if (isAdminUser(user)) return true
  const fromDesignation = getDesignationPermission(user, 'canManageEmployees')
  if (fromDesignation === true) return true
  if (isPeopleManagerUser(user)) return true
  if (fromDesignation === false) return false
  const title = getDesignationTitle(user)
  return ['admin', 'hr manager'].includes(title)
}

/** Admin, Sales Manager, or Sales Team Lead — upload/distribute leads & view all. */
export const canManageLeadsForUser = (user) => {
  if (!user) return false
  if (isAdminUser(user)) return true

  const accessRole = String(user?.designation?.accessRole || '').toLowerCase().trim()
  const title = getDesignationTitle(user)
  const department = String(user?.department || user?.designation?.department || '')
  const inSales = /sales/i.test(department)

  // Title can identify sales roles even if department field is empty
  if (title.includes('sales manager')) return true
  if (
    title.includes('sales team lead') ||
    (inSales && (title.includes('team leader') || title.includes('team lead')))
  ) {
    return true
  }

  const isSalesManager = inSales && (accessRole === 'manager' || title.includes('manager'))
  const isSalesTeamLead = inSales && accessRole === 'team_leader'

  return Boolean(isSalesManager || isSalesTeamLead)
}

export const getSidebarSectionsForUser = (user) => {
  if (isAdminUser(user)) return ALL_SECTION_IDS
  const sections = user?.access?.sidebarSections
  return sections?.length ? sections : EMPTY_SECTION_IDS
}
