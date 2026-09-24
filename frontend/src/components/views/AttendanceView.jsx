import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts'
import api from '../../api/axios'
import { useAuth } from '../../context/AuthContext'
import {
  formatCoords,
  getCurrentLocation,
  getMapsUrl,
  isCoordOnlyAddress,
  locationErrorMessage,
  resolveAddressFromCoords,
} from '../../utils/geolocation'
import { getLateAfterLabel, isLateCheckIn } from '../../utils/attendanceLate'
import { formatCheckInDevice, getCheckInDeviceInfo } from '../../utils/deviceInfo'
import { notifyBreakEndingSoon, notifyBreakStarted } from '../../utils/breakTimeAlert'

const getDesignationTitle = (employee) =>
  employee?.designation?.title || employee?.designation?.name || employee?.designation || employee?.department || '—'

const LATE_AFTER_LABEL = getLateAfterLabel()
const UNDO_CHECKOUT_MS = 2 * 60 * 1000
const CHART_COLORS = ['#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#3b82f6']

const formatTime = (ms) => {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
}

const formatClock = (date = new Date()) =>
  date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

const formatMinutesAsHours = (minutes) => {
  const safeMinutes = Number(minutes) || 0
  return (safeMinutes / 60).toFixed(1)
}

const trackedMinutesFromRow = (row, startedAtKey, totalMinutesKey, nowMs = Date.now()) => {
  const savedMinutes = Number(row?.[totalMinutesKey]) || 0
  const startedAt = row?.[startedAtKey]
  if (!startedAt) return savedMinutes
  const startMs = new Date(startedAt).getTime()
  if (Number.isNaN(startMs)) return savedMinutes
  const liveMinutes = Math.max(0, (nowMs - startMs) / (1000 * 60))
  return savedMinutes + liveMinutes
}

