import Conversation from '../../models/gamotechSolution/gamotechSolution_chatConversation.js';
import Message from '../../models/gamotechSolution/gamotechSolution_chatMessage.js';
import Employee from '../../models/gamotechSolution/gamotechSolution_employee.js';
import { createChatHandlers } from '../../utils/chat/createChatHandlers.js';
import { getChatIntegration } from '../../config/chatIntegrations.js';

const tenantId = 'gamotechSolution';

export const {
  getIntegration,
  getTeamRoom,
  getConversations,
  createOrGetConversation,
  getMessages,
  sendMessage,
  createPoll,
  votePoll,
  markConversationRead,
  getChatEmployees,
} = createChatHandlers({
  Conversation,
  Message,
  Employee,
  tenantId,
  getChatIntegration,
});
