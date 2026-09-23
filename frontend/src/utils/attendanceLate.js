/** Office check-in starts at 10:00 AM with a 15-minute grace period (late after 10:15 AM). */
export const OFFICE_START_HOUR = 10
export const OFFICE_START_MINUTE = 0
export const ATTENDANCE_GRACE_MINUTES = 15

export const getLateAfterHourMinute = () => {
  const totalMinutes = OFFICE_START_MINUTE + ATTENDANCE_GRACE_MINUTES
  return {
    hour: OFFICE_START_HOUR + Math.floor(totalMinutes / 60),
    minute: totalMinutes % 60,
  }
}

export const getLateAfterLabel = () => {
  const { hour, minute } = getLateAfterHourMinute()
  const period = hour >= 12 ? 'PM' : 'AM'
  const displayHour = hour % 12 || 12
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`
}

export const isLateCheckIn = (checkIn) => {
  if (!checkIn) return false
  const checkInDate = new Date(checkIn)
  if (Number.isNaN(checkInDate.getTime())) return false

  const { hour, minute } = getLateAfterHourMinute()
  const checkMinutes = checkInDate.getHours() * 60 + checkInDate.getMinutes()
  const lateAfterMinutes = hour * 60 + minute
  return checkMinutes > lateAfterMinutes
}