const formatAttendanceTime = (value) => {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

const formatDateLabel = (dateStr) => {
  if (!dateStr) return ''
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const getTodayDateKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const toDateKey = (value) => {
  const d = new Date(value)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const getCurrentMonthKey = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const getDaysInMonth = (monthKey) => {
  const [y, m] = monthKey.split('-').map(Number)
  const count = new Date(y, m, 0).getDate()
  return Array.from({ length: count }, (_, i) => {
    const day = i + 1
    return `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  })
}

const csvEscape = (value) => {
  const s = String(value ?? '')
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

const formatDurationHours = (row) => {
  const ms = durationMsFromRow(row)
  if (ms == null) return ''
  return (ms / (1000 * 60 * 60)).toFixed(2)
}

const durationMsFromRow = (row, nowMs = Date.now()) => {
  if (!row?.checkIn) return null
  const start = new Date(row.checkIn).getTime()
  if (Number.isNaN(start)) return null
  const end = row.checkOut ? new Date(row.checkOut).getTime() : nowMs
  if (row.checkOut && Number.isNaN(end)) return null
  const breakMinutes = trackedMinutesFromRow(row, 'breakStartedAt', 'breakDurationMinutes', nowMs)
  return Math.max(0, end - start - (breakMinutes * 60 * 1000))
}

const hoursFromAttendanceRow = (row, nowMs = Date.now()) => {
  const ms = durationMsFromRow(row, nowMs)
  return ms == null ? 0 : ms / (1000 * 60 * 60)
}

const deriveLiveStatus = (attendance, onLeave) => {
  if (onLeave) return 'On Leave'
  if (!attendance?.checkIn) return 'Absent'
  if (isLateCheckIn(attendance.checkIn)) return 'Late'
  if (attendance.status === 'In Progress') return 'Present'
  if (attendance.status === 'Full Day' || attendance.status === 'Half Day') return 'Present'
  return attendance.status || 'Present'
}

const statusStyles = {
  Present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Late: 'bg-amber-50 text-amber-700 border-amber-200',
  Absent: 'bg-red-50 text-red-700 border-red-200',
  'On Leave': 'bg-violet-50 text-violet-700 border-violet-200',
  'In Progress': 'bg-blue-50 text-blue-700 border-blue-200',
  'Full Day': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Half Day': 'bg-amber-50 text-amber-700 border-amber-200',
}

const SummaryCard = ({ title, value, trend, icon, iconBg }) => (
  <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-4'>
    <div className='flex items-start justify-between gap-3'>
      <div>
        <p className='text-sm text-gray-500'>{title}</p>
        <p className='text-2xl font-bold text-gray-900 mt-1'>{value}</p>
        {trend && <p className='text-xs text-gray-400 mt-1'>{trend}</p>}
      </div>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${iconBg}`}>{icon}</div>
    </div>
  </div>
)

const StatusBadge = ({ status }) => {
  const label = status || '—'
  return (
    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusStyles[label] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
      {label}
    </span>
  )
}

const EmployeeAvatar = ({ employee }) => {
  const [imgError, setImgError] = useState(false)
  const name = employee?.name || '?'
  const photo = employee?.profilePhoto
  const showPhoto = Boolean(photo) && !imgError

  return (
    <div className='w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shrink-0 overflow-hidden border border-gray-200'>
      {showPhoto ? (
        <img
          src={photo}
          alt={name}
          className='w-full h-full object-cover'
          onError={() => setImgError(true)}
        />
      ) : (
        name.charAt(0).toUpperCase()
      )}
    </div>
  )
}

const LocationDisplay = ({ address, latitude, longitude, compact = false }) => {
  const lat = latitude ?? null
  const lon = longitude ?? null
  const mapsUrl = getMapsUrl(lat, lon)
  const coordsLabel = formatCoords(lat, lon)
  const label = address?.trim() || coordsLabel

  if (!label) return <span className='text-gray-400'>—</span>

  const content = (
    <span className={compact ? 'block' : ''}>
      <span className='block text-gray-800 leading-snug'>{label}</span>
      {address?.trim() && coordsLabel && (
        <span className='block text-[11px] text-gray-400 font-mono mt-0.5'>{coordsLabel}</span>
      )}
    </span>
  )

  if (!mapsUrl) return content

  return (
    <a
      href={mapsUrl}
      target='_blank'
      rel='noopener noreferrer'
      className='inline-flex items-start gap-1 text-blue-600 hover:text-blue-800 hover:underline max-w-[220px]'
      title='Open in Google Maps'
    >
      <span className='shrink-0 mt-0.5'>📍</span>
      {content}
    </a>
  )
}

function DurationCell({ row }) {
  const [now, setNow] = useState(() => Date.now())
  const isOpen = Boolean(row?.checkIn && !row.checkOut)

  useEffect(() => {
    if (!isOpen) return undefined
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isOpen])

  if (!row?.checkIn) return <span className='text-gray-400'>—</span>
  const ms = durationMsFromRow(row, now)
  if (ms == null) return <span className='text-gray-400'>—</span>
  return <span className='font-mono tabular-nums text-sm'>{formatTime(ms)}</span>
}

const AttendanceView = () => {
  const { user, isHRManager } = useAuth()
  const canViewTeam = isHRManager()

  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [viewMode, setViewMode] = useState('live')
  const viewModeInitializedRef = useRef(false)
  const [employees, setEmployees] = useState([])
  const [dayAttendances, setDayAttendances] = useState([])
  const [monthAttendances, setMonthAttendances] = useState([])
  const [leaves, setLeaves] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 7

  const [selectedEmployee, setSelectedEmployee] = useState('')
  const [checkInTime, setCheckInTime] = useState(null)
  const [checkInLockedDate, setCheckInLockedDate] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [liveClock, setLiveClock] = useState(() => new Date())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentLocation, setCurrentLocation] = useState({
    loading: true,
    latitude: null,
    longitude: null,
    address: '',
    accuracy: null,
    error: '',
  })
  const [refreshingLocation, setRefreshingLocation] = useState(false)
  const [breakTimeMinutes, setBreakTimeMinutes] = useState(45)
  const timerRef = useRef(null)
  const lastGeocodeRef = useRef({ lat: null, lon: null, at: 0 })
  const lastTimelinePushRef = useRef({ lat: null, lon: null, at: 0 })
  const addressBackfillRef = useRef(new Set())
  const breakEndingWarningRef = useRef(null)

  const isToday = selectedDate === getTodayDateKey()

  const myDayAttendance = useMemo(() => {
    if (!user?._id) return null
    return (
      dayAttendances.find((a) => String(a.employee?._id || a.employee) === String(user._id)) || null
    )
  }, [dayAttendances, user?._id])

  const myTodayAttendance = useMemo(() => {
    if (!isToday) return null
    return myDayAttendance
  }, [myDayAttendance, isToday])

  const hasCheckedInToday = Boolean(myTodayAttendance?.checkIn)
  const hasCheckedOutToday = Boolean(myTodayAttendance?.checkOut)
  const checkOutAtMs = myTodayAttendance?.checkOut
    ? new Date(myTodayAttendance.checkOut).getTime()
    : NaN
  const undoRemainingMs =
    hasCheckedOutToday && !Number.isNaN(checkOutAtMs)
      ? Math.max(0, UNDO_CHECKOUT_MS - (liveClock.getTime() - checkOutAtMs))
      : 0
  const canUndoCheckOut = isToday && hasCheckedOutToday && undoRemainingMs > 0
  const isCheckInLockedForToday = checkInLockedDate === getTodayDateKey()
  const isSessionActive = hasCheckedInToday && !hasCheckedOutToday
  const canCheckIn = isToday && !hasCheckedInToday && !isCheckInLockedForToday
  const canCheckOut = isToday && isSessionActive
  const isBreakActive = Boolean(myTodayAttendance?.breakStartedAt) && !hasCheckedOutToday
  const isMeetingActive = Boolean(myTodayAttendance?.meetingStartedAt) && !hasCheckedOutToday
  const liveBreakMinutes = trackedMinutesFromRow(myTodayAttendance, 'breakStartedAt', 'breakDurationMinutes')
  const liveMeetingMinutes = trackedMinutesFromRow(myTodayAttendance, 'meetingStartedAt', 'meetingDurationMinutes')
  const liveBreakMs = liveBreakMinutes * 60 * 1000
  const liveMeetingMs = liveMeetingMinutes * 60 * 1000
  const netWorkingMsToday = durationMsFromRow(myTodayAttendance, liveClock.getTime()) || 0
  const locationTimeline = useMemo(() => {
    const entries = Array.isArray(myDayAttendance?.locationTimeline) ? myDayAttendance.locationTimeline : []
    return entries.slice().sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }, [myDayAttendance?.locationTimeline])

  const fetchEmployees = useCallback(async () => {
    try {
      if (canViewTeam) {
        const res = await api.get('/employees')
        const payload = res.data
        setEmployees(Array.isArray(payload) ? payload : payload?.data || [])
        return
      }
      if (!user?._id) {
        setEmployees([])
        return
      }
      const res = await api.get(`/employees/${user._id}`)
      const emp = res.data?.employee || res.data
      setEmployees(emp?._id ? [emp] : [])
    } catch (err) {
      console.error('Failed to fetch employees:', err)
      if (user?._id) {
        setEmployees([{ _id: user._id, name: user.name, email: user.email, profilePhoto: user.profilePhoto }])
      }
    }
  }, [canViewTeam, user?._id, user?.name, user?.email, user?.profilePhoto])

  const fetchDayAttendance = useCallback(async () => {
    try {
      const params = { date: selectedDate }
      if (!canViewTeam && user?._id) params.employeeId = user._id
      const res = await api.get('/attendance/today', { params })
      setDayAttendances(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Failed to fetch day attendance:', err)
    }
  }, [selectedDate, canViewTeam, user?._id])

  const fetchMonthAttendance = useCallback(async () => {
    try {
      const params = { month: selectedMonth }
      const targetEmployeeId = canViewTeam ? (selectedEmployee || user?._id) : user?._id
      if (targetEmployeeId) params.employeeId = targetEmployeeId
      const res = await api.get('/attendance/by-month', { params })
      setMonthAttendances(Array.isArray(res.data) ? res.data : [])
    } catch (err) {
      console.error('Failed to fetch month attendance:', err)
    }
  }, [selectedMonth, canViewTeam, user?._id, selectedEmployee])

  const fetchLeaves = useCallback(async () => {
    try {
      const params = {}
      if (!canViewTeam && user?._id) params.employeeId = user._id
      const res = await api.get('/leave', { params })
      setLeaves(Array.isArray(res.data) ? res.data : [])
    } catch {
      setLeaves([])
    }
  }, [canViewTeam, user?._id])

  const syncActiveSessionFromServer = useCallback(async () => {
    if (!user?._id) return
    try {
      const res = await api.get('/attendance/today', {
        params: { employeeId: user._id, date: getTodayDateKey() },
      })
      const rows = Array.isArray(res.data) ? res.data : []
      const todayRecord = rows[0]
      if (todayRecord?.checkIn && !todayRecord?.checkOut) {
        const ci = new Date(todayRecord.checkIn)
        setCheckInTime(ci)
        setElapsedMs(Math.max(0, Date.now() - ci.getTime()))
      } else {
        setCheckInTime(null)
        setElapsedMs(0)
      }
    } catch {
      /* keep current */
    }
  }, [user?._id])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  useEffect(() => {
    fetchLeaves()
  }, [fetchLeaves])

  useEffect(() => {
    fetchDayAttendance()
  }, [fetchDayAttendance])

  useEffect(() => {
    fetchMonthAttendance()
  }, [fetchMonthAttendance])

  useEffect(() => {
    if (user?._id) setSelectedEmployee(user._id)
  }, [user?._id])

  useEffect(() => {
    if (!viewModeInitializedRef.current && canViewTeam) {
      setViewMode('monthly')
      viewModeInitializedRef.current = true
    }
  }, [canViewTeam])

  useEffect(() => {
    syncActiveSessionFromServer()
  }, [syncActiveSessionFromServer])

  useEffect(() => {
    const todayKey = getTodayDateKey()
    if (checkInLockedDate && checkInLockedDate !== todayKey) {
      setCheckInLockedDate('')
    }
  }, [checkInLockedDate, selectedDate])

  useEffect(() => {
    if (!isToday) return
    if (myTodayAttendance?.checkIn) {
      setCheckInLockedDate(getTodayDateKey())
    }
  }, [myTodayAttendance?.checkIn, isToday])

  useEffect(() => {
    if (!isToday) {
      setCheckInTime(null)
      setElapsedMs(0)
      return
    }
    if (myTodayAttendance?.checkIn && !myTodayAttendance?.checkOut) {
      const ci = new Date(myTodayAttendance.checkIn)
      setCheckInTime(ci)
      setElapsedMs(Math.max(0, Date.now() - ci.getTime()))
    } else if (!myTodayAttendance?.checkIn) {
      setCheckInTime(null)
      setElapsedMs(0)
    }
  }, [myTodayAttendance, isToday])

  useEffect(() => {
    const id = setInterval(() => setLiveClock(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false
    api.get('/company-profile')
      .then((res) => {
        if (cancelled) return
        const minutes = Number(res.data?.breakTimeMinutes ?? res.data?.breakTime)
        setBreakTimeMinutes(Number.isFinite(minutes) && minutes > 0 ? minutes : 45)
      })
      .catch(() => {
        if (!cancelled) setBreakTimeMinutes(45)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isToday || !isBreakActive || !myTodayAttendance?.breakStartedAt) {
      if (!isBreakActive) breakEndingWarningRef.current = null
      return
    }

    const allowedMinutes = breakTimeMinutes || 45
    if (allowedMinutes <= 5) return

    const breakKey = String(new Date(myTodayAttendance.breakStartedAt).getTime())
    const remainingMinutes = allowedMinutes - liveBreakMinutes

    if (remainingMinutes <= 5 && remainingMinutes > 0 && breakEndingWarningRef.current !== breakKey) {
      breakEndingWarningRef.current = breakKey
      notifyBreakEndingSoon({ remainingMinutes })
    }
  }, [
    isToday,
    isBreakActive,
    myTodayAttendance?.breakStartedAt,
    liveBreakMinutes,
    breakTimeMinutes,
  ])

  useEffect(() => {
    if (!checkInTime) return undefined
    const tick = () => setElapsedMs(Math.max(0, Date.now() - checkInTime.getTime()))
    tick()
    timerRef.current = setInterval(tick, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [checkInTime])

  useEffect(() => {
    setPage(1)
  }, [selectedDate, searchQuery, viewMode])

  const applyPosition = useCallback(async (pos) => {
    const latitude = Number(pos.coords.latitude)
    const longitude = Number(pos.coords.longitude)
    const accuracy = pos.coords.accuracy
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return

    setCurrentLocation((prev) => ({
      ...prev,
      loading: false,
      latitude,
      longitude,
      accuracy,
      error: '',
    }))

    const now = Date.now()
    const last = lastGeocodeRef.current
    const moved =
      last.lat == null ||
      Math.abs(latitude - last.lat) > 0.00025 ||
      Math.abs(longitude - last.lon) > 0.00025

    if (moved && now - last.at > 2500) {
      lastGeocodeRef.current = { lat: latitude, lon: longitude, at: now }
      const address = await resolveAddressFromCoords(latitude, longitude)
      setCurrentLocation((prev) => ({
        ...prev,
        address: address || prev.address,
        loading: false,
      }))
    }
  }, [])

  useEffect(() => {
    if (!navigator.geolocation) {
      setCurrentLocation((prev) => ({
        ...prev,
        loading: false,
        error: locationErrorMessage('unsupported'),
      }))
      return undefined
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        applyPosition(pos)
      },
      (err) => {
        setCurrentLocation((prev) => ({
          ...prev,
          loading: false,
          error: locationErrorMessage(err?.code === 1 ? 'permission_denied' : err?.code === 3 ? 'timeout' : 'unavailable'),
        }))
      },
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }, [applyPosition])

  const refreshCurrentLocation = async () => {
    setRefreshingLocation(true)
    const location = await getCurrentLocation()
    if (location.failed) {
      setCurrentLocation((prev) => ({
        ...prev,
        loading: false,
        error: locationErrorMessage(location.reason),
      }))
    } else {
      lastGeocodeRef.current = {
        lat: location.latitude,
        lon: location.longitude,
        at: Date.now(),
      }
      setCurrentLocation({
        loading: false,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address || formatCoords(location.latitude, location.longitude),
        accuracy: location.accuracy,
        error: '',
      })
    }
    setRefreshingLocation(false)
  }

  const getLocation = () => getCurrentLocation({ skipGeocode: true })

  const pushLocationTimeline = useCallback(async (location) => {
    if (!selectedEmployee || !isSessionActive) return
    const lat = Number(location?.latitude)
    const lon = Number(location?.longitude)
    if (Number.isNaN(lat) || Number.isNaN(lon)) return
    const now = Date.now()
    const last = lastTimelinePushRef.current
    const moved =
      last.lat == null ||
      Math.abs(lat - last.lat) > 0.00025 ||
      Math.abs(lon - last.lon) > 0.00025
    if (!moved || (now - last.at < 20000)) return
    lastTimelinePushRef.current = { lat, lon, at: now }
    try {
      await api.post('/attendance/location-update', {
        employee: selectedEmployee,
        latitude: lat,
        longitude: lon,
        address: location?.address || '',
      })
      fetchDayAttendance()
    } catch {
      // Silent fail: timeline updates are best-effort.
    }
  }, [selectedEmployee, isSessionActive, fetchDayAttendance])

  useEffect(() => {
    if (!isSessionActive) return
    if (currentLocation.latitude == null || currentLocation.longitude == null) return
    pushLocationTimeline(currentLocation)
  }, [isSessionActive, currentLocation.latitude, currentLocation.longitude, currentLocation.address, pushLocationTimeline])

  const backfillAttendanceAddress = useCallback(async (type, employeeId, latitude, longitude) => {
    const lat = Number(latitude)
    const lon = Number(longitude)
    if (!employeeId || Number.isNaN(lat) || Number.isNaN(lon)) return

    const key = `${type}:${employeeId}:${lat.toFixed(6)}:${lon.toFixed(6)}`
    if (addressBackfillRef.current.has(key)) return
    addressBackfillRef.current.add(key)

    try {
      const address = await resolveAddressFromCoords(lat, lon)
      if (!address?.trim()) {
        addressBackfillRef.current.delete(key)
        return
      }

      const endpoint =
        type === 'check-in' ? '/attendance/check-in-address' : '/attendance/check-out-address'
      await api.post(endpoint, {
        employee: employeeId,
        latitude: lat,
        longitude: lon,
        address: address.trim(),
      })
      fetchDayAttendance()
      fetchMonthAttendance()
    } catch {
      addressBackfillRef.current.delete(key)
    }
  }, [fetchDayAttendance, fetchMonthAttendance])

  const backfillCheckInAddress = useCallback(
    (employeeId, latitude, longitude) =>
      backfillAttendanceAddress('check-in', employeeId, latitude, longitude),
    [backfillAttendanceAddress]
  )

  const backfillCheckOutAddress = useCallback(
    (employeeId, latitude, longitude) =>
      backfillAttendanceAddress('check-out', employeeId, latitude, longitude),
    [backfillAttendanceAddress]
  )

  useEffect(() => {
    if (!selectedEmployee || !myDayAttendance) return

    const att = myDayAttendance
    if (
      att.checkIn &&
      att.checkInLatitude != null &&
      att.checkInLongitude != null &&
      isCoordOnlyAddress(att.checkInAddress)
    ) {
      void backfillCheckInAddress(selectedEmployee, att.checkInLatitude, att.checkInLongitude)
    }

    if (
      att.checkOut &&
      att.checkOutLatitude != null &&
      att.checkOutLongitude != null &&
      isCoordOnlyAddress(att.checkOutAddress)
    ) {
      void backfillCheckOutAddress(selectedEmployee, att.checkOutLatitude, att.checkOutLongitude)
    }
  }, [
    selectedEmployee,
    myDayAttendance,
    backfillCheckInAddress,
    backfillCheckOutAddress,
  ])

  const handleCheckIn = async () => {
    if (!selectedEmployee) {
      setError('User is not ready yet. Please try again.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const location = await getLocation()
      const hasValidLocation =
        !location.failed &&
        location.latitude != null &&
        location.longitude != null &&
        !Number.isNaN(Number(location.latitude)) &&
        !Number.isNaN(Number(location.longitude))
      if (!hasValidLocation) {
        setError(locationErrorMessage(location.reason || 'unavailable'))
        setLoading(false)
        return
      }
      const address =
        location.address?.trim() || formatCoords(location.latitude, location.longitude)
      const device = getCheckInDeviceInfo()
      const res = await api.post('/attendance/check-in', {
        employee: selectedEmployee,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        address,
        deviceType: device.deviceType,
        devicePlatform: device.devicePlatform,
        deviceBrowser: device.deviceBrowser,
      })
      const checkIn = new Date(res.data.attendance?.checkIn || Date.now())
      setCheckInTime(checkIn)
      setElapsedMs(Math.max(0, Date.now() - checkIn.getTime()))
      setCheckInLockedDate(getTodayDateKey())
      await fetchDayAttendance()
      await syncActiveSessionFromServer()
      fetchMonthAttendance()
      void backfillCheckInAddress(selectedEmployee, location.latitude, location.longitude)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error checking in')
    } finally {
      setLoading(false)
    }
  }

  const handleCheckOut = async () => {
    if (!selectedEmployee) {
      setError('User is not ready yet. Please try again.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const location = await getLocation()
      const hasValidLocation =
        !location.failed &&
        location.latitude != null &&
        location.longitude != null &&
        !Number.isNaN(Number(location.latitude)) &&
        !Number.isNaN(Number(location.longitude))
      if (!hasValidLocation) {
        setError(locationErrorMessage(location.reason || 'unavailable'))
        setLoading(false)
        return
      }
      const address =
        location.address?.trim() || formatCoords(location.latitude, location.longitude)
      await api.post('/attendance/check-out', {
        employee: selectedEmployee,
        latitude: Number(location.latitude),
        longitude: Number(location.longitude),
        address,
      })
      setCheckInTime(null)
      setElapsedMs(0)
      if (timerRef.current) clearInterval(timerRef.current)
      await fetchDayAttendance()
      await syncActiveSessionFromServer()
      fetchMonthAttendance()
      void backfillCheckOutAddress(selectedEmployee, location.latitude, location.longitude)
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error checking out')
    } finally {
      setLoading(false)
    }
  }

  const handleUndoCheckOut = async () => {
    if (!selectedEmployee) {
      setError('User is not ready yet. Please try again.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await api.post('/attendance/undo-check-out', { employee: selectedEmployee })
      await fetchDayAttendance()
      await syncActiveSessionFromServer()
      fetchMonthAttendance()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error undoing check-out')
    } finally {
      setLoading(false)
    }
  }

  const handleStartBreak = async () => {
    if (!selectedEmployee) return
    setLoading(true)
    setError(null)
    try {
      await api.post('/attendance/break/start', { employee: selectedEmployee })
      notifyBreakStarted()
      await fetchDayAttendance()
      fetchMonthAttendance()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error starting break')
    } finally {
      setLoading(false)
    }
  }

  const handleEndBreak = async () => {
    if (!selectedEmployee) return
    setLoading(true)
    setError(null)
    try {
      await api.post('/attendance/break/end', { employee: selectedEmployee })
      await fetchDayAttendance()
      fetchMonthAttendance()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error ending break')
    } finally {
      setLoading(false)
    }
  }

  const handleStartMeeting = async () => {
    if (!selectedEmployee) return
    setLoading(true)
    setError(null)
    try {
      await api.post('/attendance/meeting/start', { employee: selectedEmployee })
      await fetchDayAttendance()
      fetchMonthAttendance()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error starting meeting')
    } finally {
      setLoading(false)
    }
  }

  const handleEndMeeting = async () => {
    if (!selectedEmployee) return
    setLoading(true)
    setError(null)
    try {
      await api.post('/attendance/meeting/end', { employee: selectedEmployee })
      await fetchDayAttendance()
      fetchMonthAttendance()
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error ending meeting')
    } finally {
      setLoading(false)
    }
  }

  const activeEmployees = useMemo(
    () => employees.filter((e) => (e.employmentStatus || e.status || 'Active') === 'Active'),
    [employees]
  )

  const isOnLeave = useCallback(
    (employeeId, dateStr) => {
      const day = new Date(`${dateStr}T12:00:00`)
      return leaves.some((l) => {
        if (l.status !== 'Approved') return false
        const empId = l.employee?._id || l.employee
        if (String(empId) !== String(employeeId)) return false
        const start = new Date(l.startDate)
        const end = new Date(l.endDate)
        start.setHours(0, 0, 0, 0)
        end.setHours(23, 59, 59, 999)
        return day >= start && day <= end
      })
    },
    [leaves]
  )

  const attendanceByEmployee = useMemo(() => {
    const map = {}
    dayAttendances.forEach((a) => {
      map[a.employee?._id || a.employee] = a
    })
    return map
  }, [dayAttendances])

  const liveRows = useMemo(() => {
    const base = canViewTeam ? activeEmployees : activeEmployees.filter((e) => String(e._id) === String(user?._id))
    return base.map((emp) => {
      const att = attendanceByEmployee[emp._id]
      const onLeave = isOnLeave(emp._id, selectedDate)
      return {
        emp,
        att,
        status: deriveLiveStatus(att, onLeave),
      }
    })
  }, [canViewTeam, activeEmployees, user?._id, attendanceByEmployee, isOnLeave, selectedDate])

  const filteredLiveRows = useMemo(() => {
    let rows = liveRows
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      rows = rows.filter(
        (r) =>
          r.emp.name?.toLowerCase().includes(q) ||
          r.emp.email?.toLowerCase().includes(q) ||
          String(r.emp._id).toLowerCase().includes(q)
      )
    }
    return rows
  }, [liveRows, searchQuery])

  const stats = useMemo(() => {
    const present = liveRows.filter((r) => r.status === 'Present').length
    const late = liveRows.filter((r) => r.status === 'Late').length
    const absent = liveRows.filter((r) => r.status === 'Absent').length
    const onLeave = liveRows.filter((r) => r.status === 'On Leave').length
    const remote = liveRows.filter((r) => r.att?.checkIn && (r.att?.checkInAddress || '').toLowerCase().includes('home')).length
    return { present, late, absent, onLeave, remote, total: liveRows.length }
  }, [liveRows])

  const weekChartData = useMemo(() => {
    const counts = { Present: 0, Late: 0, Absent: 0, 'On Leave': 0 }
    const end = new Date(`${selectedDate}T12:00:00`)
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(end)
      d.setDate(end.getDate() - i)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      activeEmployees.forEach((emp) => {
        if (!canViewTeam && String(emp._id) !== String(user?._id)) return
        const onLeave = isOnLeave(emp._id, key)
        const att = monthAttendances.find((a) => {
          const ad = a.date ? new Date(a.date) : null
          if (!ad) return false
          const adKey = `${ad.getFullYear()}-${String(ad.getMonth() + 1).padStart(2, '0')}-${String(ad.getDate()).padStart(2, '0')}`
          return adKey === key && String(a.employee?._id || a.employee) === String(emp._id)
        })
        const status = deriveLiveStatus(att, onLeave)
        if (counts[status] != null) counts[status] += 1
      })
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }))
  }, [selectedDate, activeEmployees, monthAttendances, isOnLeave, canViewTeam, user?._id])

  const myDayStatus = useMemo(() => {
    if (!user?._id) return 'Absent'
    return deriveLiveStatus(myDayAttendance, isOnLeave(user._id, selectedDate))
  }, [user?._id, myDayAttendance, isOnLeave, selectedDate])

  const paginatedRows = filteredLiveRows.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.max(1, Math.ceil(filteredLiveRows.length / pageSize))

  const monthLabel = selectedMonth
    ? new Date(`${selectedMonth}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : ''

  const monthlyEmployeeId = canViewTeam ? (selectedEmployee || user?._id) : user?._id

  const selectedMonthlyEmployee = useMemo(() => {
    if (!monthlyEmployeeId) return null
    return employees.find((e) => String(e._id) === String(monthlyEmployeeId)) || {
      _id: monthlyEmployeeId,
      name: user?.name,
      email: user?.email,
      employeeCode: user?.employeeCode,
      profilePhoto: user?.profilePhoto,
    }
  }, [employees, monthlyEmployeeId, user])

  const fullMonthRows = useMemo(() => {
    if (!selectedMonth || !monthlyEmployeeId) return []
    const todayKey = getTodayDateKey()
    return getDaysInMonth(selectedMonth).map((dateKey) => {
      const att = monthAttendances.find((a) => {
        if (!a.date) return false
        return toDateKey(a.date) === dateKey
      })
      const onLeave = isOnLeave(monthlyEmployeeId, dateKey)
      const isFuture = dateKey > todayKey
      const status = isFuture ? '—' : deriveLiveStatus(att, onLeave)
      return { dateKey, att, status, isFuture }
    })
  }, [selectedMonth, monthlyEmployeeId, monthAttendances, isOnLeave])

  const monthlyStats = useMemo(() => {
    const rows = fullMonthRows.filter((r) => !r.isFuture)
    return {
      present: rows.filter((r) => r.status === 'Present').length,
      late: rows.filter((r) => r.status === 'Late').length,
      absent: rows.filter((r) => r.status === 'Absent').length,
      onLeave: rows.filter((r) => r.status === 'On Leave').length,
      totalHours: rows.reduce((sum, r) => sum + hoursFromAttendanceRow(r.att), 0),
    }
  }, [fullMonthRows])

  const downloadAttendanceReport = () => {
    if (!canViewTeam || !selectedMonth) return
    const emp = selectedMonthlyEmployee
    const headers = [
      'Date',
      'Day',
      'Employee Name',
      'Employee ID',
      'Check In',
      'Check Out',
      'Duration (hrs)',
      'Status',
      'Check In Location',
      'Check Out Location',
      'Check In Device',
    ]
    const lines = fullMonthRows.map(({ dateKey, att, status, isFuture }) => {
      const dayName = new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })
      const rowStatus = isFuture ? 'Upcoming' : status
      return [
        dateKey,
        dayName,
        emp?.name || '',
        emp?.employeeCode || '',
        att?.checkIn ? new Date(att.checkIn).toLocaleString('en-IN') : '',
        att?.checkOut ? new Date(att.checkOut).toLocaleString('en-IN') : '',
        att ? formatDurationHours(att) : '',
        rowStatus,
        att?.checkInAddress || '',
        att?.checkOutAddress || '',
        formatCheckInDevice(att),
      ].map(csvEscape).join(',')
    })
    const csv = `${headers.map(csvEscape).join(',')}\n${lines.join('\n')}`
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const code = emp?.employeeCode || 'employee'
    link.href = url
    link.download = `attendance-${code}-${selectedMonth}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='min-h-full bg-[#f4f6f8]'>
      <div className='px-6 md:px-8 py-6 border-b border-gray-200 bg-white'>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-2xl font-bold text-gray-900'>
              {canViewTeam ? 'Attendance Dashboard' : 'My Attendance'}
            </h1>
            <p className='text-sm text-gray-500 mt-1'>
              {canViewTeam
                ? viewMode === 'monthly'
                  ? `Monthly attendance for ${selectedMonthlyEmployee?.name || 'selected employee'}`
                  : `Overview of ${isToday ? "today's" : "selected day's"} attendance and real-time status`
                : `Track your check-in, check-out, and attendance for ${isToday ? 'today' : formatDateLabel(selectedDate)}`}
            </p>
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <div className='flex rounded-lg border border-gray-200 overflow-hidden bg-white'>
              <button
                type='button'
                onClick={() => setViewMode('live')}
                className={`px-3 py-2 text-sm font-medium ${viewMode === 'live' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Live
              </button>
              <button
                type='button'
                onClick={() => setViewMode('monthly')}
                className={`px-3 py-2 text-sm font-medium ${viewMode === 'monthly' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                Monthly
              </button>
            </div>
            {viewMode === 'monthly' && (
              <>
                {canViewTeam && (
                  <select
                    value={selectedEmployee || user?._id || ''}
                    onChange={(e) => setSelectedEmployee(e.target.value)}
                    className='border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[200px] focus:outline-none focus:ring-2 focus:ring-blue-500'
                  >
                    {employees.map((emp) => (
                      <option key={emp._id} value={emp._id}>
                        {emp.name}{emp.employeeCode ? ` · ${emp.employeeCode}` : ''}
                      </option>
                    ))}
                  </select>
                )}
                <input
                  type='month'
                  value={selectedMonth}
                  max={getCurrentMonthKey()}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className='border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                />
                {canViewTeam && (
                  <button
                    type='button'
                    onClick={downloadAttendanceReport}
                    className='inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700'
                  >
                    <span>↓</span>
                    Download Report
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <div className='p-6 md:px-8 md:py-6 space-y-6'>
        {viewMode === 'live' && (
          <>
            <div className='grid grid-cols-1 gap-6 xl:grid-cols-[1fr_380px]'>
              <div className='space-y-6 min-w-0 order-2 xl:order-1'>
              {canViewTeam && (
              <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
                <div className='px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3'>
                  <div className='flex flex-wrap items-center gap-3 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <h2 className='font-semibold text-gray-900'>
                        {isToday ? "Today's Attendance" : 'Attendance'}
                      </h2>
                      {isToday && (
                        <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200'>
                          <span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
                          Live
                        </span>
                      )}
                    </div>
                    {!isToday && (
                      <p className='text-sm text-gray-500'>{formatDateLabel(selectedDate)}</p>
                    )}
                  </div>
                  <div className='flex flex-wrap items-center gap-2'>
                    <input
                      type='date'
                      value={selectedDate}
                      max={getTodayDateKey()}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className='border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                      aria-label='Select attendance date'
                    />
                    {!isToday && (
                      <button
                        type='button'
                        onClick={() => setSelectedDate(getTodayDateKey())}
                        className='px-3 py-2 text-sm font-medium rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'
                      >
                        Today
                      </button>
                    )}
                    <input
                      type='search'
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder='Search employee…'
                      className='border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white min-w-[180px]'
                    />
                  </div>
                </div>

                <div className='overflow-x-auto'>
                  <table className='w-full text-sm'>
                    <thead>
                      <tr className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'>
                        <th className='px-5 py-3'>Employee</th>
                        <th className='px-5 py-3'>Check In Time</th>
                        <th className='px-5 py-3'>Check Out Time</th>
                        <th className='px-5 py-3'>Check In Location</th>
                        <th className='px-5 py-3'>Check Out Location</th>
                        <th className='px-5 py-3'>Device</th>
                        <th className='px-5 py-3'>Status</th>
                        <th className='px-5 py-3'>Duration</th>
                      </tr>
                    </thead>
                    <tbody className='divide-y divide-gray-100'>
                      {paginatedRows.length === 0 ? (
                        <tr>
                          <td colSpan={8} className='px-5 py-12 text-center text-gray-500'>
                            No attendance records for {formatDateLabel(selectedDate)}
                          </td>
                        </tr>
                      ) : (
                        paginatedRows.map(({ emp, att, status }) => (
                          <tr key={emp._id} className='hover:bg-gray-50/80'>
                            <td className='px-5 py-3'>
                              <div className='flex items-center gap-3'>
                                <EmployeeAvatar employee={emp} />
                                <div>
                                  <p className='font-medium text-gray-900'>{emp.name}</p>
                                  <p className='text-xs text-gray-400'>{getDesignationTitle(emp)}</p>
                                </div>
                              </div>
                            </td>
                            <td className='px-5 py-3 font-mono text-gray-800 whitespace-nowrap'>
                              {formatAttendanceTime(att?.checkIn)}
                            </td>
                            <td className='px-5 py-3 font-mono text-gray-800 whitespace-nowrap'>
                              {formatAttendanceTime(att?.checkOut)}
                            </td>
                            <td className='px-5 py-3 align-top'>
                              <LocationDisplay
                                address={att?.checkInAddress}
                                latitude={att?.checkInLatitude}
                                longitude={att?.checkInLongitude}
                                compact
                              />
                            </td>
                            <td className='px-5 py-3 align-top'>
                              <LocationDisplay
                                address={att?.checkOutAddress}
                                latitude={att?.checkOutLatitude}
                                longitude={att?.checkOutLongitude}
                                compact
                              />
                            </td>
                            <td className='px-5 py-3 text-gray-700 whitespace-nowrap'>
                              {formatCheckInDevice(att)}
                            </td>
                            <td className='px-5 py-3'><StatusBadge status={status} /></td>
                            <td className='px-5 py-3'><DurationCell row={att} /></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className='px-5 py-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500'>
                  <span>
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, filteredLiveRows.length)} of {filteredLiveRows.length} employees
                  </span>
                  <div className='flex items-center gap-1'>
                    <button
                      type='button'
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className='px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50'
                    >
                      Prev
                    </button>
                    <span className='px-2'>{page} / {totalPages}</span>
                    <button
                      type='button'
                      disabled={page >= totalPages}
                      onClick={() => setPage((p) => p + 1)}
                      className='px-3 py-1 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50'
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
              )}

              {!canViewTeam && (
                <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
                  <div className='px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3'>
                    <div>
                      <h2 className='font-semibold text-gray-900'>
                        {isToday ? "Today's Record" : 'Attendance Record'}
                      </h2>
                      <p className='text-sm text-gray-500 mt-0.5'>{formatDateLabel(selectedDate)}</p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                      <input
                        type='date'
                        value={selectedDate}
                        max={getTodayDateKey()}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className='border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
                        aria-label='Select attendance date'
                      />
                      {!isToday && (
                        <button
                          type='button'
                          onClick={() => setSelectedDate(getTodayDateKey())}
                          className='px-3 py-2 text-sm font-medium rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100'
                        >
                          Today
                        </button>
                      )}
                    </div>
                  </div>
                  <div className='p-5'>
                    <div className='flex flex-wrap items-center gap-3 mb-4'>
                      <EmployeeAvatar employee={employees[0] || user} />
                      <div>
                        <p className='font-medium text-gray-900'>{user?.name || '—'}</p>
                        <p className='text-xs text-gray-400'>{user?.email || '—'}</p>
                      </div>
                      <StatusBadge status={myDayStatus} />
                    </div>
                    <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm'>
                      <div className='p-3 rounded-lg bg-gray-50 border border-gray-100'>
                        <p className='text-xs text-gray-500 uppercase tracking-wide'>Check In</p>
                        <p className='font-mono font-medium text-gray-900 mt-1'>{formatAttendanceTime(myDayAttendance?.checkIn)}</p>
                        <div className='mt-2'>
                          <LocationDisplay
                            address={myDayAttendance?.checkInAddress}
                            latitude={myDayAttendance?.checkInLatitude}
                            longitude={myDayAttendance?.checkInLongitude}
                            compact
                          />
                        </div>
                        {myDayAttendance?.checkInDeviceType && (
                          <p className='mt-2 text-xs text-gray-500'>
                            Device: {formatCheckInDevice(myDayAttendance)}
                          </p>
                        )}
                      </div>
                      <div className='p-3 rounded-lg bg-gray-50 border border-gray-100'>
                        <p className='text-xs text-gray-500 uppercase tracking-wide'>Check Out</p>
                        <p className='font-mono font-medium text-gray-900 mt-1'>{formatAttendanceTime(myDayAttendance?.checkOut)}</p>
                        <div className='mt-2'>
                          <LocationDisplay
                            address={myDayAttendance?.checkOutAddress}
                            latitude={myDayAttendance?.checkOutLatitude}
                            longitude={myDayAttendance?.checkOutLongitude}
                            compact
                          />
                        </div>
                      </div>
                    </div>
                    <div className='mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm'>
                      <span className='text-gray-500'>Duration</span>
                      <DurationCell row={myDayAttendance} />
                    </div>
                  </div>
                </div>
              )}

              <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5'>
                <h3 className='font-semibold text-gray-900 mb-1'>Attendance Overview</h3>
                <p className='text-xs text-gray-500 mb-4'>{canViewTeam ? 'This week' : 'My week'}</p>
                <div className='h-44'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <PieChart>
                      <Pie data={weekChartData} dataKey='value' nameKey='name' cx='50%' cy='50%' innerRadius={48} outerRadius={68} paddingAngle={2}>
                        {weekChartData.map((entry, index) => (
                          <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className='flex flex-wrap justify-center gap-3 mt-2'>
                  {weekChartData.map((item, index) => (
                    <span key={item.name} className='inline-flex items-center gap-1 text-xs text-gray-600'>
                      <span className='w-2 h-2 rounded-full' style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }} />
                      {item.name} ({item.value})
                    </span>
                  ))}
                </div>
              </div>
              </div>

              <div className='space-y-4 order-1 xl:order-2 xl:sticky xl:top-6 xl:self-start'>
                <div className='bg-white rounded-xl border border-gray-200 shadow-sm p-5'>
                  <div className='flex items-center justify-between mb-4'>
                    <h3 className='font-semibold text-gray-900'>My Attendance</h3>
                    {isSessionActive ? (
                      <span className='text-xs font-semibold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200'>Checked In</span>
                    ) : hasCheckedOutToday ? (
                      <span className='text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200'>Checked Out</span>
                    ) : (
                      <span className='text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-600'>Not checked in</span>
                    )}
                  </div>
                  <p className='text-3xl font-bold text-gray-900 font-mono tabular-nums'>{formatClock(liveClock)}</p>
                  <p className='text-xs text-gray-500 mt-1'>{formatDateLabel(selectedDate)}</p>
                  {isSessionActive && (
                    <p className='text-sm text-blue-600 font-mono mt-2'>Working · {formatTime(netWorkingMsToday)}</p>
                  )}

                  <div className='mt-4 p-3 rounded-lg bg-gray-50 border border-gray-100'>
                    <div className='flex items-center justify-between gap-2 mb-2'>
                      <p className='text-xs font-semibold text-gray-700 uppercase tracking-wide'>Current Location</p>
                      <button
                        type='button'
                        onClick={refreshCurrentLocation}
                        disabled={refreshingLocation}
                        className='text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50'
                      >
                        {refreshingLocation ? 'Updating…' : 'Refresh'}
                      </button>
                    </div>
                    {currentLocation.loading && !currentLocation.latitude ? (
                      <p className='text-xs text-gray-500'>Detecting your location…</p>
                    ) : currentLocation.error ? (
                      <p className='text-xs text-red-600'>{currentLocation.error}</p>
                    ) : (
                      <>
                        <LocationDisplay
                          address={currentLocation.address}
                          latitude={currentLocation.latitude}
                          longitude={currentLocation.longitude}
                        />
                        {currentLocation.accuracy != null && (
                          <p className='text-[11px] text-gray-400 mt-2'>
                            Accuracy ±{Math.round(currentLocation.accuracy)} m
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  <div className='flex gap-2 mt-4'>
                    <button
                      type='button'
                      onClick={handleCheckIn}
                      disabled={loading || !canCheckIn}
                      className='flex-1 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      Check In
                    </button>
                    <button
                      type='button'
                      onClick={handleCheckOut}
                      disabled={loading || !canCheckOut}
                      className='flex-1 py-2.5 rounded-lg border border-blue-600 text-blue-600 text-sm font-semibold hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      Check Out
                    </button>
                  </div>
                  {canUndoCheckOut && (
                    <button
                      type='button'
                      onClick={handleUndoCheckOut}
                      disabled={loading}
                      className='w-full mt-2 py-2.5 rounded-lg border border-amber-500 bg-amber-50 text-amber-800 text-sm font-semibold hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      Undo Check Out · {formatTime(undoRemainingMs)}
                    </button>
                  )}
                  <div className='grid grid-cols-2 gap-2 mt-2'>
                    <button
                      type='button'
                      onClick={isBreakActive ? handleEndBreak : handleStartBreak}
                      disabled={loading || !isSessionActive}
                      className='py-2 rounded-lg border border-amber-400 text-amber-700 text-sm font-semibold hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      {isBreakActive ? 'End Break' : 'Start Break'}
                    </button>
                    <button
                      type='button'
                      onClick={isMeetingActive ? handleEndMeeting : handleStartMeeting}
                      disabled={loading || !isSessionActive}
                      className='py-2 rounded-lg border border-violet-400 text-violet-700 text-sm font-semibold hover:bg-violet-50 disabled:opacity-50 disabled:cursor-not-allowed'
                    >
                      {isMeetingActive ? 'End Meeting' : 'Start Meeting'}
                    </button>
                  </div>
                  <div className='grid grid-cols-2 gap-2 mt-1'>
                    <p className={`text-xs font-mono ${isBreakActive ? 'text-amber-700' : 'text-gray-500'}`}>
                      Break Timer: {formatTime(liveBreakMs)}
                    </p>
                    <p className={`text-xs font-mono text-right ${isMeetingActive ? 'text-violet-700' : 'text-gray-500'}`}>
                      Meeting Timer: {formatTime(liveMeetingMs)}
                    </p>
                  </div>
                  {hasCheckedInToday && !hasCheckedOutToday && (
                    <p className='text-xs text-emerald-700 mt-2'>You are checked in for today. Check out when you finish work.</p>
                  )}
                  {hasCheckedOutToday && canUndoCheckOut && (
                    <p className='text-xs text-amber-700 mt-2'>
                      Checked out by mistake? You can undo for {formatTime(undoRemainingMs)}.
                    </p>
                  )}
                  {hasCheckedOutToday && !canUndoCheckOut && (
                    <p className='text-xs text-blue-700 mt-2'>Attendance completed for today. Check-in opens again tomorrow.</p>
                  )}
                  <div className='grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-gray-100'>
                    <div className='text-center p-2 rounded-lg bg-gray-50'>
                      <p className='text-xs text-gray-500'>Working Hours</p>
                      <p className='font-semibold text-gray-900'>{(netWorkingMsToday / 3600000).toFixed(1)}h</p>
                    </div>
                    <div className='text-center p-2 rounded-lg bg-gray-50'>
                      <p className='text-xs text-gray-500'>Break Time</p>
                      <p className='font-semibold text-gray-900'>{formatMinutesAsHours(liveBreakMinutes)}h</p>
                    </div>
                    <div className='text-center p-2 rounded-lg bg-gray-50'>
                      <p className='text-xs text-gray-500'>Meeting Time</p>
                      <p className='font-semibold text-gray-900'>{formatMinutesAsHours(liveMeetingMinutes)}h</p>
                    </div>
                  </div>

                  <div className='mt-4 pt-4 border-t border-gray-100'>
                    <p className='text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3'>Location Timeline</p>
                    {locationTimeline.length === 0 ? (
                      <p className='text-xs text-gray-500'>No location changes recorded for {isToday ? 'today' : formatDateLabel(selectedDate)}.</p>
                    ) : (
                      <div className='space-y-3 max-h-52 overflow-y-auto pr-1'>
                        {locationTimeline.map((point, idx) => (
                          <div key={`${point.at || idx}-${idx}`} className='relative pl-4 border-l-2 border-blue-200 pb-2 last:pb-0'>
                            <span className='absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-blue-500' />
                            <p className='text-xs font-mono font-medium text-gray-800'>{formatAttendanceTime(point.at)}</p>
                            <div className='mt-1'>
                              <LocationDisplay
                                address={point.address}
                                latitude={point.latitude}
                                longitude={point.longitude}
                                compact
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && <p className='text-red-600 text-xs mt-3'>{error}</p>}
                  {!isToday && <p className='text-xs text-amber-600 mt-2'>Check-in is only available for today.</p>}
                </div>
              </div>
            </div>

            {canViewTeam && (
            <div className='grid grid-cols-2 lg:grid-cols-5 gap-4'>
              <SummaryCard title='Present' value={stats.present} trend='Checked in' icon='✓' iconBg='bg-emerald-100 text-emerald-600' />
              <SummaryCard title='Late Arrivals' value={stats.late} trend={`After ${LATE_AFTER_LABEL}`} icon='⏰' iconBg='bg-amber-100 text-amber-600' />
              <SummaryCard title='Absent' value={stats.absent} trend='No check-in' icon='✕' iconBg='bg-red-100 text-red-600' />
              <SummaryCard title='On Leave' value={stats.onLeave} trend='Approved leave' icon='🌴' iconBg='bg-violet-100 text-violet-600' />
              <SummaryCard title='Working Remote' value={stats.remote} trend='Location based' icon='🏠' iconBg='bg-blue-100 text-blue-600' />
            </div>
            )}
          </>
        )}

        {viewMode === 'monthly' && (
          <div className='space-y-4'>
            {canViewTeam && (
              <div className='grid grid-cols-2 lg:grid-cols-5 gap-4'>
                <SummaryCard title='Present' value={monthlyStats.present} trend='This month' icon='✓' iconBg='bg-emerald-100 text-emerald-600' />
                <SummaryCard title='Late' value={monthlyStats.late} trend={`After ${LATE_AFTER_LABEL}`} icon='⏰' iconBg='bg-amber-100 text-amber-600' />
                <SummaryCard title='Absent' value={monthlyStats.absent} trend='No check-in' icon='✕' iconBg='bg-red-100 text-red-600' />
                <SummaryCard title='On Leave' value={monthlyStats.onLeave} trend='Approved leave' icon='🌴' iconBg='bg-violet-100 text-violet-600' />
                <SummaryCard title='Total Hours' value={monthlyStats.totalHours.toFixed(1)} trend='Worked' icon='⏱' iconBg='bg-blue-100 text-blue-600' />
              </div>
            )}

          <div className='bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden'>
            <div className='px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3'>
              <div className='flex items-center gap-3'>
                {selectedMonthlyEmployee && (
                  <EmployeeAvatar employee={selectedMonthlyEmployee} />
                )}
                <div>
                  <h2 className='font-semibold text-gray-900'>
                    {canViewTeam ? 'Monthly Attendance' : 'My Attendance'} · {monthLabel}
                  </h2>
                  <p className='text-sm text-gray-500'>
                    {selectedMonthlyEmployee?.name || '—'}
                    {selectedMonthlyEmployee?.employeeCode ? ` · ${selectedMonthlyEmployee.employeeCode}` : ''}
                  </p>
                </div>
              </div>
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead>
                  <tr className='bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase'>
                    <th className='px-5 py-3'>Date</th>
                    <th className='px-5 py-3'>Day</th>
                    <th className='px-5 py-3'>Check In Time</th>
                    <th className='px-5 py-3'>Check Out Time</th>
                    <th className='px-5 py-3'>Check In Location</th>
                    <th className='px-5 py-3'>Check Out Location</th>
                    <th className='px-5 py-3'>Device</th>
                    <th className='px-5 py-3'>Duration</th>
                    <th className='px-5 py-3'>Status</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-gray-100'>
                  {fullMonthRows.length === 0 ? (
                    <tr><td colSpan={9} className='px-5 py-12 text-center text-gray-500'>No records for {monthLabel}</td></tr>
                  ) : (
                    fullMonthRows.map(({ dateKey, att, status, isFuture }) => (
                      <tr key={dateKey} className={`hover:bg-gray-50/80 ${isFuture ? 'opacity-50' : ''}`}>
                        <td className='px-5 py-3 whitespace-nowrap'>
                          {new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-IN')}
                        </td>
                        <td className='px-5 py-3 text-gray-600'>
                          {new Date(`${dateKey}T12:00:00`).toLocaleDateString('en-IN', { weekday: 'short' })}
                        </td>
                        <td className='px-5 py-3 font-mono whitespace-nowrap'>{formatAttendanceTime(att?.checkIn)}</td>
                        <td className='px-5 py-3 font-mono whitespace-nowrap'>{formatAttendanceTime(att?.checkOut)}</td>
                        <td className='px-5 py-3 align-top'>
                          <LocationDisplay
                            address={att?.checkInAddress}
                            latitude={att?.checkInLatitude}
                            longitude={att?.checkInLongitude}
                            compact
                          />
                        </td>
                        <td className='px-5 py-3 align-top'>
                          <LocationDisplay
                            address={att?.checkOutAddress}
                            latitude={att?.checkOutLatitude}
                            longitude={att?.checkOutLongitude}
                            compact
                          />
                        </td>
                        <td className='px-5 py-3 text-gray-700 whitespace-nowrap'>
                          {formatCheckInDevice(att)}
                        </td>
                        <td className='px-5 py-3'><DurationCell row={att} /></td>
                        <td className='px-5 py-3'>
                          {isFuture ? <span className='text-gray-400'>—</span> : <StatusBadge status={status} />}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default AttendanceView
