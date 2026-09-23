export const CUSTOM_DEPARTMENTS_STORAGE_KEY = 'crm_custom_departments'

export const normalizeDepartment = (value) => String(value || '').trim()

export const readCustomDepartments = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(CUSTOM_DEPARTMENTS_STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored.map(normalizeDepartment).filter(Boolean) : []
  } catch {
    return []
  }
}

export const buildDepartmentOptions = ({
  employees = [],
  designations = [],
  customDepartments = [],
} = {}) => {
  const fromEmployees = employees.map((e) => normalizeDepartment(e.department))
  const fromDesignations = designations.map((d) => normalizeDepartment(d.department))
  const merged = [...fromEmployees, ...fromDesignations, ...customDepartments].filter(Boolean)
  return [...new Set(merged)].sort((a, b) => a.localeCompare(b))
}
