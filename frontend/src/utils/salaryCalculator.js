const toNum = (value, fallback = 0) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

const roundRupee = (value) => Math.round(toNum(value, 0))

const hasExplicit = (value) =>
  value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))

const mapLines = (raw) => {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const lines = raw
    .map((item) => ({
      code: String(item?.code || ''),
      name: String(item?.name || ''),
      amount: toNum(item?.amount, 0),
    }))
    .filter((item) => item.code || item.name)
  return lines.length ? lines : null
}

const pick = (lines, code) => (lines || []).find((item) => item.code === code)?.amount

const sourceFrom = (data = {}) => {
  const payroll = data.salaryPayroll && typeof data.salaryPayroll === 'object' ? data.salaryPayroll : {}
  return { ...payroll, ...data }
}

export const calculateSalaryStructure = (data = {}) => {
  const src = sourceFrom(data)
  const monthlyCtcInput = roundRupee(
    src.monthlyCTC ?? src.ctc ?? src.amount ?? src.salary ?? src.grossSalary ?? 0
  )

  let components = mapLines(src.components)
  let employerContributions = mapLines(src.employerContributions)
  let deductions = mapLines(src.deductions) || mapLines(src.deductionsList)

  if (!components) {
    const ctc = Math.max(0, monthlyCtcInput)
    const basic = hasExplicit(src.basicSalary) ? roundRupee(src.basicSalary) : roundRupee(ctc * 0.4)
    const da = hasExplicit(src.da) ? roundRupee(src.da) : roundRupee(ctc * 0.1)
    const hra = hasExplicit(src.hra) ? roundRupee(src.hra) : roundRupee(ctc * 0.2)
    const conveyance = hasExplicit(src.conveyance) ? roundRupee(src.conveyance) : roundRupee(ctc * 0.05)
    const medical = hasExplicit(src.medicalAllowance ?? src.medical)
      ? roundRupee(src.medicalAllowance ?? src.medical)
      : roundRupee(ctc * 0.05)
    const employerPf = hasExplicit(src.employerPf ?? src.employerPfAmount)
      ? roundRupee(src.employerPf ?? src.employerPfAmount)
      : Math.min(1800, roundRupee(basic * 0.12))
    const special = hasExplicit(src.specialAllowance)
      ? roundRupee(src.specialAllowance)
      : Math.max(0, ctc - basic - da - hra - conveyance - medical - employerPf)

    components = [
      { code: 'BASIC', name: 'Basic Salary', amount: basic },
      { code: 'DA', name: 'Dearness Allowance', amount: da },
      { code: 'HRA', name: 'House Rent Allowance', amount: hra },
      { code: 'CONVEYANCE', name: 'Conveyance Allowance', amount: conveyance },
      { code: 'SPECIAL', name: 'Special Allowance', amount: special },
      { code: 'MEDICAL', name: 'Medical Allowance', amount: medical },
    ]

    if (!employerContributions) {
      employerContributions = [{ code: 'PF', name: 'Employer PF Contribution', amount: employerPf }]
    }
  }

  const grossSalary = components.reduce((sum, line) => sum + toNum(line.amount), 0)
  const basicComp = pick(components, 'BASIC') || 0
  const employerPfAmt =
    pick(employerContributions, 'PF') ??
    (hasExplicit(src.employerPf ?? src.employerPfAmount)
      ? roundRupee(src.employerPf ?? src.employerPfAmount)
      : Math.min(1800, roundRupee(basicComp * 0.12)))

  if (!employerContributions) {
    employerContributions = [{ code: 'PF', name: 'Employer PF Contribution', amount: employerPfAmt }]
  }

  if (!deductions) {
    const employeePf = hasExplicit(src.employeePf ?? src.pfAmount ?? src.pf)
      ? roundRupee(src.employeePf ?? src.pfAmount ?? src.pf)
      : employerPfAmt
    const pt = hasExplicit(src.pt ?? src.ptAmount ?? src.professionalTax)
      ? roundRupee(src.pt ?? src.ptAmount ?? src.professionalTax)
      : grossSalary > 15000
        ? 200
        : 0
    const tds = hasExplicit(src.tds ?? src.incomeTax) ? roundRupee(src.tds ?? src.incomeTax) : 0

    deductions = [
      { code: 'PF', name: 'Employee PF', amount: employeePf },
      { code: 'PT', name: 'Professional Tax', amount: pt },
      { code: 'TDS', name: 'Income Tax (TDS)', amount: tds },
    ]
  }

  const totalDeductions = deductions.reduce((sum, line) => sum + toNum(line.amount), 0)
  const netSalary =
    hasExplicit(src.netSalary) ? roundRupee(src.netSalary) : Math.max(0, grossSalary - totalDeductions)
  const totalEmployerContrib = employerContributions.reduce((sum, line) => sum + toNum(line.amount), 0)
  const monthlyCTC = hasExplicit(src.monthlyCTC ?? src.ctc)
    ? roundRupee(src.monthlyCTC ?? src.ctc)
    : grossSalary + totalEmployerContrib
  const annualCTC = hasExplicit(src.annualCTC) ? roundRupee(src.annualCTC) : monthlyCTC * 12

  return {
    components,
    grossSalary,
    deductions,
    totalDeductions,
    netSalary,
    employerContributions,
    monthlyCTC,
    annualCTC,
  }
}

export const salaryFormFromStructure = (struct) => {
  const pickAmt = (lines, code) => pick(lines, code) ?? 0
  return {
    basicSalary: pickAmt(struct.components, 'BASIC'),
    da: pickAmt(struct.components, 'DA'),
    hra: pickAmt(struct.components, 'HRA'),
    conveyance: pickAmt(struct.components, 'CONVEYANCE'),
    specialAllowance: pickAmt(struct.components, 'SPECIAL'),
    medicalAllowance: pickAmt(struct.components, 'MEDICAL'),
    employerPf: pickAmt(struct.employerContributions, 'PF'),
    employeePf: pickAmt(struct.deductions, 'PF'),
    pt: pickAmt(struct.deductions, 'PT'),
    tds: pickAmt(struct.deductions, 'TDS'),
    ctc: struct.monthlyCTC,
    salary: struct.monthlyCTC,
  }
}

export const salaryInputFromForm = (form = {}) => ({
  monthlyCTC: form.ctc ?? form.salary ?? form.monthlyCTC ?? 0,
  basicSalary: form.basicSalary,
  da: form.da,
  hra: form.hra,
  conveyance: form.conveyance,
  specialAllowance: form.specialAllowance,
  medicalAllowance: form.medicalAllowance,
  employerPf: form.employerPf,
  employeePf: form.employeePf,
  pt: form.pt,
  tds: form.tds,
})

export const getSalaryStructure = (salaryRecordOrCtc) => {
  if (salaryRecordOrCtc == null || salaryRecordOrCtc === '') {
    return calculateSalaryStructure({ monthlyCTC: 0 })
  }
  if (typeof salaryRecordOrCtc === 'object') {
    return calculateSalaryStructure(salaryRecordOrCtc)
  }
  return calculateSalaryStructure({ monthlyCTC: Number(salaryRecordOrCtc) })
}
