/**
 * Sidebar navigation structure.
 * Items support: requiresFullAccess, requiresProjectAccess, employeeOnly (hidden from full-access-only sections when false - N/A)
 */
export const getSidebarNav = ({ fullAccess, canViewProjects, canManageClients, canManageEmployees, allowedSections, dashboardPath = '/dashboard', isTeamLeader = false }) => {
  const useSectionFilter = Array.isArray(allowedSections) && allowedSections.length > 0 && !fullAccess
  const isSectionAllowed = (section) => !useSectionFilter || allowedSections.includes(section.id)

  const filterItem = (item) => {
    if (item.requiresFullAccess && !fullAccess) return false
    if (item.requiresProjectAccess && !canViewProjects) return false
    if (item.requiresClientAccess && !canManageClients) return false
    if (item.requiresEmployeeAccess && !canManageEmployees) return false
    return true
  }

  const filterGroup = (group) => {
    if (group.requiresFullAccess && !fullAccess) return null
    const children = (group.children || []).filter(filterItem)
    if (!children.length) return null
    return { ...group, children }
  }

  const sections = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '🏠',
      type: 'link',
      path: dashboardPath,
    },
    ...(isTeamLeader
      ? [
          {
            id: 'my-team',
            label: 'My Team',
            icon: '👥',
            type: 'group',
            alwaysVisible: true,
            children: [
              { id: 'team-members', label: 'Team Members', path: '/my-team' },
              { id: 'team-leave', label: 'Leave', path: '/leave' },
            ],
          },
        ]
      : []),
    {
      id: 'crm',
      label: 'CRM',
      icon: '👥',
      type: 'group',
      children: [
        { id: 'leads', label: 'Leads', path: '/leads' },
        { id: 'contacts', label: 'Contacts', path: '/collaborators', requiresFullAccess: true },
        { id: 'companies', label: 'Companies', path: '/companies', requiresFullAccess: true },
        { id: 'quotations', label: 'Quotations', path: '/quotations', requiresFullAccess: true },
      ],
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: '📁',
      type: 'group',
      children: [
        { id: 'projects-list', label: 'Projects', path: '/projects', requiresProjectAccess: true },
        { id: 'tasks', label: 'Tasks', path: '/tasks', requiresFullAccess: true },
        { id: 'milestones', label: 'Milestones', path: '/module/milestones', requiresFullAccess: true },
        { id: 'timesheets', label: 'Timesheets', path: '/module/timesheets' },
      ],
    },
    {
      id: 'employees',
      label: 'Employees',
      icon: '👨',
      type: 'group',
      children: [
        { id: 'directory', label: 'Directory', path: '/employees', requiresEmployeeAccess: true },
        { id: 'attendance', label: 'Attendance', path: '/attendance' },
        { id: 'leave', label: 'Leave', path: '/leave' },
        { id: 'performance', label: 'Performance', path: '/module/performance', requiresFullAccess: true },
        { id: 'assets', label: 'Assets', path: '/module/assets', requiresFullAccess: true },
      ],
    },
    {
      id: 'finance',
      label: 'Finance',
      icon: '💰',
      type: 'group',
      requiresFullAccess: true,
      children: [
        { id: 'invoices', label: 'Invoices', path: '/billings' },
        { id: 'expenses', label: 'Expenses', path: '/expenses' },
        { id: 'payments', label: 'Revenue', path: '/revenue' },
        { id: 'payroll', label: 'Payroll', path: '/salaries' },
        { id: 'gst', label: 'GST / Taxes', path: '/module/gst' },
      ],
    },
    {
      id: 'inventory',
      label: 'Inventory',
      icon: '📦',
      type: 'group',
      requiresFullAccess: true,
      children: [
        { id: 'products', label: 'Products', path: '/module/products' },
        { id: 'stock', label: 'Stock', path: '/module/stock' },
        { id: 'purchase-orders', label: 'Purchase Orders', path: '/module/purchase-orders' },
        { id: 'suppliers', label: 'Suppliers', path: '/module/suppliers' },
      ],
    },
    {
      id: 'sales',
      label: 'Sales',
      icon: '🛒',
      type: 'group',
      children: [
        { id: 'orders', label: 'Orders', path: '/module/orders', requiresFullAccess: true },
        { id: 'customers', label: 'Customers', path: '/clients', requiresClientAccess: true },
        { id: 'pipeline', label: 'Sales Pipeline', path: '/lead-management' },
      ],
    },
    {
      id: 'marketing',
      label: 'Marketing',
      icon: '📢',
      type: 'group',
      children: [
        { id: 'campaigns', label: 'Campaigns', path: '/campaigns', requiresFullAccess: true },
        { id: 'email', label: 'Email', path: '/module/email', requiresFullAccess: true },
        { id: 'sms', label: 'SMS', path: '/module/sms', requiresFullAccess: true },
        { id: 'whatsapp', label: 'WhatsApp', path: '/module/whatsapp', requiresFullAccess: true },
        { id: 'social', label: 'Social Media', path: '/social-calendar' },
      ],
    },
    {
      id: 'documents',
      label: 'Documents',
      icon: '📄',
      type: 'group',
      requiresFullAccess: true,
      children: [
        { id: 'files', label: 'Files', path: '/files' },
        { id: 'contracts', label: 'Contracts', path: '/contracts' },
        { id: 'policies', label: 'Policies', path: '/policies' },
      ],
    },
    {
      id: 'company',
      label: 'Company',
      icon: '🏢',
      type: 'group',
      requiresFullAccess: true,
      children: [
        { id: 'company-profile', label: 'Company Profile', path: '/company-profile' },
      ],
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      icon: '📊',
      type: 'link',
      path: '/reports',
      requiresFullAccess: true,
    },
    {
      id: 'communication',
      label: 'Communication',
      icon: '💬',
      type: 'group',
      children: [
        { id: 'chat', label: 'Chat', path: '/module/chat' },
        { id: 'announcements', label: 'Announcements', path: '/module/announcements' },
      ],
    },
    {
      id: 'administration',
      label: 'Administration',
      icon: '⚙',
      type: 'group',
      requiresFullAccess: true,
      children: [
        { id: 'users', label: 'Users', path: '/employees' },
        { id: 'departments', label: 'Departments', path: '/module/departments' },
        { id: 'designations', label: 'Designations', path: '/module/designations' },
        { id: 'settings', label: 'Settings', path: '/settings' },
      ],
    },
    {
      id: 'workspace',
      label: 'My Workspace',
      icon: '👤',
      type: 'group',
      children: [
        { id: 'my-profile', label: 'My Profile', path: '/my-profile' },
        { id: 'salary-slips', label: 'Salary Slips', path: '/salary-slips' },
        { id: 'my-tasks', label: 'My Tasks', path: '/my-tasks' },
        { id: 'my-calendar', label: 'My Calendar', path: '/calendar' },
        { id: 'my-leaves', label: 'My Leaves', path: '/leave' },
        { id: 'my-attendance', label: 'My Attendance', path: '/attendance' },
        { id: 'my-projects', label: 'My Projects', path: '/my-projects' },
      ],
    },
  ]

  return sections
    .map((section) => {
      if (isTeamLeader && section.id === 'employees') return null
      if (section.type === 'link') {
        if (section.requiresFullAccess && !fullAccess) return null
        if (!section.alwaysVisible && !isSectionAllowed(section)) return null
        return section
      }
      const filtered = filterGroup(section)
      if (!filtered) return null
      if (!section.alwaysVisible && !isSectionAllowed(filtered)) return null
      return filtered
    })
    .filter(Boolean)
}
