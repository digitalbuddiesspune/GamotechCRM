import mongoose from 'mongoose';
import { buildDirectParticipantKey } from './chatFields.js';
import {
  emitChatMessage,
  emitChatMessageUpdated,
} from '../../services/realtimeNotification.service.js';

const toObjectId = (id) => {
  if (!id || !mongoose.Types.ObjectId.isValid(id)) return null;
  return new mongoose.Types.ObjectId(id);
};

const previewText = (body, max = 80) => {
  const text = String(body || '').trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
};

const TEAM_PARTICIPANT_KEY = 'team';

const toDayKey = (date) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const getDayBoundaries = (dayParam = 'today') => {
  let base = new Date();
  if (dayParam !== 'today') {
    const parsed = new Date(`${dayParam}T12:00:00`);
    if (!Number.isNaN(parsed.getTime())) base = parsed;
  }
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  const end = new Date(base);
  end.setHours(23, 59, 59, 999);
  return { start, end, dayKey: toDayKey(start) };
};

const normalizeMentions = (mentions = []) => {
  if (!Array.isArray(mentions)) return [];
  return mentions
    .filter((m) => m?.employee && mongoose.Types.ObjectId.isValid(m.employee))
    .map((m) => ({
      employee: m.employee,
      name: String(m.name || '').trim(),
    }))
    .filter((m) => m.name);
};

const getParticipantEmployeeId = (participant) => {
  if (!participant) return null;
  if (participant.employee) {
    return String(participant.employee._id || participant.employee);
  }
  return String(participant._id || participant);
};

const normalizeParticipantsArray = (participants = []) => {
  return participants
    .map((participant) => {
      const employeeId = getParticipantEmployeeId(participant);
      if (!employeeId || employeeId === 'undefined' || employeeId === 'null') return null;
      return {
        employee: toObjectId(employeeId),
        joinedAt: participant.joinedAt ? new Date(participant.joinedAt) : null,
      };
    })
    .filter(Boolean);
};

const mergeCreatedAtWithJoinedAt = (clause, joinedAt) => {
  if (!joinedAt) return clause;
  const join = new Date(joinedAt);
  if (Number.isNaN(join.getTime())) return clause;
  if (!clause) return { $gte: join };

  const merged = { ...clause };
  const bump = (key) => {
    if (!merged[key]) return;
    merged[key] = new Date(Math.max(new Date(merged[key]).getTime(), join.getTime()));
  };
  bump('$gte');
  bump('$gt');
  if (!merged.$gte && !merged.$gt) merged.$gte = join;
  return merged;
};

const buildOlderThanFilter = (beforeDate, joinedAt) => {
  const filter = { $lt: beforeDate };
  if (!joinedAt) return filter;

  const join = new Date(joinedAt);
  if (Number.isNaN(join.getTime())) return filter;
  if (join >= beforeDate) return null;
  filter.$gte = join;
  return filter;
};

const buildUnreadMessageFilter = (conversationId, employeeId, joinedAt) => ({
  conversation: conversationId,
  sender: { $ne: employeeId },
  readBy: { $not: { $elemMatch: { employee: employeeId } } },
  ...(() => {
    const createdAt = mergeCreatedAtWithJoinedAt(null, joinedAt);
    return createdAt ? { createdAt } : {};
  })(),
});

