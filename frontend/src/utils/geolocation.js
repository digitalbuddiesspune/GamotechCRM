const NOMINATIM_HEADERS = {
  Accept: 'application/json',
  'User-Agent': 'MultiCRM-Attendance/1.0',
}

const GPS_FAST = { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
const GPS_RETRY = { enableHighAccuracy: false, timeout: 7000, maximumAge: 60000 }
const GEOCODE_TIMEOUT_MS = 2000

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

    const onError = (err, retry) => {
      const reason =
        err?.code === 1 ? 'permission_denied' : err?.code === 3 ? 'timeout' : 'unavailable'
      if (retry && reason !== 'permission_denied') {
        navigator.geolocation.getCurrentPosition(
          finish,
          () => resolve({ failed: true, reason }),
          GPS_RETRY
        )
        return
      }
      resolve({ failed: true, reason })
    }

    navigator.geolocation.getCurrentPosition(
      finish,
      (err) => onError(err, true),
      GPS_FAST
    )
  })
}

export const locationErrorMessage = (reason) => {
  if (reason === 'permission_denied') {
    return 'Location access denied. Allow location for this site in browser settings.'
  }
  if (reason === 'timeout') {
    return 'Location request timed out. Ensure device GPS/location is on.'
  }
  if (reason === 'unsupported') {
    return 'Your browser does not support location services.'
  }
  return 'Unable to detect current location. Enable GPS and try again.'
}
