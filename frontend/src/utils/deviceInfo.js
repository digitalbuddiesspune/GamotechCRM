const DEVICE_LABELS = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Laptop/Desktop',
}

const detectBrowser = (ua) => {
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\//i.test(ua) || /Opera/i.test(ua)) return 'Opera'
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) return 'Safari'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  return 'Unknown'
}

const detectPlatform = (ua, platform) => {
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iOS'
  if (/Android/i.test(ua)) return 'Android'
  if (/Win/i.test(platform)) return 'Windows'
  if (/Mac/i.test(platform)) return 'macOS'
  if (/Linux/i.test(platform)) return 'Linux'
  return platform || 'Unknown'
}

/** Device category + platform/browser for attendance check-in analytics. */
export const getCheckInDeviceInfo = () => {
  if (typeof navigator === 'undefined') {
    return {
      deviceType: 'desktop',
      devicePlatform: '',
      deviceBrowser: '',
    }
  }

  const ua = String(navigator.userAgent || '')
  const platform = String(navigator.platform || '')
  const maxTouch = Number(navigator.maxTouchPoints) || 0

  const isTablet =
    /iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua) ||
    (platform === 'MacIntel' && maxTouch > 1)

  const isMobile =
    !isTablet && /Mobi|Android.*Mobile|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)

  let deviceType = 'desktop'
  if (isMobile) deviceType = 'mobile'
  else if (isTablet) deviceType = 'tablet'

  return {
    deviceType,
    devicePlatform: detectPlatform(ua, platform),
    deviceBrowser: detectBrowser(ua),
  }
}

export const formatCheckInDevice = (attendance) => {
  const type = attendance?.checkInDeviceType
  if (!type) return '—'

  const label = DEVICE_LABELS[type] || type
  const platform = String(attendance?.checkInDevicePlatform || '').trim()
  const browser = String(attendance?.checkInDeviceBrowser || '').trim()

  const details = [platform, browser].filter((part) => part && part !== 'Unknown')
  return details.length ? `${label} (${details.join(' · ')})` : label
}
