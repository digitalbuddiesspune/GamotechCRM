const EMPLOYEE_CODE_PREFIX = 'GTS'
const EMPLOYEE_SEQUENCE_MIN_DIGITS = 3

export const getEmployeeCodePrefix = () => EMPLOYEE_CODE_PREFIX

export const buildEmployeeCode = (sequence) =>
  `${EMPLOYEE_CODE_PREFIX}${String(sequence).padStart(EMPLOYEE_SEQUENCE_MIN_DIGITS, '0')}`

export const employeeCodePattern = () =>
  new RegExp(`^${EMPLOYEE_CODE_PREFIX}\\d{${EMPLOYEE_SEQUENCE_MIN_DIGITS},}$`, 'i')

export const isValidEmployeeCode = (code) => {
  const trimmed = String(code || '').trim()
  return trimmed ? employeeCodePattern().test(trimmed) : true
}

export const parseEmployeeCodeSequence = (code) => {
  const normalized = String(code || '').trim().toUpperCase()
  if (
    !normalized.startsWith(EMPLOYEE_CODE_PREFIX)
    || normalized.length < EMPLOYEE_CODE_PREFIX.length + EMPLOYEE_SEQUENCE_MIN_DIGITS
  ) return null
  const seq = parseInt(normalized.slice(EMPLOYEE_CODE_PREFIX.length), 10)
  return Number.isNaN(seq) ? null : seq
}

export const getMaxEmployeeCodeSequence = (employees = []) => {
  const pattern = employeeCodePattern()
  let maxSeq = 0
  for (const emp of employees) {
    const code = String(emp?.employeeCode || '').trim().toUpperCase()
    if (!code || !pattern.test(code)) continue
    const seq = parseEmployeeCodeSequence(code)
    if (seq != null && seq > maxSeq) maxSeq = seq
  }
  return maxSeq
}

export const getNextEmployeeCode = (employees = []) =>
  buildEmployeeCode(getMaxEmployeeCodeSequence(employees) + 1)

export const getEmployeeCodePlaceholder = () =>
  `Auto-assigned (e.g. ${buildEmployeeCode(1)}, ${buildEmployeeCode(2)}, ${buildEmployeeCode(3)})`

export const getEmployeeCodeFormatHint = () =>
  'Format: GTS001 or higher (minimum 3-digit sequence).'

