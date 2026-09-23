import mongoose from 'mongoose';
import { getChatMessageFields } from '../../utils/chat/chatFields.js';

const companyPrefix = 'gamotechSolution';

const messageSchema = new mongoose.Schema(
  {
    ...getChatMessageFields(companyPrefix),
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: 1 });
// Auto-delete messages 7 days after creation (MongoDB TTL)
messageSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 });

const Message = mongoose.model(`${companyPrefix}_ChatMessage`, messageSchema, 'adsresearchglobal_chatmessages');

export default Message;
