import { io } from 'socket.io-client'

let socket = null
let connectedUserId = null
let connectedTenantId = null

/** API base like https://host/api/v1/tenant → socket origin https://host */
export const getSocketOrigin = () => {
  const api = import.meta.env.VITE_API_URL || ''
  try {
    return new URL(api).origin
  } catch {
    if (typeof window !== 'undefined') return window.location.origin
    return ''
  }
}

/** Last path segment of VITE_API_URL (e.g. salesTechReality). */
export const getTenantId = () => {
  const api = import.meta.env.VITE_API_URL || ''
  try {
    const parts = new URL(api).pathname.split('/').filter(Boolean)
    return parts[parts.length - 1] || ''
  } catch {
    return ''
  }
}

/**
 * Shared Socket.IO connection for the logged-in employee.
 * Reuses one connection; reconnects when userId changes.
 */
export const connectRealtimeSocket = (userId, options = {}) => {
  const id = userId ? String(userId) : ''
  const tenantId = String(options.tenantId || getTenantId() || '').trim()
  if (!id) {
    disconnectRealtimeSocket()
    return null
  }

  if (socket && connectedUserId === id && connectedTenantId === tenantId) {
    if (!socket.connected) socket.connect()
    return socket
  }

  disconnectRealtimeSocket()

  const origin = getSocketOrigin()
  if (!origin) return null

  socket = io(origin, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    auth: { userId: id, tenantId },
    query: { userId: id, tenantId },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  })
  connectedUserId = id
  connectedTenantId = tenantId
  return socket
}

export const getRealtimeSocket = () => socket

export const disconnectRealtimeSocket = () => {
  if (socket) {
    socket.disconnect()
    socket = null
  }
  connectedUserId = null
  connectedTenantId = null
}

/** Subscribe to task list changes for the current user. Returns unsubscribe. */
export const onTaskChanged = (handler) => {
  if (!socket || typeof handler !== 'function') return () => {}
  socket.on('task:changed', handler)
  return () => {
    socket?.off('task:changed', handler)
  }
}

export const joinChatConversation = (conversationId) => {
  const id = conversationId ? String(conversationId) : ''
  if (!socket || !id) return
  socket.emit('chat:join', id)
}

export const leaveChatConversation = (conversationId) => {
  const id = conversationId ? String(conversationId) : ''
  if (!socket || !id) return
  socket.emit('chat:leave', id)
}

export const onChatMessage = (handler) => {
  if (!socket || typeof handler !== 'function') return () => {}
  socket.on('chat:message', handler)
  return () => {
    socket?.off('chat:message', handler)
  }
}

export const onChatMessageUpdated = (handler) => {
  if (!socket || typeof handler !== 'function') return () => {}
  socket.on('chat:message:updated', handler)
  return () => {
    socket?.off('chat:message:updated', handler)
  }
}

export const onChatConversationUpdated = (handler) => {
  if (!socket || typeof handler !== 'function') return () => {}
  socket.on('chat:conversation:updated', handler)
  return () => {
    socket?.off('chat:conversation:updated', handler)
  }
}
