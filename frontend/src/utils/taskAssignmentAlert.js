const TASK_NOTIFY_AUDIO_SRC = '/butty_notify.mp3'

let audioInstance = null
let notificationPermissionRequested = false

export const initTaskAssignmentAudio = () => {
  if (!audioInstance) {
    audioInstance = new Audio(TASK_NOTIFY_AUDIO_SRC)
    audioInstance.preload = 'auto'
  }
  return audioInstance
}

export const enableTaskAssignmentAlerts = async () => {
  const audio = initTaskAssignmentAudio()
  try {
    audio.volume = 0.01
    audio.currentTime = 0
    await audio.play()
    audio.pause()
    audio.currentTime = 0
    audio.volume = 1
  } catch {
    // Browser may still block until a later user gesture.
  }

  if (!notificationPermissionRequested && typeof window !== 'undefined' && 'Notification' in window) {
    notificationPermissionRequested = true
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission()
      } catch {
        // Ignore permission errors.
      }
    }
  }
}

export const notifyNewTaskAssigned = ({
  pendingCount = 1,
  navigate,
} = {}) => {
  const audio = initTaskAssignmentAudio()
  try {
    audio.currentTime = 0
    audio.play().catch(() => {})
  } catch {
    // Ignore audio errors silently.
  }

  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return

  const body = pendingCount === 1
    ? 'You have a new pending task. Open My Tasks to accept it.'
    : `You have ${pendingCount} pending tasks waiting for you.`

  try {
    const notification = new Notification('New task assigned', {
      body,
      icon: '/chat-bot.svg',
      tag: 'crm-new-task-assigned',
      requireInteraction: false,
      silent: false,
    })

    notification.onclick = () => {
      window.focus()
      if (typeof navigate === 'function') navigate('/my-tasks')
      notification.close()
    }
  } catch {
    // Ignore notification errors silently.
  }
}
