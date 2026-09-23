import { Router } from 'express';
import {
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
} from '../../controllers/gamotechSolution/gamotechSolution_chatController.js';

const router = Router();

router.get('/chat/integration', getIntegration);
router.get('/chat/team', getTeamRoom);
router.get('/chat/conversations', getConversations);
router.post('/chat/conversations', createOrGetConversation);
router.get('/chat/conversations/:id/messages', getMessages);
router.post('/chat/conversations/:id/messages', sendMessage);
router.post('/chat/conversations/:id/polls', createPoll);
router.post('/chat/messages/:messageId/vote', votePoll);
router.patch('/chat/conversations/:id/read', markConversationRead);
router.get('/chat/employees', getChatEmployees);

export default router;
