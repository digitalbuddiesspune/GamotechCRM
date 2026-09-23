/** Parent-level sidebar sections assignable per employee (matches sidebarNav section ids). */
export const SIDEBAR_PARENT_SECTIONS = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠', alwaysOn: true },
  { id: 'crm', label: 'CRM', icon: '👥' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'employees', label: 'Employees', icon: '👨' },
  { id: 'finance', label: 'Finance', icon: '💰' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'sales', label: 'Sales', icon: '🛒' },
  { id: 'marketing', label: 'Marketing', icon: '📢' },
  { id: 'documents', label: 'Documents', icon: '📄' },
  { id: 'reports', label: 'Reports & Analytics', icon: '📊' },
  { id: 'communication', label: 'Communication', icon: '💬' },
  { id: 'company', label: 'Company', icon: '🏢' },
  { id: 'administration', label: 'Administration', icon: '⚙' },
  { id: 'workspace', label: 'My Workspace', icon: '👤', alwaysOn: true },
]

export const DEFAULT_SIDEBAR_SECTIONS = [
  'dashboard',
  'workspace',
  'crm',
  'projects',
  'employees',
]

export const isAlwaysOnSidebarSection = (id) =>
  SIDEBAR_PARENT_SECTIONS.some((section) => section.id === id && section.alwaysOn)
