import React, { useEffect, useMemo, useState, useRef } from 'react'
import api from '../api/axios'
import { uploadFile } from '../utils/uploadFile'
import { useNavigate, useParams } from 'react-router-dom'
import { DEFAULT_SIDEBAR_SECTIONS, SIDEBAR_PARENT_SECTIONS, isAlwaysOnSidebarSection } from '../config/sidebarParentSections'
import { SidebarSectionIcon } from '../config/sidebarIcons'
import { getSalaryStructure, salaryFormFromStructure, salaryInputFromForm } from '../utils/salaryCalculator'
import {
  buildDepartmentOptions,
  CUSTOM_DEPARTMENTS_STORAGE_KEY,
  normalizeDepartment,
  readCustomDepartments,
} from '../utils/departmentOptions'
import {
  getEmployeeCodeFormatHint,
  getEmployeeCodePlaceholder,
  getNextEmployeeCode,
  isValidEmployeeCode,
} from '../utils/employeeCode'

const isManagerOrLeader = (employee) => {
  const accessRole = String(employee?.designation?.accessRole || '').toLowerCase()
  if (['admin', 'hr', 'manager', 'technical_lead'].includes(accessRole)) return true

  const title = String(employee?.designation?.title || employee?.designation?.name || '').toLowerCase()
  return ['manager', 'lead', 'head'].some((keyword) => title.includes(keyword))
}

const emptyForm = {
  name: '',
  email: '',
  password: '',
  designation: '',
  department: '',
  dateOfJoining: '',
  salary: '',
  workingHours: '9 AM - 6 PM',
  status: 'Active',
  employeeCode: '',
  profilePhoto: '',
  gender: '',
  dateOfBirth: '',
  maritalStatus: '',
  bloodGroup: '',
  personalEmail: '',
  personalMobile: '',
  employeeType: 'Permanent',
  probationEndDate: '',
  employmentStatus: 'Active',
  reportingManager: '',
  workLocation: '',
  currentAddress: '',
  permanentAddress: '',
  emergencyContactName: '',
  emergencyContactNumber: '',
  emergencyContactRelationship: '',
  officialMobile: '',
  companyIdCardNumber: '',
  workShift: '',
  attendancePolicy: '',
  resume: '',
  offerLetter: '',
  appointmentLetter: '',
  ndaAgreement: '',
  experienceLetters: '',
  educationalCertificates: '',
  panCard: '',
  aadhaarCard: '',
  passport: '',
  drivingLicense: '',
  bankPassbook: '',
  ctc: '',
  basicSalary: '',
  da: '',
  hra: '',
  conveyance: '',
  specialAllowance: '',
  medicalAllowance: '',
  employerPf: '',
  employeePf: '',
  pt: '',
  tds: '',
  allowances: '',
  bonus: '',
  pfNumber: '',
  esicNumber: '',
  uanNumber: '',
  panNumber: '',
  taxInformation: '',
  bankAccountDetails: '',
  skillsList: '',
  technologiesList: '',
  languagesList: '',
  kpisList: '',
  laptop: '',
  desktop: '',
  mobilePhone: '',
  simCard: '',
  accessCards: '',
  otherAssets: '',
  crmRole: '',
  permissionsList: '',
  accountStatus: 'Active',
  sidebarSections: DEFAULT_SIDEBAR_SECTIONS,
  hrNotes: '',
  employeeRemarks: '',
}

const toDateInput = (d) => (d ? String(d).split('T')[0] : '')

