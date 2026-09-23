/** Company-wise Employee ID prefixes */
export const COMPANY_PREFIXES = {
  gamotechSolution: 'GTS',
};

export const EMPLOYEE_CODE_PREFIX = 'EMP';
const EMPLOYEE_SEQUENCE_MIN_DIGITS = 3;

export const COMPANY_KEYS = [
  'gamotechSolution',
];

export function getCompanyPrefix(companyKey) {
  if (!companyKey) return 'EMP';
  return COMPANY_PREFIXES[companyKey] || 'EMP';
}

export const buildEmployeeCode = (companyKey, sequence) => {
  const prefix = getCompanyPrefix(companyKey);
  return `${prefix}${String(sequence).padStart(EMPLOYEE_SEQUENCE_MIN_DIGITS, '0')}`;
};

export const employeeCodePattern = (companyKey) => {
  if (companyKey && COMPANY_PREFIXES[companyKey]) {
    const prefix = COMPANY_PREFIXES[companyKey];
    return new RegExp(`^${prefix}\\d{${EMPLOYEE_SEQUENCE_MIN_DIGITS},}$`, 'i');
  }
  const allPrefixes = Object.values(COMPANY_PREFIXES).concat('EMP').join('|');
  return new RegExp(`^(?:${allPrefixes})\\d{${EMPLOYEE_SEQUENCE_MIN_DIGITS},}$`, 'i');
};

export const isValidEmployeeCodeForCompany = (code, companyKey) => {
  if (!code || typeof code !== 'string') return false;
  return employeeCodePattern(companyKey).test(code.trim());
};

export const parseEmployeeCodeSequence = (code, companyKey) => {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  const prefixes = companyKey && COMPANY_PREFIXES[companyKey]
    ? [COMPANY_PREFIXES[companyKey]]
    : Object.values(COMPANY_PREFIXES).concat('EMP');

  let matchedPrefix = null;
  for (const p of prefixes) {
    if (normalized.startsWith(p)) {
      matchedPrefix = p;
      break;
    }
  }

  if (!matchedPrefix || normalized.length < matchedPrefix.length + EMPLOYEE_SEQUENCE_MIN_DIGITS) {
    return null;
  }
  const seq = parseInt(normalized.slice(matchedPrefix.length), 10);
  return Number.isNaN(seq) ? null : seq;
};

export async function getMaxEmployeeCodeSequence(Employee, companyKey) {
  const pattern = employeeCodePattern(companyKey);
  const employees = await Employee.find({ employeeCode: pattern }).select('employeeCode').lean();
  let maxSeq = 0;
  for (const emp of employees) {
    const seq = parseEmployeeCodeSequence(emp.employeeCode, companyKey);
    if (seq != null && seq > maxSeq) maxSeq = seq;
  }
  return maxSeq;
}

export async function generateNextEmployeeCode(Employee, companyKey) {
  const maxSeq = await getMaxEmployeeCodeSequence(Employee, companyKey);
  return buildEmployeeCode(companyKey, maxSeq + 1);
}

const formatCodeError = (companyKey) => {
  const prefix = getCompanyPrefix(companyKey);
  return `Employee ID must match format ${prefix}001 or higher (e.g. ${prefix}001, ${prefix}002)`;
};

export async function assignEmployeeCodeOnCreate(Employee, companyKey, payload) {
  const trimmed = (payload.employeeCode || '').trim().toUpperCase();
  if (trimmed) {
    if (!isValidEmployeeCodeForCompany(trimmed, companyKey)) {
      const err = new Error(formatCodeError(companyKey));
      err.status = 400;
      throw err;
    }
    const exists = await Employee.findOne({ employeeCode: trimmed });
    if (exists) {
      const err = new Error('Employee ID already in use');
      err.status = 400;
      throw err;
    }
    payload.employeeCode = trimmed;
    return payload;
  }

  payload.employeeCode = await generateNextEmployeeCode(Employee, companyKey);
  return payload;
}

export async function validateEmployeeCodeOnUpdate(Employee, companyKey, employeeId, payload) {
  const raw = payload.employeeCode;
  if (raw == null || String(raw).trim() === '') {
    delete payload.employeeCode;
    return payload;
  }

  const trimmed = String(raw).trim().toUpperCase();
  if (!isValidEmployeeCodeForCompany(trimmed, companyKey)) {
    const err = new Error(formatCodeError(companyKey));
    err.status = 400;
    throw err;
  }

  const exists = await Employee.findOne({
    employeeCode: trimmed,
    _id: { $ne: employeeId },
  });
  if (exists) {
    const err = new Error('Employee ID already in use');
    err.status = 400;
    throw err;
  }

  payload.employeeCode = trimmed;
  return payload;
}

/** Renumber all employees company-wise to GTS001, GTS002... (oldest first). */
export async function backfillEmployeeCodes(Employee, companyKey) {
  const employees = await Employee.find().sort({ createdAt: 1, _id: 1 });
  let updated = 0;

  for (let index = 0; index < employees.length; index += 1) {
    const emp = employees[index];
    const nextCode = buildEmployeeCode(companyKey, index + 1);
    if (emp.employeeCode !== nextCode) {
      emp.employeeCode = nextCode;
      await emp.save();
      updated += 1;
    }
  }

  return updated;
}

