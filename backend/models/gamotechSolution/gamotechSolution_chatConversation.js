import mongoose from 'mongoose';
import { getChatConversationFields } from '../../utils/chat/chatFields.js';

const companyPrefix = 'gamotechSolution';

const conversationSchema = new mongoose.Schema(
  {
    ...getChatConversationFields(companyPrefix),
  },
  { timestamps: true }
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

const Conversation = mongoose.model(`${companyPrefix}_ChatConversation`, conversationSchema, 'adsresearchglobal_chatconversations');

export default Conversation;
