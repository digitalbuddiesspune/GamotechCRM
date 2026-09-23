const BREAK_AUDIO_SRC = '/break.mp3'

let audioInstance = null

export const initBreakAudio = () => {
  if (!audioInstance) {
    audioInstance = new Audio(BREAK_AUDIO_SRC)
    audioInstance.preload = 'auto'
  }
  return audioInstance
}

const playBreakSound = () => {
  const audio = initBreakAudio()
  try {
    audio.currentTime = 0
    audio.play().catch(() => {})
  } catch {
    // Ignore audio errors silently.
  }
}

const showBreakNotification = (title, body) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  try {
    new Notification(title, {
      body,
      tag: 'crm-break-alert',
      requireInteraction: false,
      silent: false,
    })
  } catch {
    // Ignore notification errors silently.
  }
}

export const notifyBreakStarted = () => {
  playBreakSound()
  showBreakNotification('Break started', 'Your break timer has started.')
}

export const notifyBreakEndingSoon = ({ remainingMinutes = 5 } = {}) => {
  playBreakSound()
  const mins = Math.max(1, Math.ceil(Number(remainingMinutes) || 5))
  showBreakNotification(
    'Break ending soon',
    `${mins} minute${mins === 1 ? '' : 's'} left on your break.`
  )
}
