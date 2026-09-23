import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import { uploadFile } from '../../utils/uploadFile'
import { getSalaryStructure } from '../../utils/salaryCalculator'

const TABS = [
  'Overview',
  'Employment',
  'Documents',
  'Payroll',
  'Attendance & Leave',
  'Performance',
  'Skills',
  'Assets',
  'Access & Permissions',
  'Activity Log',
]

const taskStatusClass = (status) => {
  switch (status) {
    case 'Completed': return 'bg-green-100 text-green-800'
    case 'In Progress': return 'bg-blue-100 text-blue-800'
    case 'Cancelled': return 'bg-gray-100 text-gray-600'
    default: return 'bg-amber-100 text-amber-800'
  }
}

const formatDuration = (minutes) => {
  const mins = Number(minutes)
  if (!Number.isFinite(mins) || mins <= 0) return '—'
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h && m) return `${h}h ${m}m`
  if (h) return `${h}h`
  return `${m}m`
}

const currentMonthValue = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const formatDate = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

const formatDateTime = (d) => {
  if (!d) return '—'
  return new Date(d).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const val = (v) => (v === null || v === undefined || v === '' ? '—' : v)
const money = (n) => (n != null && n !== '' ? `₹${Number(n).toLocaleString('en-IN')}` : '—')

const DOCUMENT_FIELDS = [
  ['Resume/CV', 'resume'],
  ['Offer Letter', 'offerLetter'],
  ['Appointment Letter', 'appointmentLetter'],
  ['NDA Agreement', 'ndaAgreement'],
  ['Experience Letters', 'experienceLetters'],
  ['Educational Certificates', 'educationalCertificates'],
  ['PAN Card', 'panCard'],
  ['Aadhaar Card', 'aadhaarCard'],
  ['Passport', 'passport'],
  ['Driving License', 'drivingLicense'],
  ['Bank Passbook/Cancelled Cheque', 'bankPassbook'],
]

const normalizeDocUrl = (url) => {
  if (!url || typeof url !== 'string') return ''
  const trimmed = url.trim()
  if (/^(https?:\/\/|data:|blob:|\/)/i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const isImageUrl = (url) => {
  if (!url) return false
  const value = url.trim().toLowerCase()
  if (value.startsWith('data:image/')) return true
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(value)
}

const DocumentPreviewModal = ({ preview, onClose }) => {
  if (!preview) return null
  const { url, title } = preview
  const isImage = isImageUrl(url)
  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60' onClick={onClose}>
      <div
        className='bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col'
        onClick={(e) => e.stopPropagation()}
      >
        <div className='flex items-center justify-between px-5 py-4 border-b border-gray-200'>
          <h3 className='text-lg font-semibold text-gray-900'>{title}</h3>
          <div className='flex items-center gap-2'>
            <a
              href={url}
              target='_blank'
              rel='noopener noreferrer'
              className='px-3 py-1.5 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50'
            >
              Open in New Tab
            </a>
            <button type='button' onClick={onClose} className='px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50'>
              Close
            </button>
          </div>
        </div>
        <div className='p-5 overflow-auto flex-1 flex items-center justify-center bg-gray-50'>
          {isImage ? (
            <img src={url} alt={title} className='max-w-full max-h-[70vh] object-contain rounded-lg border border-gray-200 bg-white' />
          ) : (
            <div className='text-center py-12'>
              <p className='text-gray-600 mb-4'>Preview not available for this file type.</p>
              <a href={url} target='_blank' rel='noopener noreferrer' className='inline-flex px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium'>
                Open Document
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const DocumentItem = ({ label, url, onPreview }) => {
  if (!url) {
    return (
      <div className='border border-dashed border-gray-200 rounded-xl p-4 bg-gray-50'>
        <p className='text-sm font-semibold text-gray-800'>{label}</p>
        <p className='text-xs text-gray-400 mt-2'>Not uploaded</p>
      </div>
    )
  }

  const openUrl = normalizeDocUrl(url)
  const isImage = isImageUrl(openUrl)

  return (
    <div className='border border-gray-200 rounded-xl p-4 bg-white hover:border-blue-200 hover:shadow-sm transition-all'>
      <div className='flex items-start justify-between gap-3'>
        <p className='text-sm font-semibold text-gray-900'>{label}</p>
        <div className='flex items-center gap-2 shrink-0'>
          <a
            href={openUrl}
            target='_blank'
            rel='noopener noreferrer'
            className='text-xs font-medium text-blue-600 hover:text-blue-700'
          >
            Open
          </a>
          {isImage && (
            <button
              type='button'
              onClick={() => onPreview({ url: openUrl, title: label })}
              className='text-xs font-medium text-blue-600 hover:text-blue-700'
            >
              View Photo
            </button>
          )}
        </div>
      </div>

      {isImage ? (
        <button
          type='button'
          onClick={() => onPreview({ url: openUrl, title: label })}
          className='mt-3 w-full text-left group'
        >
          <img
            src={openUrl}
            alt={label}
            className='w-full h-36 object-cover rounded-lg border border-gray-200 group-hover:opacity-90 transition-opacity'
            onError={(e) => { e.currentTarget.style.display = 'none' }}
          />
          <p className='text-xs text-gray-500 mt-2 truncate'>{url}</p>
        </button>
      ) : (
        <a
          href={openUrl}
          target='_blank'
          rel='noopener noreferrer'
          className='mt-3 block text-xs text-blue-600 hover:underline truncate'
        >
          {url}
        </a>
      )}
    </div>
  )
}

const DocumentsPanel = ({ docs, onPreview }) => (
  <InfoCard title='Employee Documents'>
    <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'>
      {DOCUMENT_FIELDS.map(([label, key]) => (
        <DocumentItem key={key} label={label} url={docs?.[key]} onPreview={onPreview} />
      ))}
    </div>
  </InfoCard>
)

const StatusBadge = ({ status }) => {
  const s = status || 'Active'
  const styles = {
    Active: 'bg-green-100 text-green-700',
    Inactive: 'bg-gray-100 text-gray-700',
    Resigned: 'bg-orange-100 text-orange-700',
    Terminated: 'bg-red-100 text-red-700',
    Locked: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[s] || styles.Active}`}>
      {s}
    </span>
  )
}

const InfoCard = ({ title, icon, children, actionLabel, onAction }) => (
  <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-full'>
    <div className='flex items-center justify-between px-5 py-4 border-b border-gray-100'>
      <div className='flex items-center gap-2'>
        {icon}
        <h3 className='text-sm font-semibold text-gray-900'>{title}</h3>
      </div>
      {actionLabel && (
        <button type='button' onClick={onAction} className='text-xs font-medium text-blue-600 hover:text-blue-700'>
          {actionLabel}
        </button>
      )}
    </div>
    <div className='p-5'>{children}</div>
  </div>
)

const DetailRow = ({ label, value, badge }) => (
  <div className='flex items-start justify-between gap-2 sm:gap-3 py-2 border-b border-gray-50 last:border-0 min-w-0'>
    <span className='text-sm text-gray-500 shrink-0 max-w-[42%]'>{label}</span>
    {badge ? <StatusBadge status={value} /> : (
      <span className='text-sm font-medium text-gray-900 text-right break-words min-w-0'>{value ?? '—'}</span>
    )}
  </div>
)

const StatBox = ({ label, value, color }) => {
  const colors = {
    green: 'bg-green-50 text-green-700 border-green-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    orange: 'bg-orange-50 text-orange-700 border-orange-100',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-100',
  }
  return (
    <div className={`rounded-lg border px-3 py-3 text-center ${colors[color]}`}>
      <p className='text-xl font-bold'>{value}</p>
      <p className='text-xs mt-1 opacity-80'>{label}</p>
    </div>
  )
}

const CardIcon = ({ children }) => (
  <span className='w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center'>{children}</span>
)

const MailIcon = () => (
  <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={1.5}>
    <path strokeLinecap='round' strokeLinejoin='round' d='M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25H4.5a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5H4.5a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75' />
  </svg>
)

const PhoneIcon = () => (
  <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={1.5}>
    <path strokeLinecap='round' strokeLinejoin='round' d='M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z' />
  </svg>
)

const LocationIcon = () => (
  <svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor' strokeWidth={1.5}>
    <path strokeLinecap='round' strokeLinejoin='round' d='M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z' />
    <path strokeLinecap='round' strokeLinejoin='round' d='M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z' />
  </svg>
)

const StarRating = ({ rating = 0 }) => {
  const stars = []
  for (let i = 1; i <= 5; i += 1) {
    stars.push(
      <svg key={i} className={`w-5 h-5 ${i <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`} fill='currentColor' viewBox='0 0 20 20'>
        <path d='M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z' />
      </svg>
    )
  }
  return <div className='flex items-center gap-1'>{stars}</div>
}

const EmployeeProfileView = ({ employeeId: employeeIdProp, isSelfProfile = false }) => {
  const { id: routeId } = useParams()
  const id = employeeIdProp || routeId
  const navigate = useNavigate()
  const { getDashboardPath, updateUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [assignedAssets, setAssignedAssets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeTab, setActiveTab] = useState('Overview')
  const [docPreview, setDocPreview] = useState(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoMessage, setPhotoMessage] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(currentMonthValue())
  const photoInputRef = useRef(null)

  const handleProfilePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !id) return
    if (!file.type.startsWith('image/')) {
      setPhotoMessage('Please choose an image file (JPG, PNG, etc.).')
      e.target.value = ''
      return
    }
    setPhotoUploading(true)
    setPhotoMessage('')
    setError(null)
    try {
      const uploaded = await uploadFile(file, { folder: 'profiles' })
      const res = await api.patch(`/employees/${id}/profile-photo`, {
        profilePhoto: uploaded.url,
      })
      const nextPhoto = res.data?.employee?.profilePhoto || uploaded.url
      setProfile((prev) =>
        prev?.employee
          ? { ...prev, employee: { ...prev.employee, profilePhoto: nextPhoto } }
          : prev
      )
      if (isSelfProfile && updateUser) updateUser({ profilePhoto: nextPhoto })
      setPhotoMessage('Profile photo updated.')
    } catch (err) {
      setPhotoMessage(err.response?.data?.message || err.message || 'Failed to upload photo')
    } finally {
      setPhotoUploading(false)
      e.target.value = ''
    }
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true)
        const res = await api.get(`/employees/${id}/profile`, {
          params: { month: selectedMonth || currentMonthValue() },
        })
        setProfile(res.data)
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchProfile()
  }, [id, selectedMonth])

  useEffect(() => {
    const fetchAssignedAssets = async () => {
      if (!id) return
      try {
        const res = await api.get('/assets', { params: { employeeId: id } })
        setAssignedAssets(Array.isArray(res.data) ? res.data : [])
      } catch {
        setAssignedAssets([])
      }
    }
    fetchAssignedAssets()
  }, [id])

  const derived = useMemo(() => {
    if (!profile?.employee) return null
    const e = profile.employee
    const docs = e.documents || {}
    const payroll = e.salaryPayroll || {}
    const skills = e.skills || {}
    const assets = e.assets || {}
    const access = profile.access || e.access || {}
    const notes = e.notes || {}
    const performance = e.performance || {}
    const attendance = profile.attendance || {}
    const records = attendance.records || []

    const halfDays = records.filter((a) => a.status === 'Half Day').length
    const docCount = Object.values(docs).filter(Boolean).length
    const assetCount = Object.values(assets).filter(Boolean).length
    const leaveBalanceTotal = Object.values(attendance.leaveBalance || {}).reduce((s, v) => s + (Number(v) || 0), 0)
    const latestReview = performance.reviews?.[performance.reviews.length - 1]
    const rating = latestReview?.rating || performance.appraisalHistory?.slice(-1)?.[0]?.score || 0
    const taskRating = profile.taskRatingPerformance || {}
    const taskAvgRating = taskRating.averageRating ?? null
    const assignedTasks = taskRating.assignedTasks?.length
      ? taskRating.assignedTasks
      : (profile.tasks || []).map((t) => ({
          taskId: t._id,
          title: t.title,
          projectName: t.project?.projectName || '',
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate,
          completedAt: t.completedAt,
          estimatedDurationMinutes: t.estimatedDurationMinutes,
          ratingScore: t.rating?.score ?? null,
          ratingComments: t.rating?.comments || '',
          ratedAt: t.rating?.ratedAt || null,
          ratedByName: t.rating?.ratedBy?.name || '',
        }))

    const activities = [
      ...(notes.activityLog || []).map((a) => ({ date: a.date, text: a.action, by: a.by })),
      ...(notes.profileUpdateHistory || []).map((u) => ({ date: u.date, text: `Profile updated — ${u.field}`, by: u.updatedBy })),
      ...(notes.documentUploadHistory || []).map((d) => ({ date: d.date, text: `Document uploaded — ${d.document}`, by: d.uploadedBy })),
      ...(attendance.leaveHistory || []).map((l) => ({ date: l.createdAt || l.startDate, text: `Leave applied — ${l.leaveType}`, by: e.name })),
      { date: e.updatedAt, text: 'Profile updated', by: 'System' },
    ].filter((a) => a.date).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6)

    return { e, docs, payroll, skills, assets, access, notes, performance, attendance, halfDays, docCount, assetCount, leaveBalanceTotal, rating, taskRating, taskAvgRating, assignedTasks, latestReview, activities }
  }, [profile])

  if (loading) return <div className='p-8 text-sm text-gray-600'>Loading employee profile...</div>
  if (error) return <div className='p-8 text-sm text-red-600'>{error}</div>
  if (!derived) return <div className='p-8 text-sm text-gray-600'>Employee not found.</div>

  const { e, docs, payroll, skills, assets, access, notes, performance, attendance, halfDays, docCount, assetCount, leaveBalanceTotal, rating, taskRating, taskAvgRating, assignedTasks, latestReview, activities } = derived
  const empStatus = e.employmentStatus || e.status || 'Active'

  const goTab = (tab) => setActiveTab(tab)

  const overviewGrid = (
    <div className='grid grid-cols-1 xl:grid-cols-2 gap-5'>
      <InfoCard title='Personal Information' icon={<CardIcon><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z' /></svg></CardIcon>} actionLabel='View More' onAction={() => goTab('Employment')}>
        <DetailRow label='Full Name' value={val(e.name)} />
        <DetailRow label='Gender' value={val(e.gender)} />
        <DetailRow label='Date of Birth' value={formatDate(e.dateOfBirth)} />
        <DetailRow label='Marital Status' value={val(e.maritalStatus)} />
        <DetailRow label='Blood Group' value={val(e.bloodGroup)} />
        <DetailRow label='Personal Email' value={val(e.personalEmail)} />
        <DetailRow label='Personal Mobile' value={val(e.personalMobile)} />
      </InfoCard>

      <InfoCard title='Employment Information' icon={<CardIcon><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M20.25 14.15v4.25c0 .414-.336.75-.75.75h-4.5a.75.75 0 0 1-.75-.75v-4.25m0 0h4.125c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9m9 3.75V6.75a3 3 0 0 0-3-3H5.25a3 3 0 0 0-3 3v9.75c0 .621.504 1.125 1.125 1.125h4.125' /></svg></CardIcon>} actionLabel='View More' onAction={() => goTab('Employment')}>
        <DetailRow label='Department' value={val(e.department)} />
        <DetailRow label='Designation' value={val(e.designation?.title)} />
        <DetailRow label='Employee Type' value={val(e.employeeType)} />
        <DetailRow label='Joining Date' value={formatDate(e.dateOfJoining)} />
        <DetailRow label='Probation End Date' value={formatDate(e.probationEndDate)} />
        <DetailRow label='Reporting To' value={val(e.reportingManager?.name)} />
        <DetailRow label='Employment Status' value={empStatus} badge />
        <DetailRow label='Work Location' value={val(e.workLocation)} />
      </InfoCard>

      <InfoCard title='Contact Information' icon={<CardIcon><PhoneIcon /></CardIcon>} actionLabel='View More' onAction={() => goTab('Employment')}>
        <p className='text-xs font-semibold text-gray-500 uppercase mb-2'>Current Address</p>
        <p className='text-sm text-gray-800 mb-4'>{val(e.currentAddress)}</p>
        <p className='text-xs font-semibold text-gray-500 uppercase mb-2'>Emergency Contact</p>
        <DetailRow label='Name' value={val(e.emergencyContact?.name)} />
        <DetailRow label='Relationship' value={val(e.emergencyContact?.relationship)} />
        <DetailRow label='Mobile' value={val(e.emergencyContact?.number)} />
      </InfoCard>

      <InfoCard title='Salary Information' icon={<CardIcon><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' /></svg></CardIcon>} actionLabel='View More' onAction={() => goTab('Payroll')}>
        <DetailRow label='Monthly CTC' value={money(payroll.monthlyCTC || payroll.ctc || e.salary)} />
        <DetailRow label='Basic Salary' value={money(payroll.basicSalary)} />
        <DetailRow label='HRA' value={money(payroll.hra)} />
        <DetailRow label='Net Salary' value={money(payroll.netSalary)} />
        <DetailRow label='PF Number' value={val(payroll.pfNumber)} />
      </InfoCard>

      <InfoCard title='Attendance Summary' icon={<CardIcon><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5' /></svg></CardIcon>} actionLabel='View More' onAction={() => goTab('Attendance & Leave')}>
        <p className='text-xs text-gray-500 mb-3'>Current Month Summary</p>
        <div className='grid grid-cols-2 sm:grid-cols-4 gap-3'>
          <StatBox label='Present Days' value={attendance.summary?.presentDays ?? 0} color='green' />
          <StatBox label='Absent Days' value={attendance.summary?.absentDays ?? 0} color='red' />
          <StatBox label='Late Marks' value={attendance.summary?.lateMarks ?? 0} color='orange' />
          <StatBox label='Half Days' value={halfDays} color='yellow' />
        </div>
      </InfoCard>

      <InfoCard title='Performance Overview' icon={<CardIcon><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z' /></svg></CardIcon>} actionLabel='View More' onAction={() => goTab('Performance')}>
        <p className='text-xs text-gray-500 mb-2'>HR Review Rating</p>
        <div className='flex items-center gap-3 mb-4'>
          <StarRating rating={rating} />
          <span className='text-lg font-bold text-gray-900'>{rating ? `${rating} / 5` : '—'}</span>
        </div>
        <p className='text-xs text-gray-500 mb-2'>Avg Task Rating</p>
        <div className='flex items-center gap-3 mb-4'>
          <StarRating rating={taskAvgRating || 0} />
          <span className='text-lg font-bold text-gray-900'>
            {taskAvgRating != null ? `${taskAvgRating} / 5` : '—'}
          </span>
          {taskRating.ratedTaskCount > 0 && (
            <span className='text-xs text-gray-500'>({taskRating.ratedTaskCount} rated)</span>
          )}
        </div>
        <DetailRow label='Rated Tasks' value={taskRating.ratedTaskCount ? `${taskRating.ratedTaskCount} of ${taskRating.totalAssignedTasks || 0}` : '—'} />
        <DetailRow label='Last Review' value={formatDate(latestReview?.date || performance.appraisalHistory?.slice(-1)?.[0]?.date)} />
        <DetailRow label='Next Review' value='—' />
      </InfoCard>
    </div>
  )

  const tabContent = {
    Overview: overviewGrid,
    Employment: (
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
        <InfoCard title='Employment Details'>
          <DetailRow label='Designation' value={val(e.designation?.title)} />
          <DetailRow label='Department' value={val(e.department)} />
          <DetailRow label='Employee Type' value={val(e.employeeType)} />
          <DetailRow label='Joining Date' value={formatDate(e.dateOfJoining)} />
          <DetailRow label='Probation End Date' value={formatDate(e.probationEndDate)} />
          <DetailRow label='Reporting Manager' value={val(e.reportingManager?.name)} />
          <DetailRow label='Work Location' value={val(e.workLocation)} />
          <DetailRow label='Work Shift' value={val(e.workShift || e.workingHours)} />
          <DetailRow label='Attendance Policy' value={val(e.attendancePolicy)} />
        </InfoCard>
        <InfoCard title='Official Information'>
          <DetailRow label='Official Email' value={val(e.email)} />
          <DetailRow label='Official Mobile' value={val(e.officialMobile)} />
          <DetailRow label='Company ID Card' value={val(e.companyIdCardNumber)} />
          <DetailRow label='Employee Code' value={val(e.employeeCode)} />
          <DetailRow label='CRM Role' value={val(access.crmRole || e.designation?.title)} />
        </InfoCard>
        <InfoCard title='Assigned Projects' className='lg:col-span-2'>
          {profile.assignedProjects?.length ? (
            <div className='space-y-2'>
              {profile.assignedProjects.map((p) => (
                <button key={p._id} type='button' onClick={() => navigate(`/projects/${p._id}/dashboard`)} className='w-full text-left flex flex-wrap justify-between gap-2 px-3 py-2 rounded-lg border border-gray-100 hover:bg-blue-50'>
                  <span className='font-medium text-blue-700'>{p.projectName}</span>
                  <span className='text-sm text-gray-500'>{p.role} · {p.status} · {p.progress ?? 0}%</span>
                </button>
              ))}
            </div>
          ) : <p className='text-sm text-gray-500'>No projects assigned.</p>}
        </InfoCard>
      </div>
    ),
    Documents: (
      <DocumentsPanel docs={docs} onPreview={setDocPreview} />
    ),
    Payroll: (() => {
      const struct = getSalaryStructure(payroll)
      return (
        <div className='space-y-6'>
          <InfoCard title='Salary Breakdown & CTC'>
            <div className='grid grid-cols-1 md:grid-cols-3 gap-4 mb-6'>
              <div className='p-3.5 bg-green-50 rounded-xl border border-green-200 text-center'>
                <span className='text-xs font-semibold text-green-700 uppercase tracking-wide block'>Net Salary</span>
                <span className='text-xl font-bold text-green-900 mt-1 block'>{money(struct.netSalary)}</span>
              </div>
              <div className='p-3.5 bg-blue-50 rounded-xl border border-blue-200 text-center'>
                <span className='text-xs font-semibold text-blue-700 uppercase tracking-wide block'>Monthly CTC</span>
                <span className='text-xl font-bold text-blue-900 mt-1 block'>{money(struct.monthlyCTC)}</span>
              </div>
              <div className='p-3.5 bg-purple-50 rounded-xl border border-purple-200 text-center'>
                <span className='text-xs font-semibold text-purple-700 uppercase tracking-wide block'>Annual CTC</span>
                <span className='text-xl font-bold text-purple-900 mt-1 block'>{money(struct.annualCTC)}</span>
              </div>
            </div>

            <h4 className='text-xs font-bold text-gray-700 uppercase tracking-wider mb-2'>Earnings Components</h4>
            <div className='grid grid-cols-2 md:grid-cols-3 gap-3 mb-5'>
              {struct.components.map((c) => (
                <div key={c.code} className='p-2.5 bg-gray-50 rounded-lg border border-gray-100'>
                  <span className='text-xs text-gray-500 block'>{c.name}</span>
                  <span className='text-sm font-semibold text-gray-900'>{money(c.amount)}</span>
                </div>
              ))}
            </div>

            <h4 className='text-xs font-bold text-gray-700 uppercase tracking-wider mb-2'>Employee Deductions</h4>
            <div className='grid grid-cols-3 gap-3 mb-5'>
              {struct.deductions.map((d) => (
                <div key={d.code} className='p-2.5 bg-red-50/50 rounded-lg border border-red-100'>
                  <span className='text-xs text-red-600 block'>{d.name}</span>
                  <span className='text-sm font-semibold text-red-900'>{money(d.amount)}</span>
                </div>
              ))}
            </div>

            <h4 className='text-xs font-bold text-gray-700 uppercase tracking-wider mb-2'>Employer Contributions</h4>
            <div className='grid grid-cols-2 gap-3 mb-5'>
              {struct.employerContributions.map((ec) => (
                <div key={ec.code} className='p-2.5 bg-blue-50/50 rounded-lg border border-blue-100'>
                  <span className='text-xs text-blue-600 block'>{ec.name}</span>
                  <span className='text-sm font-semibold text-blue-900'>{money(ec.amount)}</span>
                </div>
              ))}
            </div>

            <div className='grid grid-cols-1 md:grid-cols-2 gap-x-8 pt-4 border-t border-gray-100'>
              <DetailRow label='PAN Number' value={val(payroll.panNumber)} />
              <DetailRow label='PF Number' value={val(payroll.pfNumber)} />
              <DetailRow label='ESIC Number' value={val(payroll.esicNumber)} />
              <DetailRow label='UAN Number' value={val(payroll.uanNumber)} />
              <DetailRow label='Tax Information' value={val(payroll.taxInformation)} />
              <DetailRow label='Bank Account Details' value={val(payroll.bankAccountDetails)} />
            </div>

            {profile.salaries?.length > 0 && (
              <div className='mt-6 overflow-x-auto'>
                <h4 className='text-xs font-bold text-gray-700 uppercase tracking-wider mb-2'>Payment History</h4>
                <table className='w-full text-sm'>
                  <thead><tr className='border-b text-gray-500'><th className='py-2 text-left'>Month/Year</th><th className='py-2 text-left'>Gross Amount</th><th className='py-2 text-left'>Status</th></tr></thead>
                  <tbody>
                    {profile.salaries.map((s) => (
                      <tr key={s._id} className='border-b'><td className='py-2'>{s.month}/{s.year}</td><td className='py-2'>{money(s.grossSalary || s.amount)}</td><td className='py-2'>{s.status}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </InfoCard>
        </div>
      )
    })(),
    'Attendance & Leave': (
      <div className='grid grid-cols-1 lg:grid-cols-2 gap-5'>
        <InfoCard title='Attendance Summary'>
          <div className='grid grid-cols-2 gap-3 mb-4'>
            <StatBox label='Present Days' value={attendance.summary?.presentDays ?? 0} color='green' />
            <StatBox label='Absent Days' value={attendance.summary?.absentDays ?? 0} color='red' />
            <StatBox label='Late Marks' value={attendance.summary?.lateMarks ?? 0} color='orange' />
            <StatBox label='Half Days' value={halfDays} color='yellow' />
          </div>
          <DetailRow label='Sick Leave Balance' value={attendance.leaveBalance?.sick ?? '—'} />
          <DetailRow label='Casual Leave Balance' value={attendance.leaveBalance?.casual ?? '—'} />
          <DetailRow label='Annual Leave Balance' value={attendance.leaveBalance?.annual ?? '—'} />
        </InfoCard>
        <InfoCard title='Leave History'>
          {attendance.leaveHistory?.length ? attendance.leaveHistory.map((l) => (
            <div key={l._id} className='py-2 border-b border-gray-50 text-sm'>
              <p className='font-medium'>{l.leaveType} — {l.status}</p>
              <p className='text-gray-500'>{formatDate(l.startDate)} to {formatDate(l.endDate)}</p>
            </div>
          )) : <p className='text-sm text-gray-500'>No leave records.</p>}
        </InfoCard>
      </div>
    ),
    Performance: (
      <div className='space-y-5'>
        <InfoCard title='HR Performance Reviews'>
          <DetailRow label='Current Review Rating' value={rating ? `${rating} / 5` : '—'} />
          {(performance.kpis || []).map((k, i) => <DetailRow key={i} label={`KPI ${i + 1}`} value={k} />)}
          {(performance.reviews || []).map((r, i) => <DetailRow key={i} label={`Review ${formatDate(r.date)}`} value={`Rating ${r.rating}: ${r.comments || ''}`} />)}
          {(performance.goals || []).map((g, i) => <DetailRow key={i} label={`Goal ${i + 1}`} value={`${g.title} (${g.status})`} />)}
          {!performance.kpis?.length && !performance.reviews?.length && !performance.goals?.length && (
            <p className='text-sm text-gray-500'>No HR review data yet.</p>
          )}
        </InfoCard>

        <InfoCard title='Assigned Tasks & Ratings'>
          <div className='flex flex-wrap items-center justify-between gap-4 mb-5 p-4 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100'>
            <div>
              <p className='text-xs font-semibold text-blue-700 uppercase tracking-wide'>Average Task Rating</p>
              <div className='flex items-center gap-3 mt-2'>
                <StarRating rating={taskAvgRating || 0} />
                <span className='text-2xl font-bold text-gray-900'>
                  {taskAvgRating != null ? `${taskAvgRating} / 5` : '—'}
                </span>
              </div>
              <p className='text-xs text-gray-500 mt-1'>
                Calculated from {taskRating.ratedTaskCount ?? 0} rated task{taskRating.ratedTaskCount === 1 ? '' : 's'}
                {' '}out of {assignedTasks.length} assigned
              </p>
            </div>
            <div className='grid grid-cols-2 gap-3'>
              <StatBox label='Assigned' value={assignedTasks.length} color='blue' />
              <StatBox label='Rated' value={taskRating.ratedTaskCount ?? 0} color='green' />
            </div>
          </div>

          {assignedTasks.length ? (
            <div className='overflow-x-auto rounded-lg border border-gray-200'>
              <table className='w-full text-sm'>
                <thead className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase'>
                  <tr>
                    <th className='px-4 py-3'>Task</th>
                    <th className='px-4 py-3'>Project</th>
                    <th className='px-4 py-3'>Status</th>
                    <th className='px-4 py-3'>Due Date</th>
                    <th className='px-4 py-3'>Duration</th>
                    <th className='px-4 py-3'>Rating</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-100'>
                  {assignedTasks.map((task) => (
                    <tr key={task.taskId} className='hover:bg-gray-50/80'>
                      <td className='px-4 py-3'>
                        <p className='font-medium text-gray-900'>{task.title}</p>
                        {task.ratingComments && (
                          <p className='text-xs text-gray-500 mt-1 line-clamp-2'>&ldquo;{task.ratingComments}&rdquo;</p>
                        )}
                      </td>
                      <td className='px-4 py-3 text-gray-600'>{task.projectName || '—'}</td>
                      <td className='px-4 py-3'>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${taskStatusClass(task.status)}`}>
                          {task.status || 'Pending'}
                        </span>
                      </td>
                      <td className='px-4 py-3 text-gray-600 whitespace-nowrap'>{formatDate(task.dueDate)}</td>
                      <td className='px-4 py-3 text-gray-600 whitespace-nowrap'>{formatDuration(task.estimatedDurationMinutes)}</td>
                      <td className='px-4 py-3'>
                        {task.ratingScore ? (
                          <div>
                            <div className='flex items-center gap-1.5'>
                              <StarRating rating={task.ratingScore} />
                              <span className='text-sm font-bold text-gray-900'>{task.ratingScore}/5</span>
                            </div>
                            {task.ratedByName && (
                              <p className='text-[10px] text-gray-400 mt-1'>
                                by {task.ratedByName}
                                {task.ratedAt ? ` · ${formatDate(task.ratedAt)}` : ''}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className='text-xs text-gray-400'>Not rated</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className='text-sm text-gray-500 py-6 text-center'>No tasks assigned to this employee yet.</p>
          )}
        </InfoCard>
      </div>
    ),
    Skills: (
      <InfoCard title='Skills & Certifications'>
        <DetailRow label='Skills' value={skills.skills?.join(', ') || '—'} />
        <DetailRow label='Technologies' value={skills.technologies?.join(', ') || '—'} />
        <DetailRow label='Languages' value={skills.languages?.join(', ') || '—'} />
        {(skills.certifications || []).map((c, i) => <DetailRow key={i} label='Certification' value={`${c.name} — ${c.issuer || ''}`} />)}
        {(skills.trainingCompleted || []).map((t, i) => <DetailRow key={i} label='Training' value={`${t.title} — ${formatDate(t.date)}`} />)}
      </InfoCard>
    ),
    Assets: (
      <div className='space-y-5'>
        {assignedAssets.length > 0 && (
          <InfoCard title='Company Assets'>
            <div className='overflow-x-auto -mx-1'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='text-left text-xs font-semibold text-gray-500 uppercase border-b border-gray-100'>
                    <th className='py-2 pr-3'>Asset</th>
                    <th className='py-2 pr-3'>Type</th>
                    <th className='py-2 pr-3'>Tag</th>
                    <th className='py-2'>Assigned On</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-50'>
                  {assignedAssets.map((asset) => (
                    <tr key={asset._id}>
                      <td className='py-2.5 pr-3 font-medium text-gray-900'>{asset.name}</td>
                      <td className='py-2.5 pr-3 text-gray-600'>{asset.assetType}</td>
                      <td className='py-2.5 pr-3 font-mono text-xs text-gray-500'>{asset.assetTag || '—'}</td>
                      <td className='py-2.5 text-gray-600'>{formatDate(asset.assignedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </InfoCard>
        )}
        <InfoCard title='Asset Records'>
          <DetailRow label='Laptop' value={val(assets.laptop)} />
          <DetailRow label='Desktop' value={val(assets.desktop)} />
          <DetailRow label='Mobile Phone' value={val(assets.mobilePhone)} />
          <DetailRow label='SIM Card' value={val(assets.simCard)} />
          <DetailRow label='Access Cards' value={val(assets.accessCards)} />
          <DetailRow label='Other Assets' value={val(assets.other)} />
        </InfoCard>
      </div>
    ),
    'Access & Permissions': (
      <InfoCard title='Access & Permissions'>
        <DetailRow label='CRM Role' value={val(access.crmRole)} />
        <DetailRow label='Permissions' value={access.permissions?.join(', ') || '—'} />
        <DetailRow label='Last Login' value={formatDateTime(access.lastLogin)} />
        <DetailRow label='Account Status' value={val(access.accountStatus)} badge />
        {(access.loginHistory || []).map((l, i) => <DetailRow key={i} label='Login' value={`${formatDateTime(l.date)} — ${l.ip || 'N/A'}`} />)}
      </InfoCard>
    ),
    'Activity Log': (
      <InfoCard title='Notes & Activity Log'>
        <DetailRow label='HR Notes' value={val(notes.hrNotes)} />
        <DetailRow label='Employee Remarks' value={val(notes.employeeRemarks)} />
        <div className='mt-4 space-y-3'>
          {activities.length ? activities.map((a, i) => (
            <div key={i} className='flex gap-3'>
              <div className='w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0' />
              <div>
                <p className='text-sm font-medium text-gray-900'>{a.text}</p>
                <p className='text-xs text-gray-500'>{a.by || 'System'} · {formatDateTime(a.date)}</p>
              </div>
            </div>
          )) : <p className='text-sm text-gray-500'>No activity recorded.</p>}
        </div>
      </InfoCard>
    ),
  }

  return (
    <div className='p-4 sm:p-6 md:p-8 bg-gray-50 min-h-full overflow-x-hidden'>
      <div className='w-full max-w-full min-w-0'>
        {/* Page header */}
        <div className='flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-4 sm:mb-6'>
          <div className='min-w-0'>
            {isSelfProfile && (
              <nav className='text-sm text-gray-500 mb-2'>
                <span className='text-gray-900 font-medium'>My Workspace</span>
                <span className='mx-2 text-gray-300'>›</span>
                <span className='text-gray-900 font-medium'>My Profile</span>
              </nav>
            )}
            <h1 className='text-xl sm:text-2xl font-bold text-gray-900'>{isSelfProfile ? 'My Profile' : 'Employee Profile'}</h1>
            {isSelfProfile && (
              <p className='text-sm text-gray-500 mt-1'>
                Monthly view of employment, payroll, attendance, and performance.
                {profile?.monthLabel ? (
                  <span className='text-gray-400'> · Showing {profile.monthLabel}</span>
                ) : null}
              </p>
            )}
            {!isSelfProfile && profile?.monthLabel ? (
              <p className='text-sm text-gray-500 mt-1'>Showing data for {profile.monthLabel}</p>
            ) : null}
          </div>
          <div className='flex flex-wrap items-center gap-2 w-full sm:w-auto'>
            <div className='flex items-center gap-2 w-full sm:w-auto'>
              <label htmlFor='profile-month' className='text-sm font-medium text-gray-700 shrink-0'>
                Month
              </label>
              <input
                id='profile-month'
                type='month'
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value || currentMonthValue())}
                className='flex-1 sm:flex-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'
              />
            </div>
            {!isSelfProfile && (
              <>
                <button type='button' className='flex-1 sm:flex-none px-4 py-2 text-sm font-medium border border-gray-300 bg-white rounded-lg hover:bg-gray-50'>
                  Generate ID Card
                </button>
                <button type='button' onClick={() => navigate(`/employees/edit/${id}`)} className='flex-1 sm:flex-none px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700'>
                  Edit Profile
                </button>
                <button type='button' onClick={() => navigate('/employees')} className='w-full sm:w-auto px-4 py-2 text-sm font-medium bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100'>
                  Back to List
                </button>
              </>
            )}
            {isSelfProfile && (
              <button
                type='button'
                onClick={() => navigate(getDashboardPath())}
                className='w-full sm:w-auto px-4 py-2 text-sm font-medium border border-gray-300 bg-white rounded-lg hover:bg-gray-50'
              >
                Back to Dashboard
              </button>
            )}
          </div>
        </div>

        {/* Hero card */}
        <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-6 mb-6 overflow-hidden'>
          <div className='flex flex-col gap-5 min-w-0'>
            <div className='flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5 text-center sm:text-left min-w-0'>
              <div className='flex flex-col items-center gap-2 shrink-0'>
                <div className='relative w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-3xl font-bold overflow-hidden border-4 border-white shadow-md'>
                  {e.profilePhoto ? (
                    <img src={e.profilePhoto} alt={e.name} className='w-full h-full object-cover' />
                  ) : (
                    (e.name || '?').charAt(0).toUpperCase()
                  )}
                  {photoUploading ? (
                    <div className='absolute inset-0 bg-black/40 flex items-center justify-center text-white text-xs font-medium'>
                      Uploading…
                    </div>
                  ) : null}
                </div>
                {isSelfProfile ? (
                  <>
                    <input
                      ref={photoInputRef}
                      type='file'
                      accept='image/*'
                      className='hidden'
                      onChange={handleProfilePhotoUpload}
                    />
                    <button
                      type='button'
                      disabled={photoUploading}
                      onClick={() => photoInputRef.current?.click()}
                      className='px-3 py-1.5 text-xs font-medium rounded-lg border border-blue-600 text-blue-700 hover:bg-blue-50 disabled:opacity-60'
                    >
                      {e.profilePhoto ? 'Change photo' : 'Upload photo'}
                    </button>
                    {photoMessage ? (
                      <p
                        className={`text-xs text-center max-w-[11rem] ${
                          photoMessage.includes('updated') ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {photoMessage}
                      </p>
                    ) : null}
                  </>
                ) : null}
              </div>

              <div className='flex-1 min-w-0 w-full'>
                <div className='flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 mb-1'>
                  <h2 className='text-xl sm:text-2xl font-bold text-gray-900 break-words'>{e.name}</h2>
                  <StatusBadge status={empStatus} />
                </div>
                <p className='text-blue-600 font-medium break-words'>{e.designation?.title || e.designation?.name || e.designation || '—'}</p>
                <p className='text-sm text-gray-500 mt-1 break-words'>{val(e.department)}</p>
                <div className='flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-x-4 sm:gap-y-2 mt-4 text-sm text-gray-600'>
                  <span className='inline-flex items-start gap-1.5 min-w-0'>
                    <span className='shrink-0 mt-0.5'><MailIcon /></span>
                    <span className='break-all min-w-0'>{val(e.email)}</span>
                  </span>
                  <span className='inline-flex items-start gap-1.5 min-w-0'>
                    <span className='shrink-0 mt-0.5'><PhoneIcon /></span>
                    <span className='break-words min-w-0'>{val(e.officialMobile || e.personalMobile)}</span>
                  </span>
                  <span className='inline-flex items-start gap-1.5 min-w-0'>
                    <span className='shrink-0 mt-0.5'><LocationIcon /></span>
                    <span className='break-words min-w-0'>{val(e.workLocation || e.currentAddress)}</span>
                  </span>
                </div>
              </div>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-0 pt-4 border-t border-gray-100 min-w-0 text-sm'>
              <DetailRow label='Department' value={val(e.department)} />
              <DetailRow label='Employee ID' value={val(e.employeeCode || e._id)} />
              <DetailRow label='Reporting To' value={val(e.reportingManager?.name)} />
              <DetailRow label='Date of Birth' value={formatDate(e.dateOfBirth)} />
              <DetailRow label='Joining Date' value={formatDate(e.dateOfJoining)} />
              <DetailRow label='Gender' value={val(e.gender)} />
              <DetailRow label='Employment Type' value={val(e.employeeType)} />
              <DetailRow label='Marital Status' value={val(e.maritalStatus)} />
              <DetailRow label='Work Location' value={val(e.workLocation)} />
              <DetailRow label='Blood Group' value={val(e.bloodGroup)} />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className='bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-x-auto'>
          <div className='flex min-w-max px-2'>
            {TABS.map((tab) => (
              <button
                key={tab}
                type='button'
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Content + sidebar */}
        <div className='grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6'>
          <div>{tabContent[activeTab]}</div>

          <div className='space-y-5'>
            <InfoCard title='Quick Summary' icon={<CardIcon><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z' /></svg></CardIcon>}>
              <DetailRow label='Leave Balance' value={`${leaveBalanceTotal} Days`} />
              <DetailRow label='Present This Month' value={`${attendance.summary?.presentDays ?? 0} Days`} />
              <DetailRow label='Performance Rating' value={rating ? `${rating} / 5` : '—'} />
              <DetailRow label='Avg Task Rating' value={taskAvgRating != null ? `${taskAvgRating} / 5` : '—'} />
              <DetailRow label='Rated Tasks' value={`${taskRating.ratedTaskCount ?? 0} / ${assignedTasks.length}`} />
              <DetailRow label='Documents' value={`${docCount} Files`} />
              <DetailRow label='Assets Assigned' value={`${assignedAssets.length || assetCount} Items`} />
              <DetailRow label='Assigned Projects' value={profile.assignedProjects?.length ?? 0} />
              <DetailRow label='Assigned Tasks' value={assignedTasks.length} />
            </InfoCard>

            <InfoCard title='Recent Activity' icon={<CardIcon><svg className='w-4 h-4' fill='none' viewBox='0 0 24 24' stroke='currentColor'><path strokeLinecap='round' strokeLinejoin='round' strokeWidth={1.5} d='M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z' /></svg></CardIcon>}>
              <div className='space-y-4'>
                {activities.length ? activities.map((a, i) => (
                  <div key={i} className='flex gap-3'>
                    <div className='flex flex-col items-center'>
                      <div className='w-2.5 h-2.5 rounded-full bg-blue-500' />
                      {i < activities.length - 1 && <div className='w-px flex-1 bg-gray-200 mt-1' />}
                    </div>
                    <div className='pb-2'>
                      <p className='text-sm font-medium text-gray-900'>{a.text}</p>
                      <p className='text-xs text-gray-500 mt-0.5'>{a.by || 'System'}</p>
                      <p className='text-xs text-gray-400'>{formatDate(a.date)}</p>
                    </div>
                  </div>
                )) : <p className='text-sm text-gray-500'>No recent activity.</p>}
              </div>
            </InfoCard>
          </div>
        </div>
      </div>
      <DocumentPreviewModal preview={docPreview} onClose={() => setDocPreview(null)} />
    </div>
  )
}

export default EmployeeProfileView