const mapEmployeeToForm = (emp) => ({
  name: emp.name ?? '',
  email: emp.email ?? '',
  password: '',
  designation: emp.designation?._id ?? emp.designation ?? '',
  department: emp.department ?? '',
  dateOfJoining: toDateInput(emp.dateOfJoining),
  salary: emp.salary ?? '',
  workingHours: emp.workingHours ?? '',
  status: emp.status ?? 'Active',
  employeeCode: emp.employeeCode ?? '',
  profilePhoto: emp.profilePhoto ?? '',
  gender: emp.gender ?? '',
  dateOfBirth: toDateInput(emp.dateOfBirth),
  maritalStatus: emp.maritalStatus ?? '',
  bloodGroup: emp.bloodGroup ?? '',
  personalEmail: emp.personalEmail ?? '',
  personalMobile: emp.personalMobile ?? '',
  employeeType: emp.employeeType ?? 'Permanent',
  probationEndDate: toDateInput(emp.probationEndDate),
  employmentStatus: emp.employmentStatus ?? emp.status ?? 'Active',
  reportingManager: emp.reportingManager?._id ?? emp.reportingManager ?? '',
  workLocation: emp.workLocation ?? '',
  currentAddress: emp.currentAddress ?? '',
  permanentAddress: emp.permanentAddress ?? '',
  emergencyContactName: emp.emergencyContact?.name ?? '',
  emergencyContactNumber: emp.emergencyContact?.number ?? '',
  emergencyContactRelationship: emp.emergencyContact?.relationship ?? '',
  officialMobile: emp.officialMobile ?? '',
  companyIdCardNumber: emp.companyIdCardNumber ?? '',
  workShift: emp.workShift ?? '',
  attendancePolicy: emp.attendancePolicy ?? '',
  resume: emp.documents?.resume ?? '',
  offerLetter: emp.documents?.offerLetter ?? '',
  appointmentLetter: emp.documents?.appointmentLetter ?? '',
  ndaAgreement: emp.documents?.ndaAgreement ?? '',
  experienceLetters: emp.documents?.experienceLetters ?? '',
  educationalCertificates: emp.documents?.educationalCertificates ?? '',
  panCard: emp.documents?.panCard ?? '',
  aadhaarCard: emp.documents?.aadhaarCard ?? '',
  passport: emp.documents?.passport ?? '',
  drivingLicense: emp.documents?.drivingLicense ?? '',
  bankPassbook: emp.documents?.bankPassbook ?? '',
  ctc: emp.salaryPayroll?.monthlyCTC ?? emp.salaryPayroll?.ctc ?? emp.salary ?? '',
  salary: emp.salaryPayroll?.monthlyCTC ?? emp.salaryPayroll?.ctc ?? emp.salary ?? '',
  basicSalary: emp.salaryPayroll?.basicSalary ?? '',
  da: emp.salaryPayroll?.da ?? '',
  hra: emp.salaryPayroll?.hra ?? '',
  conveyance: emp.salaryPayroll?.conveyance ?? '',
  specialAllowance: emp.salaryPayroll?.specialAllowance ?? '',
  medicalAllowance: emp.salaryPayroll?.medicalAllowance ?? '',
  employerPf: emp.salaryPayroll?.employerPf ?? emp.salaryPayroll?.employerContributions?.find((c) => c.code === 'PF')?.amount ?? '',
  employeePf: emp.salaryPayroll?.employeePf ?? emp.salaryPayroll?.deductions?.find((d) => d.code === 'PF')?.amount ?? '',
  pt: emp.salaryPayroll?.professionalTax ?? emp.salaryPayroll?.deductions?.find((d) => d.code === 'PT')?.amount ?? '',
  tds: emp.salaryPayroll?.tds ?? emp.salaryPayroll?.deductions?.find((d) => d.code === 'TDS')?.amount ?? '',
  allowances: emp.salaryPayroll?.allowances ?? '',
  bonus: emp.salaryPayroll?.bonus ?? '',
  pfNumber: emp.salaryPayroll?.pfNumber ?? '',
  esicNumber: emp.salaryPayroll?.esicNumber ?? '',
  uanNumber: emp.salaryPayroll?.uanNumber ?? '',
  panNumber: emp.salaryPayroll?.panNumber ?? emp.panNumber ?? '',
  taxInformation: emp.salaryPayroll?.taxInformation ?? '',
  bankAccountDetails: emp.salaryPayroll?.bankAccountDetails ?? '',
  skillsList: (emp.skills?.skills || []).join(', '),
  technologiesList: (emp.skills?.technologies || []).join(', '),
  languagesList: (emp.skills?.languages || []).join(', '),
  kpisList: (emp.performance?.kpis || []).join(', '),
  laptop: emp.assets?.laptop ?? '',
  desktop: emp.assets?.desktop ?? '',
  mobilePhone: emp.assets?.mobilePhone ?? '',
  simCard: emp.assets?.simCard ?? '',
  accessCards: emp.assets?.accessCards ?? '',
  otherAssets: emp.assets?.other ?? '',
  crmRole: emp.access?.crmRole ?? '',
  permissionsList: (emp.access?.permissions || []).join(', '),
  accountStatus: emp.access?.accountStatus ?? 'Active',
  sidebarSections: emp.access?.sidebarSections?.length ? emp.access.sidebarSections : DEFAULT_SIDEBAR_SECTIONS,
  hrNotes: emp.notes?.hrNotes ?? '',
  employeeRemarks: emp.notes?.employeeRemarks ?? '',
})

const Section = ({ title, children }) => (
  <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
    <div className='px-5 py-3 bg-gray-50 border-b border-gray-200'>
      <h2 className='text-sm font-semibold text-gray-900'>{title}</h2>
    </div>
    <div className='p-5 grid grid-cols-1 md:grid-cols-2 gap-4'>{children}</div>
  </div>
)