export const createChatHandlers = ({ Conversation, Message, Employee, tenantId, getChatIntegration }) => {
  const ensureTeamConversation = async () => {
    let conversation = await Conversation.findOne({ type: 'team', participantKey: TEAM_PARTICIPANT_KEY });
    if (!conversation) {
      conversation = await Conversation.create({
        type: 'team',
        participantKey: TEAM_PARTICIPANT_KEY,
        title: 'Team Chat',
        participants: [],
        lastMessageAt: new Date(),
      });
    }
    return conversation;
  };

  const ensureTeamMemberJoined = async (conv, employeeId) => {
    const empKey = String(employeeId);
    const members = normalizeParticipantsArray(conv.participants);
    const existing = members.find((member) => String(member.employee) === empKey);

    if (existing?.joinedAt) {
      return new Date(existing.joinedAt);
    }

    const employee = await Employee.findById(employeeId).select('_id createdAt');
    const now = new Date();
    const hasPriorMessages = await Message.exists({
      conversation: conv._id,
      sender: employeeId,
    });

    let joinedAt = now;
    if (hasPriorMessages) {
      joinedAt = conv.createdAt || now;
    } else {
      const firstMessage = await Message.findOne({ conversation: conv._id })
        .sort({ createdAt: 1 })
        .select('createdAt')
        .lean();
      const employeeCreatedAt = employee?.createdAt ? new Date(employee.createdAt) : now;
      if (firstMessage?.createdAt && employeeCreatedAt <= new Date(firstMessage.createdAt)) {
        joinedAt = conv.createdAt || new Date(firstMessage.createdAt);
      }
    }

    if (existing) {
      existing.joinedAt = joinedAt;
    } else {
      members.push({ employee: toObjectId(employeeId), joinedAt });
    }

    await Conversation.findByIdAndUpdate(conv._id, { participants: members });
    return joinedAt;
  };

  const getMemberJoinedAt = (conv, employeeId) => {
    const members = normalizeParticipantsArray(conv.participants);
    const member = members.find((entry) => String(entry.employee) === String(employeeId));
    return member?.joinedAt ? new Date(member.joinedAt) : null;
  };

  const assertCanAccess = async (conversationId, employeeId) => {
    const conv = await Conversation.findById(conversationId);
    if (!conv) return { error: { status: 404, message: 'Conversation not found' } };

    const employee = await Employee.findById(employeeId).select('_id name');
    if (!employee) return { error: { status: 403, message: 'Invalid employee' } };

    if (conv.type === 'team') {
      const joinedAt = await ensureTeamMemberJoined(conv, employeeId);
      return { conv, employee, joinedAt };
    }

    const isMember = normalizeParticipantsArray(conv.participants)
      .some((member) => String(member.employee) === String(employeeId));
    if (!isMember) return { error: { status: 403, message: 'Not a participant in this conversation' } };

    const joinedAt = getMemberJoinedAt(conv, employeeId) || conv.createdAt || new Date();
    return { conv, employee, joinedAt };
  };

  const getIntegration = async (_req, res) => {
    try {
      const integration = getChatIntegration(tenantId);
      res.status(200).json({ integration });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching chat integration', error: error?.message });
    }
  };

  const getTeamRoom = async (req, res) => {
    try {
      const { employeeId } = req.query;
      if (!employeeId) {
        return res.status(400).json({ message: 'employeeId is required' });
      }

      const employee = await Employee.findById(employeeId).select('_id name email');
      if (!employee) {
        return res.status(403).json({ message: 'Invalid employee' });
      }

      const conversation = await ensureTeamConversation();
      const joinedAt = await ensureTeamMemberJoined(conversation, employeeId);
      const unreadCount = await Message.countDocuments(
        buildUnreadMessageFilter(conversation._id, employeeId, joinedAt)
      );

      res.status(200).json({
        conversation: {
          ...conversation.toObject(),
          joinedAt,
          unreadCount,
        },
        currentUser: employee,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching team chat', error: error?.message });
    }
  };

  const enrichConversation = async (conv, employeeId, { isTeam = false } = {}) => {
    const convObj = typeof conv.toObject === 'function' ? conv.toObject() : conv;
    let joinedAt;

    if (isTeam || convObj.type === 'team') {
      joinedAt = await ensureTeamMemberJoined(conv, employeeId);
    } else {
      joinedAt = getMemberJoinedAt(conv, employeeId) || convObj.createdAt || new Date();
    }

    const unreadCount = await Message.countDocuments(
      buildUnreadMessageFilter(convObj._id, employeeId, joinedAt)
    );

    let peer = null;
    let title = convObj.title || 'Team Chat';

    if (convObj.type === 'direct') {
      const populated = await Conversation.findById(convObj._id)
        .populate('participants.employee', 'name email department')
        .lean();
      const peerParticipant = (populated?.participants || []).find(
        (participant) => String(participant.employee?._id || participant.employee) !== String(employeeId)
      );
      peer = peerParticipant?.employee || null;
      title = peer?.name || 'Direct Chat';
    }

    return {
      ...convObj,
      peer,
      title,
      joinedAt,
      unreadCount,
    };
  };

  const getConversations = async (req, res) => {
    try {
      const { employeeId } = req.query;
      if (!employeeId) {
        return res.status(400).json({ message: 'employeeId is required' });
      }

      const teamConversation = await ensureTeamConversation();
      const teamItem = await enrichConversation(teamConversation, employeeId, { isTeam: true });
      teamItem.title = 'Team Chat';

      const directConversations = await Conversation.find({
        type: 'direct',
        'participants.employee': employeeId,
      }).sort({ lastMessageAt: -1 });

      const directItems = await Promise.all(
        directConversations.map((conversation) => enrichConversation(conversation, employeeId))
      );

      res.status(200).json({
        conversations: [teamItem, ...directItems],
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching conversations', error: error?.message });
    }
  };

  const createOrGetConversation = async (req, res) => {
    try {
      const { employeeId, peerId } = req.body;
      if (!employeeId || !peerId) {
        return res.status(400).json({ message: 'employeeId and peerId are required' });
      }
      if (String(employeeId) === String(peerId)) {
        return res.status(400).json({ message: 'Cannot start a chat with yourself' });
      }

      const peer = await Employee.findById(peerId).select('name email department');
      if (!peer) {
        return res.status(404).json({ message: 'Peer employee not found' });
      }

      const participantKey = buildDirectParticipantKey(employeeId, peerId);
      let conversation = await Conversation.findOne({ participantKey })
        .populate('participants.employee', 'name email department')
        .populate('lastMessageSender', 'name');

      if (!conversation) {
        const joinedAt = new Date();
        conversation = await Conversation.create({
          type: 'direct',
          participants: [
            { employee: employeeId, joinedAt },
            { employee: peerId, joinedAt },
          ],
          participantKey,
          lastMessageAt: joinedAt,
        });
        conversation = await Conversation.findById(conversation._id)
          .populate('participants.employee', 'name email department')
          .populate('lastMessageSender', 'name');
      }

      res.status(200).json({
        conversation: {
          ...(await enrichConversation(conversation, employeeId)),
          peer,
        },
      });
    } catch (error) {
      res.status(500).json({ message: 'Error creating conversation', error: error?.message });
    }
  };

  const getMessages = async (req, res) => {
    try {
      const { id } = req.params;
      const { employeeId, after, day = 'today', limit = 200 } = req.query;
      if (!employeeId) {
        return res.status(400).json({ message: 'employeeId is required' });
      }

      const { error, joinedAt } = await assertCanAccess(id, employeeId);
      if (error) return res.status(error.status).json({ message: error.message });

      const filter = { conversation: id };
      let responseDay = null;
      let hasOlder = false;

      if (after) {
        const afterDate = new Date(after);
        if (!Number.isNaN(afterDate.getTime())) {
          filter.createdAt = mergeCreatedAtWithJoinedAt({ $gt: afterDate }, joinedAt);
        } else if (joinedAt) {
          filter.createdAt = mergeCreatedAtWithJoinedAt(null, joinedAt);
        }
      } else {
        const { start, end, dayKey } = getDayBoundaries(day);
        responseDay = dayKey;

        if (joinedAt && new Date(joinedAt) > end) {
          filter.createdAt = { $gte: new Date(joinedAt), $lte: end };
          hasOlder = false;
        } else {
          const effectiveStart = joinedAt && new Date(joinedAt) > start ? new Date(joinedAt) : start;
          filter.createdAt = { $gte: effectiveStart, $lte: end };
          const olderFilter = buildOlderThanFilter(start, joinedAt);
          hasOlder = olderFilter
            ? Boolean(await Message.exists({ conversation: id, createdAt: olderFilter }))
            : false;
        }
      }

      const messages = await Message.find(filter)
        .sort({ createdAt: 1 })
        .limit(Math.min(Number(limit) || 200, 300))
        .populate('sender', 'name email department')
        .populate('mentions.employee', 'name email')
        .populate('poll.options.votes.employee', 'name')
        .lean();

      if (after) {
        res.status(200).json({ messages });
        return;
      }

      res.status(200).json({
        messages,
        day: responseDay,
        hasOlder,
        joinedAt,
      });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching messages', error: error?.message });
    }
  };

  const sendMessage = async (req, res) => {
    try {
      const { id } = req.params;
      const { employeeId, body, mentions, attachments } = req.body;
      const normalizedAttachments = (Array.isArray(attachments) ? attachments : [])
        .map((item) => ({
          url: String(item?.url || '').trim(),
          fileName: String(item?.fileName || '').trim(),
          mimeType: String(item?.mimeType || '').trim(),
          size: Number(item?.size) || 0,
        }))
        .filter((item) => item.url);

      const text = String(body || '').trim();
      if (!employeeId || (!text && !normalizedAttachments.length)) {
        return res.status(400).json({ message: 'employeeId and body or attachments are required' });
      }

      const { error, conv, employee } = await assertCanAccess(id, employeeId);
      if (error) return res.status(error.status).json({ message: error.message });

      const normalizedMentions = normalizeMentions(mentions);
      const preview = text
        || (normalizedAttachments.length === 1
          ? `📎 ${normalizedAttachments[0].fileName || 'Attachment'}`
          : `📎 ${normalizedAttachments.length} attachments`);

      const message = await Message.create({
        conversation: id,
        sender: employee._id,
        body: text,
        attachments: normalizedAttachments,
        messageType: normalizedAttachments.length && !text ? 'file' : 'text',
        mentions: normalizedMentions,
        readBy: [{ employee: employee._id, readAt: new Date() }],
      });

      await Conversation.findByIdAndUpdate(conv._id, {
        lastMessageAt: new Date(),
        lastMessagePreview: previewText(preview),
        lastMessageSender: employee._id,
      });

      const populated = await Message.findById(message._id)
        .populate('sender', 'name email department')
        .populate('mentions.employee', 'name email')
        .lean();

      emitChatMessage({ tenantId, conversation: conv, message: populated });
      res.status(201).json({ message: populated });
    } catch (error) {
      res.status(500).json({ message: 'Error sending message', error: error?.message });
    }
  };

  const createPoll = async (req, res) => {
    try {
      const { id } = req.params;
      const { employeeId, question, options, allowMultiple = false } = req.body;
      if (!employeeId || !question?.trim()) {
        return res.status(400).json({ message: 'employeeId and question are required' });
      }

      const cleanedOptions = (Array.isArray(options) ? options : [])
        .map((opt) => String(opt || '').trim())
        .filter(Boolean);

      if (cleanedOptions.length < 2) {
        return res.status(400).json({ message: 'At least 2 poll options are required' });
      }
      if (cleanedOptions.length > 10) {
        return res.status(400).json({ message: 'Maximum 10 poll options are allowed' });
      }

      const { error, conv, employee } = await assertCanAccess(id, employeeId);
      if (error) return res.status(error.status).json({ message: error.message });

      const pollOptions = cleanedOptions.map((text) => ({ text, votes: [] }));
      const trimmedQuestion = question.trim();

      const message = await Message.create({
        conversation: id,
        sender: employee._id,
        messageType: 'poll',
        body: trimmedQuestion,
        poll: {
          question: trimmedQuestion,
          options: pollOptions,
          allowMultiple: Boolean(allowMultiple),
        },
        readBy: [{ employee: employee._id, readAt: new Date() }],
      });

      await Conversation.findByIdAndUpdate(conv._id, {
        lastMessageAt: new Date(),
        lastMessagePreview: previewText(`Poll: ${trimmedQuestion}`),
        lastMessageSender: employee._id,
      });

      const populated = await Message.findById(message._id)
        .populate('sender', 'name email department')
        .populate('poll.options.votes.employee', 'name')
        .lean();

      emitChatMessage({ tenantId, conversation: conv, message: populated });
      res.status(201).json({ message: populated });
    } catch (error) {
      res.status(500).json({ message: 'Error creating poll', error: error?.message });
    }
  };

  const votePoll = async (req, res) => {
    try {
      const { messageId } = req.params;
      const { employeeId, optionIndex } = req.body;
      if (!employeeId || optionIndex === undefined || optionIndex === null) {
        return res.status(400).json({ message: 'employeeId and optionIndex are required' });
      }

      const index = Number(optionIndex);
      if (!Number.isInteger(index) || index < 0) {
        return res.status(400).json({ message: 'Invalid optionIndex' });
      }

      const message = await Message.findById(messageId);
      if (!message || message.messageType !== 'poll' || !message.poll) {
        return res.status(404).json({ message: 'Poll not found' });
      }

      const { error } = await assertCanAccess(message.conversation, employeeId);
      if (error) return res.status(error.status).json({ message: error.message });

      if (!message.poll.options[index]) {
        return res.status(400).json({ message: 'Invalid poll option' });
      }

      const now = new Date();
      const employeeKey = String(employeeId);

      if (!message.poll.allowMultiple) {
        message.poll.options.forEach((opt) => {
          opt.votes = opt.votes.filter((v) => String(v.employee) !== employeeKey);
        });
        message.poll.options[index].votes.push({ employee: employeeId, votedAt: now });
      } else {
        const option = message.poll.options[index];
        const existingIdx = option.votes.findIndex((v) => String(v.employee) === employeeKey);
        if (existingIdx >= 0) {
          option.votes.splice(existingIdx, 1);
        } else {
          option.votes.push({ employee: employeeId, votedAt: now });
        }
      }

      await message.save();

      const populated = await Message.findById(message._id)
        .populate('sender', 'name email department')
        .populate('poll.options.votes.employee', 'name')
        .lean();

      emitChatMessageUpdated({ conversationId: message.conversation, message: populated });
      res.status(200).json({ message: populated });
    } catch (error) {
      res.status(500).json({ message: 'Error voting on poll', error: error?.message });
    }
  };

  const markConversationRead = async (req, res) => {
    try {
      const { id } = req.params;
      const { employeeId } = req.body;
      if (!employeeId) {
        return res.status(400).json({ message: 'employeeId is required' });
      }

      const { error, joinedAt } = await assertCanAccess(id, employeeId);
      if (error) return res.status(error.status).json({ message: error.message });

      const unread = await Message.find(buildUnreadMessageFilter(id, employeeId, joinedAt));

      const now = new Date();
      await Promise.all(
        unread.map((msg) => {
          msg.readBy.push({ employee: toObjectId(employeeId), readAt: now });
          return msg.save();
        })
      );

      res.status(200).json({ marked: unread.length });
    } catch (error) {
      res.status(500).json({ message: 'Error marking conversation read', error: error?.message });
    }
  };

  const getChatEmployees = async (req, res) => {
    try {
      const { search = '' } = req.query;
      const filter = {};
      if (search.trim()) {
        const q = search.trim();
        filter.$or = [
          { name: { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
          { department: { $regex: q, $options: 'i' } },
        ];
      }

      const employees = await Employee.find(filter)
        .select('name email department')
        .sort({ name: 1 })
        .limit(100)
        .lean();

      res.status(200).json({ employees });
    } catch (error) {
      res.status(500).json({ message: 'Error fetching employees', error: error?.message });
    }
  };

  return {
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
  };
};
