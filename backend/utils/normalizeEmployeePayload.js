import { calculateSalaryStructure } from './salaryCalculator.js';

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const num = Number(value);
  return Number.isNaN(num) ? undefined : num;
};

const toDate = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const splitList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (!value || typeof value !== 'string') return [];
  return value.split(',').map((v) => v.trim()).filter(Boolean);
};

const ALWAYS_VISIBLE_SIDEBAR_SECTIONS = ['dashboard', 'workspace'];

const normalizeSidebarSections = (body) => {
  const raw = body.access?.sidebarSections ?? body.sidebarSections;
  if (!Array.isArray(raw)) return [...ALWAYS_VISIBLE_SIDEBAR_SECTIONS];
  const cleaned = raw.map((id) => String(id).trim()).filter(Boolean);
  return [...new Set([...ALWAYS_VISIBLE_SIDEBAR_SECTIONS, ...cleaned])];
};

export const normalizeEmployeePayload = (body = {}) => {
  const {
    password,
    skillsList,
    technologiesList,
    languagesList,
    permissionsList,
    kpisList,
    emergencyContactName,
    emergencyContactNumber,
    emergencyContactRelationship,
    ...rest
  } = body;

  const monthlyCtc =
    toNumber(rest.salaryPayroll?.monthlyCTC ?? rest.salaryPayroll?.ctc ?? rest.ctc ?? rest.salary) ?? 0;
  const computedStructure = calculateSalaryStructure({
    ...rest.salaryPayroll,
    ...rest,
    monthlyCTC: monthlyCtc,
  });

  const payload = {
    ...rest,
    department: typeof rest.department === 'string' ? rest.department.trim() : rest.department,
    salary: computedStructure.monthlyCTC,
    dateOfJoining: toDate(rest.dateOfJoining),
    dateOfBirth: toDate(rest.dateOfBirth),
    probationEndDate: toDate(rest.probationEndDate),
    workingHours: (typeof rest.workingHours === 'string' ? rest.workingHours.trim() : rest.workingHours) || '9 AM - 6 PM',
    reportingManager: rest.reportingManager || null,
    employmentStatus: rest.employmentStatus || rest.status || 'Active',
    status: rest.status || 'Active',
    emergencyContact: {
      name: emergencyContactName ?? rest.emergencyContact?.name ?? '',
      number: emergencyContactNumber ?? rest.emergencyContact?.number ?? '',
      relationship: emergencyContactRelationship ?? rest.emergencyContact?.relationship ?? '',
    },
    documents: {
      resume: rest.documents?.resume ?? rest.resume ?? '',
      offerLetter: rest.documents?.offerLetter ?? rest.offerLetter ?? '',
      appointmentLetter: rest.documents?.appointmentLetter ?? rest.appointmentLetter ?? '',
      ndaAgreement: rest.documents?.ndaAgreement ?? rest.ndaAgreement ?? '',
      experienceLetters: rest.documents?.experienceLetters ?? rest.experienceLetters ?? '',
      educationalCertificates: rest.documents?.educationalCertificates ?? rest.educationalCertificates ?? '',
      panCard: rest.documents?.panCard ?? rest.panCard ?? '',
      aadhaarCard: rest.documents?.aadhaarCard ?? rest.aadhaarCard ?? '',
      passport: rest.documents?.passport ?? rest.passport ?? '',
      drivingLicense: rest.documents?.drivingLicense ?? rest.drivingLicense ?? '',
      bankPassbook: rest.documents?.bankPassbook ?? rest.bankPassbook ?? '',
    },
    salaryPayroll: {
      ctc: computedStructure.monthlyCTC,
      grossSalary: computedStructure.grossSalary,
      basicSalary: computedStructure.components.find((c) => c.code === 'BASIC')?.amount || 0,
      hra: computedStructure.components.find((c) => c.code === 'HRA')?.amount || 0,
      da: computedStructure.components.find((c) => c.code === 'DA')?.amount || 0,
      conveyance: computedStructure.components.find((c) => c.code === 'CONVEYANCE')?.amount || 0,
      specialAllowance: computedStructure.components.find((c) => c.code === 'SPECIAL')?.amount || 0,
      medicalAllowance: computedStructure.components.find((c) => c.code === 'MEDICAL')?.amount || 0,
      attendanceIncentive: computedStructure.components.find((c) => c.code === 'ATTENDANCE_INCENTIVE')?.amount || 0,
      employerPf: computedStructure.employerContributions.find((c) => c.code === 'PF')?.amount || 0,
      employeePf: computedStructure.deductions.find((c) => c.code === 'PF')?.amount || 0,
      professionalTax: computedStructure.deductions.find((c) => c.code === 'PT')?.amount || 0,
      tds: computedStructure.deductions.find((c) => c.code === 'TDS')?.amount || 0,
      allowances: toNumber(rest.salaryPayroll?.allowances ?? rest.allowances) ?? 0,
      bonus: toNumber(rest.salaryPayroll?.bonus ?? rest.bonus) ?? 0,
      totalDeductions: computedStructure.totalDeductions,
      netSalary: computedStructure.netSalary,
      monthlyCTC: computedStructure.monthlyCTC,
      annualCTC: computedStructure.annualCTC,
      components: computedStructure.components,
      deductions: computedStructure.deductions,
      employerContributions: computedStructure.employerContributions,
      pfNumber: rest.salaryPayroll?.pfNumber ?? rest.pfNumber ?? '',
      esicNumber: rest.salaryPayroll?.esicNumber ?? rest.esicNumber ?? '',
      uanNumber: rest.salaryPayroll?.uanNumber ?? rest.uanNumber ?? '',
      panNumber: rest.salaryPayroll?.panNumber ?? rest.panNumber ?? '',
      taxInformation: rest.salaryPayroll?.taxInformation ?? rest.taxInformation ?? '',
      bankAccountDetails: rest.salaryPayroll?.bankAccountDetails ?? rest.bankAccountDetails ?? '',
    },
    skills: {
      skills: splitList(skillsList ?? rest.skills?.skills),
      technologies: splitList(technologiesList ?? rest.skills?.technologies),
      languages: splitList(languagesList ?? rest.skills?.languages),
      certifications: rest.skills?.certifications ?? [],
      trainingCompleted: rest.skills?.trainingCompleted ?? [],
    },
    assets: {
      laptop: rest.assets?.laptop ?? rest.laptop ?? '',
      desktop: rest.assets?.desktop ?? rest.desktop ?? '',
      mobilePhone: rest.assets?.mobilePhone ?? rest.mobilePhone ?? '',
      simCard: rest.assets?.simCard ?? rest.simCard ?? '',
      accessCards: rest.assets?.accessCards ?? rest.accessCards ?? '',
      other: rest.assets?.other ?? rest.otherAssets ?? '',
    },
    access: {
      crmRole: rest.access?.crmRole ?? rest.crmRole ?? '',
      permissions: splitList(permissionsList ?? rest.access?.permissions),
      sidebarSections: normalizeSidebarSections(rest),
      accountStatus: rest.access?.accountStatus ?? rest.accountStatus ?? 'Active',
      loginHistory: rest.access?.loginHistory ?? [],
      lastLogin: toDate(rest.access?.lastLogin),
    },
    notes: {
      hrNotes: rest.notes?.hrNotes ?? rest.hrNotes ?? '',
      employeeRemarks: rest.notes?.employeeRemarks ?? rest.employeeRemarks ?? '',
      activityLog: rest.notes?.activityLog ?? [],
      documentUploadHistory: rest.notes?.documentUploadHistory ?? [],
      profileUpdateHistory: rest.notes?.profileUpdateHistory ?? [],
    },
    performance: {
      kpis: splitList(kpisList ?? rest.performance?.kpis),
      reviews: rest.performance?.reviews ?? [],
      appraisalHistory: rest.performance?.appraisalHistory ?? [],
      goals: rest.performance?.goals ?? [],
      managerFeedback: rest.performance?.managerFeedback ?? [],
    },
  };

  if (typeof payload.employeeCode === 'string') {
    payload.employeeCode = payload.employeeCode.trim();
  }

  if (!payload.salaryPayroll.ctc && payload.salary) {
    payload.salaryPayroll.ctc = payload.salary;
  }

  delete payload.resume;
  delete payload.offerLetter;
  delete payload.appointmentLetter;
  delete payload.ndaAgreement;
  delete payload.experienceLetters;
  delete payload.educationalCertificates;
  delete payload.panCard;
  delete payload.aadhaarCard;
  delete payload.passport;
  delete payload.drivingLicense;
  delete payload.bankPassbook;
  delete payload.ctc;
  delete payload.basicSalary;
  delete payload.hra;
  delete payload.allowances;
  delete payload.bonus;
  delete payload.pfNumber;
  delete payload.esicNumber;
  delete payload.uanNumber;
  delete payload.taxInformation;
  delete payload.bankAccountDetails;
  delete payload.laptop;
  delete payload.desktop;
  delete payload.mobilePhone;
  delete payload.simCard;
  delete payload.accessCards;
  delete payload.otherAssets;
  delete payload.crmRole;
  delete payload.accountStatus;
  delete payload.sidebarSections;
  delete payload.hrNotes;
  delete payload.employeeRemarks;

  return { payload, password };
};