const Field = ({ label, children, className = '' }) => (
  <div className={className}>
    <label className='block text-sm font-medium text-gray-700 mb-1'>{label}</label>
    {children}
  </div>
)

const AddEmployee = () => {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(emptyForm)
  const [designations, setDesignations] = useState([])
  const [employees, setEmployees] = useState([])
  const [customDepartments, setCustomDepartments] = useState(() => readCustomDepartments())
  const [designationSearch, setDesignationSearch] = useState('')
  const [designationOpen, setDesignationOpen] = useState(false)
  const [designationLoading, setDesignationLoading] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const designationRef = useRef(null)
  const navigate = useNavigate()


  const handleProfilePhotoFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setError(null)
      const uploaded = await uploadFile(file, { folder: 'profiles' })
      setForm((f) => ({ ...f, profilePhoto: uploaded.url }))
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to upload profile photo')
      e.target.value = ''
    }
  }


  const [uploadingDocField, setUploadingDocField] = useState('')

  const handleDocumentUpload = async (fieldName, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingDocField(fieldName)
    setError(null)
    try {
      const uploaded = await uploadFile(file, { folder: 'documents' })
      setForm((f) => ({ ...f, [fieldName]: uploaded.url }))
    } catch (err) {
      setError(err.response?.data?.message || err.message || `Failed to upload ${fieldName}`)
      e.target.value = ''
    } finally {
      setUploadingDocField('')
    }
  }

  const inputClass = 'block w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const [desRes, empRes] = await Promise.all([
          api.get('/designations'),
          api.get('/employees'),
        ])
        const desPayload = desRes.data
        const desList = Array.isArray(desPayload) ? desPayload : desPayload?.data || desPayload?.designations || []
        const empPayload = empRes.data
        const empList = Array.isArray(empPayload) ? empPayload : empPayload?.data || empPayload?.employees || []
        setDesignations(desList)
        setEmployees(empList.filter((e) => String(e._id) !== String(id)))
      } catch (err) {
        console.error('Failed to fetch form data:', err)
      } finally {
        setDesignationLoading(false)
      }
    }
    fetchMeta()
  }, [id])

  useEffect(() => {
    const syncCustomDepartments = () => setCustomDepartments(readCustomDepartments())
    const onStorage = (event) => {
      if (event.key === CUSTOM_DEPARTMENTS_STORAGE_KEY) syncCustomDepartments()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('focus', syncCustomDepartments)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('focus', syncCustomDepartments)
    }
  }, [])

  const departmentOptions = useMemo(() => {
    const base = buildDepartmentOptions({ employees, designations, customDepartments })
    const current = normalizeDepartment(form.department)
    if (current && !base.some((d) => d.toLowerCase() === current.toLowerCase())) {
      return [...base, current].sort((a, b) => a.localeCompare(b))
    }
    return base
  }, [employees, designations, customDepartments, form.department])

  const reportingManagerOptions = useMemo(() => {
    const managers = employees.filter(isManagerOrLeader)
    const selectedId = String(form.reportingManager || '')
    if (selectedId && !managers.some((emp) => String(emp._id) === selectedId)) {
      const selected = employees.find((emp) => String(emp._id) === selectedId)
      if (selected) return [selected, ...managers]
    }
    return managers
  }, [employees, form.reportingManager])

  const nextEmployeeCode = useMemo(() => getNextEmployeeCode(employees), [employees])

  useEffect(() => {
    if (!id) return
    const fetchEmployee = async () => {
      try {
        const res = await api.get(`/employees/${id}`)
        const mapped = mapEmployeeToForm(res.data)
        setForm(mapped)
        const title = res.data?.designation?.title ?? res.data?.designation?.name ?? ''
        setDesignationSearch(title)
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Error loading employee')
      }
    }
    fetchEmployee()
  }, [id])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (designationRef.current && !designationRef.current.contains(e.target)) setDesignationOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getDesignationTitle = (d) => d?.title ?? d?.name ?? ''
  const filteredDesignations = designations.filter((d) =>
    getDesignationTitle(d).toLowerCase().includes(designationSearch.toLowerCase())
  )

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm((f) => {
      if (name === 'ctc' || name === 'salary') {
        const struct = getSalaryStructure({ monthlyCTC: Number(value || 0), tds: f.tds })
        return {
          ...f,
          ...salaryFormFromStructure(struct),
          ctc: value,
          salary: value,
          tds: f.tds,
        }
      }
      const next = { ...f, [name]: value }
      const earningKeys = ['basicSalary', 'da', 'hra', 'conveyance', 'medicalAllowance', 'employerPf']
      if (earningKeys.includes(name)) {
        const ctc = Number(next.ctc || next.salary || 0)
        const used =
          Number(next.basicSalary || 0) +
          Number(next.da || 0) +
          Number(next.hra || 0) +
          Number(next.conveyance || 0) +
          Number(next.medicalAllowance || 0) +
          Number(next.employerPf || 0)
        next.specialAllowance = Math.max(0, Math.round(ctc - used))
      }
      return next
    })
  }

  const handleDesignationSelect = (d) => {
    setForm((f) => ({ ...f, designation: d._id, crmRole: f.crmRole || getDesignationTitle(d) }))
    setDesignationSearch(getDesignationTitle(d))
    setDesignationOpen(false)
  }

  const toggleSidebarSection = (sectionId) => {
    if (isAlwaysOnSidebarSection(sectionId)) return
    setForm((f) => {
      const current = f.sidebarSections || []
      const next = current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId]
      return { ...f, sidebarSections: next }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.designation) {
      setError('Please select a designation')
      return
    }
    if (!form.department?.trim()) {
      setError('Department is required')
      return
    }
    if (!form.dateOfJoining) {
      setError('Joining date is required')
      return
    }
    if (!isEdit && (!form.password || form.password.length < 6)) {
      setError('Password is required and must be at least 6 characters')
      return
    }
    if (form.employeeCode?.trim() && !isValidEmployeeCode(form.employeeCode)) {
      setError(getEmployeeCodeFormatHint())
      return
    }
    setLoading(true)
    setError(null)
    try {
      const payload = {
        ...form,
        employeeCode: form.employeeCode?.trim() ? form.employeeCode.trim().toUpperCase() : '',
        salary: form.ctc === '' && form.salary === '' ? 0 : Number(form.ctc || form.salary),
        documents: {
          resume: form.resume,
          offerLetter: form.offerLetter,
          appointmentLetter: form.appointmentLetter,
          ndaAgreement: form.ndaAgreement,
          experienceLetters: form.experienceLetters,
          educationalCertificates: form.educationalCertificates,
          panCard: form.panCard,
          aadhaarCard: form.aadhaarCard,
          passport: form.passport,
          drivingLicense: form.drivingLicense,
          bankPassbook: form.bankPassbook,
        },
        salaryPayroll: (() => {
          const struct = getSalaryStructure(salaryInputFromForm(form))
          return {
            grossSalary: struct.grossSalary,
            netSalary: struct.netSalary,
            monthlyCTC: struct.monthlyCTC,
            annualCTC: struct.annualCTC,
            ctc: struct.monthlyCTC,
            basicSalary: struct.components.find((c) => c.code === 'BASIC')?.amount || 0,
            hra: struct.components.find((c) => c.code === 'HRA')?.amount || 0,
            da: struct.components.find((c) => c.code === 'DA')?.amount || 0,
            conveyance: struct.components.find((c) => c.code === 'CONVEYANCE')?.amount || 0,
            specialAllowance: struct.components.find((c) => c.code === 'SPECIAL')?.amount || 0,
            medicalAllowance: struct.components.find((c) => c.code === 'MEDICAL')?.amount || 0,
            employerPf: struct.employerContributions.find((c) => c.code === 'PF')?.amount || 0,
            employeePf: struct.deductions.find((c) => c.code === 'PF')?.amount || 0,
            professionalTax: struct.deductions.find((c) => c.code === 'PT')?.amount || 0,
            tds: struct.deductions.find((c) => c.code === 'TDS')?.amount || 0,
            allowances: Number(form.allowances || 0),
            bonus: Number(form.bonus || 0),
            totalDeductions: struct.totalDeductions,
            components: struct.components,
            deductions: struct.deductions,
            employerContributions: struct.employerContributions,
            pfNumber: form.pfNumber,
            esicNumber: form.esicNumber,
            uanNumber: form.uanNumber,
            panNumber: form.panNumber,
            taxInformation: form.taxInformation,
            bankAccountDetails: form.bankAccountDetails,
          }
        })(),
        assets: {
          laptop: form.laptop,
          desktop: form.desktop,
          mobilePhone: form.mobilePhone,
          simCard: form.simCard,
          accessCards: form.accessCards,
          other: form.otherAssets,
        },
        access: {
          crmRole: form.crmRole,
          accountStatus: form.accountStatus,
          sidebarSections: form.sidebarSections,
        },
        sidebarSections: form.sidebarSections,
        notes: {
          hrNotes: form.hrNotes,
          employeeRemarks: form.employeeRemarks,
        },
      }
      if (isEdit) {
        if (!payload.password) delete payload.password
        await api.put(`/employees/${id}`, payload)
        navigate(`/employees/${id}/profile`)
      } else {
        await api.post('/employees', payload)
        navigate('/employees')
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || (isEdit ? 'Error updating employee' : 'Error creating employee'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className='p-6 md:p-8 w-full'>
      <div className='mb-6'>
        <h1 className='text-2xl font-bold text-gray-900'>{isEdit ? 'Edit Employee Profile' : 'Add Employee'}</h1>
        <p className='text-sm text-gray-500 mt-1'>Fill employee profile details across all HR sections.</p>
      </div>

      <form onSubmit={handleSubmit} className='space-y-6'>
        <Section title='1. Basic Information'>
          <Field label='Employee ID'>
            <input
              name='employeeCode'
              value={form.employeeCode}
              onChange={handleChange}
              className={inputClass}
              placeholder={getEmployeeCodePlaceholder()}
            />
            <p className='mt-1 text-xs text-gray-500'>
              {getEmployeeCodeFormatHint()}
              {!isEdit && !form.employeeCode.trim() && (
                <>
                  {' '}
                  Next auto-assigned ID:
                  {' '}
                  <span className='font-medium text-gray-700'>{nextEmployeeCode}</span>
                </>
              )}
            </p>
          </Field>
          <Field label='Full Name *'><input name='name' value={form.name} onChange={handleChange} required className={inputClass} /></Field>
          <Field label='Profile Photo'>
            <div className='flex flex-wrap items-center gap-2'>
              <input name='profilePhoto' value={form.profilePhoto} onChange={handleChange} className={inputClass} placeholder='Paste URL or upload' />
              <label className='inline-flex items-center px-3 py-2 rounded-lg border border-blue-600 text-blue-700 text-sm font-medium hover:bg-blue-50 cursor-pointer whitespace-nowrap'>
                Upload
                <input type='file' accept='image/*' className='hidden' onChange={handleProfilePhotoFile} />
              </label>
            </div>
            {form.profilePhoto ? (
              <img src={form.profilePhoto} alt='Profile' className='mt-2 h-16 w-16 rounded-full object-cover border' />
            ) : null}
          </Field>
          <Field label='Gender'>
            <select name='gender' value={form.gender} onChange={handleChange} className={inputClass}>
              <option value=''>Select</option>
              <option value='Male'>Male</option>
              <option value='Female'>Female</option>
              <option value='Other'>Other</option>
            </select>
          </Field>
          <Field label='Date of Birth'><input name='dateOfBirth' type='date' value={form.dateOfBirth} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Marital Status'>
            <select name='maritalStatus' value={form.maritalStatus} onChange={handleChange} className={inputClass}>
              <option value=''>Select</option>
              <option value='Single'>Single</option>
              <option value='Married'>Married</option>
              <option value='Divorced'>Divorced</option>
              <option value='Widowed'>Widowed</option>
            </select>
          </Field>
          <Field label='Blood Group'><input name='bloodGroup' value={form.bloodGroup} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Personal Email'><input name='personalEmail' type='email' value={form.personalEmail} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Personal Mobile'><input name='personalMobile' value={form.personalMobile} onChange={handleChange} className={inputClass} /></Field>
        </Section>

        <Section title='2. Employment Details'>
          <Field label='Designation *' className='relative' >
            <div ref={designationRef}>
              <input type='text' value={designationSearch} onChange={(e) => { setDesignationSearch(e.target.value); setDesignationOpen(true); if (!e.target.value) setForm((f) => ({ ...f, designation: '' })) }} onFocus={() => setDesignationOpen(true)} placeholder='Search designation...' className={inputClass} autoComplete='off' />
              {designationOpen && (
                <ul className='absolute z-20 top-full left-0 right-0 mt-1 max-h-48 overflow-auto bg-white border rounded-lg shadow-lg py-1'>
                  {designationLoading ? <li className='px-3 py-2 text-sm text-gray-500'>Loading...</li> : filteredDesignations.length === 0 ? <li className='px-3 py-2 text-sm text-gray-500'>No designations found</li> : filteredDesignations.map((d) => (
                    <li key={d._id} onClick={() => handleDesignationSelect(d)} className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 ${form.designation === d._id ? 'bg-blue-100' : ''}`}>{getDesignationTitle(d)}</li>
                  ))}
                </ul>
              )}
            </div>
          </Field>
          <Field label='Department *'>
            <select name='department' value={form.department} onChange={handleChange} required className={inputClass}>
              <option value=''>Select department</option>
              {departmentOptions.map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </select>
          </Field>
          <Field label='Employee Type'>
            <select name='employeeType' value={form.employeeType} onChange={handleChange} className={inputClass}>
              <option value='Permanent'>Permanent</option>
              <option value='Contract'>Contract</option>
              <option value='Intern'>Intern</option>
            </select>
          </Field>
          <Field label='Joining Date *'><input name='dateOfJoining' type='date' value={form.dateOfJoining} onChange={handleChange} required className={inputClass} /></Field>
          <Field label='Probation End Date'><input name='probationEndDate' type='date' value={form.probationEndDate} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Employment Status'>
            <select name='employmentStatus' value={form.employmentStatus} onChange={handleChange} className={inputClass}>
              <option value='Active'>Active</option>
              <option value='Inactive'>Inactive</option>
              <option value='Resigned'>Resigned</option>
              <option value='Terminated'>Terminated</option>
            </select>
          </Field>
          <Field label='Reporting Manager'>
            <select name='reportingManager' value={form.reportingManager} onChange={handleChange} className={inputClass}>
              <option value=''>Select manager</option>
              {reportingManagerOptions.map((emp) => (
                <option key={emp._id} value={emp._id}>
                  {emp.name}
                  {emp.designation?.title ? ` (${emp.designation.title})` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Field label='Work Location / Branch'><input name='workLocation' value={form.workLocation} onChange={handleChange} className={inputClass} /></Field>
        </Section>

        <Section title='3. Contact Information'>
          <Field label='Current Address' className='md:col-span-2'><textarea name='currentAddress' value={form.currentAddress} onChange={handleChange} rows={2} className={inputClass} /></Field>
          <Field label='Permanent Address' className='md:col-span-2'><textarea name='permanentAddress' value={form.permanentAddress} onChange={handleChange} rows={2} className={inputClass} /></Field>
          <Field label='Emergency Contact Name'><input name='emergencyContactName' value={form.emergencyContactName} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Emergency Contact Number'><input name='emergencyContactNumber' value={form.emergencyContactNumber} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Emergency Contact Relationship'><input name='emergencyContactRelationship' value={form.emergencyContactRelationship} onChange={handleChange} className={inputClass} /></Field>
        </Section>

        <Section title='4. Official Information & Login'>
          <Field label='Official Email *'><input name='email' type='email' value={form.email} onChange={handleChange} required className={inputClass} /></Field>
          <Field label='Login Password *'><input name='password' type='password' value={form.password} onChange={handleChange} placeholder={isEdit ? 'Leave blank to keep current' : 'Min 6 characters'} className={inputClass} required={!isEdit} minLength={isEdit ? undefined : 6} /></Field>
          <Field label='Official Mobile'><input name='officialMobile' value={form.officialMobile} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Company ID Card Number'><input name='companyIdCardNumber' value={form.companyIdCardNumber} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Work Shift'><input name='workShift' value={form.workShift} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Working Hours *'><input name='workingHours' value={form.workingHours} onChange={handleChange} required className={inputClass} placeholder='9 AM - 6 PM' /></Field>
          <Field label='Attendance Policy'><input name='attendancePolicy' value={form.attendancePolicy} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Account Status'>
            <select name='status' value={form.status} onChange={handleChange} className={inputClass}>
              <option value='Active'>Active</option>
              <option value='Inactive'>Inactive</option>
            </select>
          </Field>
        </Section>

        <Section title='5. Documents'>
          <p className='md:col-span-2 text-xs text-gray-500 -mt-1 mb-1'>Upload from your device or paste a link for each document.</p>
          {[
            ['resume', 'Resume/CV'],
            ['offerLetter', 'Offer Letter'],
            ['appointmentLetter', 'Appointment Letter'],
            ['ndaAgreement', 'NDA Agreement'],
            ['experienceLetters', 'Experience Letters'],
            ['educationalCertificates', 'Educational Certificates'],
            ['panCard', 'PAN Card'],
            ['aadhaarCard', 'Aadhaar Card'],
            ['passport', 'Passport'],
            ['drivingLicense', 'Driving License'],
            ['bankPassbook', 'Bank Passbook/Cancelled Cheque'],
          ].map(([name, label]) => (
            <Field key={name} label={label}>
              <div className='flex flex-wrap items-center gap-2'>
                <input
                  name={name}
                  value={form[name]}
                  onChange={handleChange}
                  className={inputClass}
                  placeholder='Paste URL or upload from device'
                />
                <label className={`inline-flex items-center px-3 py-2 rounded-lg border border-blue-600 text-blue-700 text-sm font-medium hover:bg-blue-50 cursor-pointer whitespace-nowrap ${uploadingDocField === name ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploadingDocField === name ? 'Uploading…' : 'Upload'}
                  <input
                    type='file'
                    accept='.pdf,.doc,.docx,image/*,application/pdf'
                    className='hidden'
                    disabled={Boolean(uploadingDocField)}
                    onChange={(e) => handleDocumentUpload(name, e)}
                  />
                </label>
              </div>
              {form[name] ? (
                <a
                  href={form[name]}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='inline-block mt-1 text-xs text-blue-600 hover:underline'
                >
                  Open file
                </a>
              ) : null}
            </Field>
          ))}
        </Section>

        <Section title='6. Salary & Payroll'>
          <Field label='Monthly CTC' className='md:col-span-2'>
            <input name='ctc' type='number' min='0' value={form.ctc} onChange={handleChange} className={inputClass} placeholder='Enter monthly CTC, e.g. 45000' />
            <p className='text-xs text-gray-500 mt-1'>Enter this employee&apos;s monthly CTC. The breakdown below is filled for this amount and can be edited for this employee.</p>
          </Field>
          {(() => {
            const preview = getSalaryStructure(salaryInputFromForm(form))
            const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`
            return (
              <div className='md:col-span-2 space-y-4'>
                <div className='p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-4'>
                  <h3 className='font-bold text-gray-900 text-sm'>Earnings</h3>
                  <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                    <Field label='Basic Salary'><input name='basicSalary' type='number' min='0' value={form.basicSalary} onChange={handleChange} className={inputClass} /></Field>
                    <Field label='Dearness Allowance'><input name='da' type='number' min='0' value={form.da} onChange={handleChange} className={inputClass} /></Field>
                    <Field label='House Rent Allowance'><input name='hra' type='number' min='0' value={form.hra} onChange={handleChange} className={inputClass} /></Field>
                    <Field label='Conveyance Allowance'><input name='conveyance' type='number' min='0' value={form.conveyance} onChange={handleChange} className={inputClass} /></Field>
                    <Field label='Special Allowance'><input name='specialAllowance' type='number' min='0' value={form.specialAllowance} onChange={handleChange} className={inputClass} /></Field>
                    <Field label='Employer PF Contribution'><input name='employerPf' type='number' min='0' value={form.employerPf} onChange={handleChange} className={inputClass} /></Field>
                    <Field label='Medical Allowance'><input name='medicalAllowance' type='number' min='0' value={form.medicalAllowance} onChange={handleChange} className={inputClass} /></Field>
                  </div>
                  <h3 className='font-bold text-gray-900 text-sm pt-1'>Deductions</h3>
                  <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                    <Field label='Employee PF'><input name='employeePf' type='number' min='0' value={form.employeePf} onChange={handleChange} className={inputClass} /></Field>
                    <Field label='Professional Tax'><input name='pt' type='number' min='0' value={form.pt} onChange={handleChange} className={inputClass} /></Field>
                    <Field label='Income Tax (TDS)'><input name='tds' type='number' min='0' value={form.tds} onChange={handleChange} className={inputClass} placeholder='Enter TDS for this employee' /></Field>
                  </div>
                </div>
                <div className='grid grid-cols-3 gap-2'>
                  <div className='p-2 bg-green-50 rounded-lg border border-green-200'>
                    <span className='text-green-700 block font-medium text-xs'>Net Salary</span>
                    <span className='font-bold text-green-900 text-sm'>{money(preview.netSalary)}</span>
                  </div>
                  <div className='p-2 bg-blue-50 rounded-lg border border-blue-200'>
                    <span className='text-blue-700 block font-medium text-xs'>Gross Salary</span>
                    <span className='font-bold text-blue-900 text-sm'>{money(preview.grossSalary)}</span>
                  </div>
                  <div className='p-2 bg-purple-50 rounded-lg border border-purple-200'>
                    <span className='text-purple-700 block font-medium text-xs'>Annual CTC</span>
                    <span className='font-bold text-purple-900 text-sm'>{money(preview.annualCTC)}</span>
                  </div>
                </div>
              </div>
            )
          })()}
          <Field label='PF Number'><input name='pfNumber' value={form.pfNumber} onChange={handleChange} className={inputClass} /></Field>
          <Field label='ESIC Number'><input name='esicNumber' value={form.esicNumber} onChange={handleChange} className={inputClass} /></Field>
          <Field label='UAN Number'><input name='uanNumber' value={form.uanNumber} onChange={handleChange} className={inputClass} /></Field>
          <Field label='PAN Number'><input name='panNumber' value={form.panNumber} onChange={handleChange} className={inputClass} placeholder='e.g. ABCDE1234F' /></Field>
          <Field label='Tax Information'><input name='taxInformation' value={form.taxInformation} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Bank Account Details' className='md:col-span-2'><textarea name='bankAccountDetails' value={form.bankAccountDetails} onChange={handleChange} rows={2} className={inputClass} /></Field>
        </Section>

        <Section title='9. Skills & Certifications'>
          <Field label='Skills (comma separated)' className='md:col-span-2'><input name='skillsList' value={form.skillsList} onChange={handleChange} className={inputClass} placeholder='Communication, Leadership' /></Field>
          <Field label='Technologies (comma separated)' className='md:col-span-2'><input name='technologiesList' value={form.technologiesList} onChange={handleChange} className={inputClass} placeholder='React, Node.js' /></Field>
          <Field label='Languages Known (comma separated)' className='md:col-span-2'><input name='languagesList' value={form.languagesList} onChange={handleChange} className={inputClass} placeholder='English, Hindi' /></Field>
          <Field label='KPIs (comma separated)' className='md:col-span-2'><input name='kpisList' value={form.kpisList} onChange={handleChange} className={inputClass} /></Field>
        </Section>

        <Section title='10. Assets Assigned'>
          <Field label='Laptop'><input name='laptop' value={form.laptop} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Desktop'><input name='desktop' value={form.desktop} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Mobile Phone'><input name='mobilePhone' value={form.mobilePhone} onChange={handleChange} className={inputClass} /></Field>
          <Field label='SIM Card'><input name='simCard' value={form.simCard} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Access Cards'><input name='accessCards' value={form.accessCards} onChange={handleChange} className={inputClass} /></Field>
          <Field label='Other Company Assets'><input name='otherAssets' value={form.otherAssets} onChange={handleChange} className={inputClass} /></Field>
        </Section>

        <Section title='11. Access & Permissions'>
          <Field label='CRM Role'><input name='crmRole' value={form.crmRole} onChange={handleChange} className={inputClass} /></Field>
          <Field label='User Permissions (comma separated)'><input name='permissionsList' value={form.permissionsList} onChange={handleChange} className={inputClass} placeholder='employees.read, projects.write' /></Field>
          <Field label='Account Status'>
            <select name='accountStatus' value={form.accountStatus} onChange={handleChange} className={inputClass}>
              <option value='Active'>Active</option>
              <option value='Inactive'>Inactive</option>
              <option value='Locked'>Locked</option>
            </select>
          </Field>
          <div className='md:col-span-2'>
            <label className='block text-sm font-medium text-gray-700 mb-1'>Sidebar Menu Access</label>
            <p className='text-xs text-gray-500 mb-3'>Select which main sidebar sections this employee will see on their dashboard after login.</p>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2'>
              {SIDEBAR_PARENT_SECTIONS.map((section) => {
                const checked = (form.sidebarSections || []).includes(section.id)
                const disabled = isAlwaysOnSidebarSection(section.id)
                return (
                  <label
                    key={section.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                      disabled ? 'bg-gray-50 border-gray-200 text-gray-600' : 'border-gray-300 hover:border-blue-400 cursor-pointer'
                    }`}
                  >
                    <input
                      type='checkbox'
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleSidebarSection(section.id)}
                      className='rounded border-gray-300 text-blue-600 focus:ring-blue-500'
                    />
                    <SidebarSectionIcon id={section.id} className='size-5 shrink-0' />
                    <span className='truncate flex-1'>{section.label}</span>
                    {disabled && <span className='text-[10px] text-gray-400 shrink-0'>Always on</span>}
                  </label>
                )
              })}
            </div>
          </div>
        </Section>

        <Section title='12. Notes'>
          <Field label='Internal HR Notes' className='md:col-span-2'><textarea name='hrNotes' value={form.hrNotes} onChange={handleChange} rows={3} className={inputClass} /></Field>
          <Field label='Employee Remarks' className='md:col-span-2'><textarea name='employeeRemarks' value={form.employeeRemarks} onChange={handleChange} rows={3} className={inputClass} /></Field>
        </Section>

        {error && <p className='text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-4 py-3'>{error}</p>}

        <div className='flex items-center gap-3 pb-8'>
          <button type='submit' disabled={loading} className='bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50'>
            {loading ? 'Saving...' : isEdit ? 'Update Profile' : 'Save Employee'}
          </button>
          <button type='button' onClick={() => navigate(isEdit ? `/employees/${id}/profile` : '/employees')} className='px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50'>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddEmployee
