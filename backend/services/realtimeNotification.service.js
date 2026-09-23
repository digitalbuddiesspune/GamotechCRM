/**
 * Real-time Socket.IO layer for notifications, tasks, meetings, and chat.
 * @module services/realtimeNotification.service
 */
import logger from '../utils/logger.js';

/** @type {import('socket.io').Server | null} */
let io = null;

/** @type {Set<string>} */
const onlineUsers = new Set();

export const MEETINGS_ROOM = 'meetings';

export function chatConversationRoom(conversationId) {
  return `chat:conv:${String(conversationId)}`;
}

export function chatCompanyRoom(tenantId) {
  return `chat:company:${String(tenantId)}`;
}

/**
 * Bind Socket.IO server instance (call once at app startup).
 * @param {import('socket.io').Server} socketServer
 */
export function bindSocketServer(socketServer) {
  io = socketServer;

  io.on('connection', (socket) => {
    const userId =
      socket.handshake.auth?.userId || socket.handshake.query?.userId;
    const tenantId =
      socket.handshake.auth?.tenantId || socket.handshake.query?.tenantId;

    socket.join(MEETINGS_ROOM);

    if (tenantId) {
      socket.join(chatCompanyRoom(tenantId));
    }

    if (userId) {
      const room = userRoom(userId);
      socket.join(room);
      onlineUsers.add(String(userId));
      logger.info('SocketConnect', 'User connected', {
        userId: String(userId),
        tenantId: tenantId ? String(tenantId) : undefined,
        socketId: socket.id,
      });
    } else {
      logger.info('SocketConnect', 'Anonymous client connected', {
        socketId: socket.id,
      });
    }

    socket.on('chat:join', (conversationId) => {
      const id = String(conversationId || '').trim();
      if (!id) return;
      socket.join(chatConversationRoom(id));
    });

    socket.on('chat:leave', (conversationId) => {
      const id = String(conversationId || '').trim();
      if (!id) return;
      socket.leave(chatConversationRoom(id));
    });

    socket.on('disconnect', () => {
      if (userId) {
        onlineUsers.delete(String(userId));
        logger.info('SocketDisconnect', 'User disconnected', {
          userId: String(userId),
        });
      }
    });
  });

  logger.info('SocketInit', 'Real-time socket bound');
}

/** @param {string} userId */
export function userRoom(userId) {
  return `user:${userId}`;
}

/** @returns {boolean} */
export function isRealtimeEnabled() {
  return io != null;
}

/** @param {string} userId */
export function isUserOnline(userId) {
  return onlineUsers.has(String(userId));
}

export function emitToUser(userId, payload) {
  if (!io) return false;
  io.to(userRoom(userId)).emit('notification', payload);
  logger.info('SocketDelivered', 'Real-time notification emitted', { userId });
  return true;
}

export function emitTaskChanged(userId, payload = {}) {
  if (!io || !userId) return false;
  const eventPayload = {
    reason: String(payload.reason || 'updated'),
    taskId: payload.taskId ? String(payload.taskId) : undefined,
    status: payload.status ? String(payload.status) : undefined,
    previousStatus: payload.previousStatus ? String(payload.previousStatus) : undefined,
    title: payload.title ? String(payload.title) : undefined,
    ts: new Date().toISOString(),
  };
  io.to(userRoom(userId)).emit('task:changed', eventPayload);
  logger.info('SocketDelivered', 'task:changed emitted', {
    userId: String(userId),
    ...eventPayload,
  });
  return true;
}

const participantIdsFromConversation = (conversation) => {
  const list = Array.isArray(conversation?.participants) ? conversation.participants : [];
  return list
    .map((p) => String(p?.employee?._id || p?.employee || p?._id || '').trim())
    .filter((id) => id && id !== 'undefined' && id !== 'null');
};

export function emitChatMessage({ tenantId, conversation, message }) {
  if (!io || !conversation || !message) return false;
  const conversationId = String(conversation._id || conversation);
  const payload = {
    conversationId,
    message,
    ts: new Date().toISOString(),
  };

  io.to(chatConversationRoom(conversationId)).emit('chat:message', payload);

  const listPayload = {
    conversationId,
    type: conversation.type || 'direct',
    lastMessageAt: message.createdAt || new Date().toISOString(),
    lastMessagePreview:
      message.messageType === 'poll'
        ? `Poll: ${message.poll?.question || message.body || ''}`
        : message.body ||
          (Array.isArray(message.attachments) && message.attachments.length
            ? `📎 ${message.attachments.length} attachment(s)`
            : ''),
    lastMessageSender: message.sender?._id || message.sender || null,
    ts: new Date().toISOString(),
  };

  if (conversation.type === 'team' && tenantId) {
    io.to(chatCompanyRoom(tenantId)).emit('chat:conversation:updated', listPayload);
  } else {
    for (const userId of participantIdsFromConversation(conversation)) {
      io.to(userRoom(userId)).emit('chat:conversation:updated', listPayload);
    }
  }

  logger.info('SocketDelivered', 'chat:message emitted', { conversationId });
  return true;
}

export function emitChatMessageUpdated({ conversationId, message }) {
  if (!io || !conversationId || !message) return false;
  io.to(chatConversationRoom(conversationId)).emit('chat:message:updated', {
    conversationId: String(conversationId),
    message,
    ts: new Date().toISOString(),
  });
  return true;
}

export function emitMeetingChange(_userIds = [], payload = {}) {
  if (!io) {
    logger.warn('SocketEmit', 'Socket not ready — meeting change not broadcast');
    return 0;
  }

  const eventPayload = {
    action: String(payload.action || 'updated'),
    meetingId: payload.meetingId ? String(payload.meetingId) : undefined,
    ts: new Date().toISOString(),
  };

  io.to(MEETINGS_ROOM).emit('meetings:changed', eventPayload);
  io.emit('meetings:changed', eventPayload);

  const rooms = io.sockets.adapter.rooms.get(MEETINGS_ROOM);
  const listeners = rooms?.size || 0;
  logger.info('SocketEmit', 'meetings:changed broadcast', {
    ...eventPayload,
    listeners,
  });
  return listeners;
}

export function partitionByOnlineStatus(userIds = []) {
  const online = [];
  const offline = [];
  for (const id of userIds) {
    if (isUserOnline(id)) online.push(id);
    else offline.push(id);
  }
  return { online, offline };
}

export default {
  bindSocketServer,
  isRealtimeEnabled,
  isUserOnline,
  emitToUser,
  emitTaskChanged,
  emitChatMessage,
  emitChatMessageUpdated,
  emitMeetingChange,
  partitionByOnlineStatus,
};
