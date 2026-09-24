const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'MultiCRM-Attendance/1.0',
}

/** Web Geolocation error codes: 1=denied, 2=unavailable (macOS kCLErrorLocationUnknown), 3=timeout */
const GPS_ATTEMPTS = [
  { enableHighAccuracy: false, timeout: 8000, maximumAge: 120000 },
  { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 },
  { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
]
const GEOCODE_TIMEOUT_MS = 2000

export const geolocationErrorReason = (err) => {
  if (err?.code === 1) return 'permission_denied'
  if (err?.code === 3) return 'timeout'
  if (err?.code === 2) return 'position_unavailable'
  return 'unavailable'
}

const getPositionOnce = (options) =>
  new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options)
  })

const getPositionWithRetries = async () => {
  let lastError = null
  for (const options of GPS_ATTEMPTS) {
    try {
      return await getPositionOnce(options)
    } catch (err) {
      lastError = err
      if (err?.code === 1) throw err
    }
  }
  throw lastError || new Error('Location unavailable')
}

export const buildAddressFromNominatim = (data) => {
  const a = data?.address || {}
  const parts = [
    a.house_number,
    a.building,
    a.road || a.pedestrian || a.footway,
    a.neighbourhood || a.suburb || a.quarter,
    a.village || a.city_district || a.district,
    a.city || a.town || a.municipality,
    a.state,
    a.postcode,
  ].filter(Boolean)

  if (parts.length > 0) return parts.join(', ')
  return String(data?.display_name || '').trim()
}

export const resolveAddressFromCoords = async (latitude, longitude) => {
  const lat = Number(latitude)
  const lon = Number(longitude)
  if (Number.isNaN(lat) || Number.isNaN(lon)) return ''

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1&zoom=18`,
      { headers: NOMINATIM_HEADERS }
    )
    if (!res.ok) return ''
    const data = await res.json()
    return buildAddressFromNominatim(data)
  } catch {
    return ''
  }
}

export const formatCoords = (latitude, longitude) => {
  const lat = Number(latitude)
  const lon = Number(longitude)
  if (Number.isNaN(lat) || Number.isNaN(lon)) return ''
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`
}

const COORD_ONLY_ADDRESS_RE = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/

export const isCoordOnlyAddress = (address) => {
  const trimmed = String(address || '').trim()
  if (!trimmed) return false
  return COORD_ONLY_ADDRESS_RE.test(trimmed)
}

export const getMapsUrl = (latitude, longitude) => {
  const lat = Number(latitude)
  const lon = Number(longitude)
  if (Number.isNaN(lat) || Number.isNaN(lon)) return null
  return `https://www.google.com/maps?q=${lat},${lon}`
}

export const getCurrentLocation = (options = {}) => {
  const skipGeocode = Boolean(options.skipGeocode)

  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ failed: true, reason: 'unsupported' })
      return
    }

    const finish = async (pos) => {
      const latitude = Number(pos.coords.latitude)
      const longitude = Number(pos.coords.longitude)
      if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
        resolve({ failed: true, reason: 'unavailable' })
        return
      }

      let address = ''
      if (!skipGeocode) {
        address = await Promise.race([
          resolveAddressFromCoords(latitude, longitude),
          new Promise((r) => setTimeout(() => r(''), GEOCODE_TIMEOUT_MS)),
        ])
      }

      resolve({
        latitude,
        longitude,
        address,
        accuracy: pos.coords.accuracy,
      })
    }

    getPositionWithRetries()
      .then(finish)
      .catch((err) => {
        resolve({ failed: true, reason: geolocationErrorReason(err) })
      })
  })
}

export const locationErrorMessage = (reason) => {
  if (reason === 'permission_denied') {
    return 'Location access denied. Allow location for this site in browser settings.'
  }
  if (reason === 'timeout') {
    return 'Location request timed out. Ensure device GPS/location is on, then try Refresh location.'
  }
  if (reason === 'unsupported') {
    return 'Your browser does not support location services.'
  }
  if (reason === 'position_unavailable' || reason === 'unavailable') {
    return 'Could not determine your location. On Mac/iPhone: turn on Location Services, enable location for your browser, stay on Wi‑Fi, wait a few seconds, then tap Refresh location. (Console may show kCLErrorLocationUnknown — that is a temporary GPS/Wi‑Fi fix failure.)'
  }
  return 'Unable to detect current location. Enable GPS and try again.'
}
