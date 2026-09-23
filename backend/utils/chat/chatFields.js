import mongoose from 'mongoose';

export const getChatConversationFields = (companyPrefix) => ({
  type: {
    type: String,
    enum: ['direct', 'group', 'team'],
    default: 'direct',
  },
  participants: [
    {
      employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${companyPrefix}_Employee`,
      },
      joinedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  participantKey: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  title: {
    type: String,
    default: '',
  },
  lastMessageAt: {
    type: Date,
    default: Date.now,
  },
  lastMessagePreview: {
    type: String,
    default: '',
  },
  lastMessageSender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: `${companyPrefix}_Employee`,
  },
});

export const getChatMessageFields = (companyPrefix) => ({
  conversation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: `${companyPrefix}_ChatConversation`,
    required: true,
    index: true,
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: `${companyPrefix}_Employee`,
    required: true,
  },
  body: {
    type: String,
    trim: true,
    maxlength: 5000,
    default: '',
  },
  attachments: [
    {
      url: { type: String, trim: true, required: true },
      fileName: { type: String, trim: true, default: '' },
      mimeType: { type: String, trim: true, default: '' },
      size: { type: Number, default: 0 },
    },
  ],
  messageType: {
    type: String,
    enum: ['text', 'system', 'poll', 'file'],
    default: 'text',
  },
  readBy: [
    {
      employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${companyPrefix}_Employee`,
      },
      readAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  mentions: [
    {
      employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: `${companyPrefix}_Employee`,
      },
      name: {
        type: String,
        trim: true,
      },
    },
  ],
  poll: {
    question: {
      type: String,
      trim: true,
      default: '',
    },
    options: [
      {
        text: {
          type: String,
          trim: true,
          required: true,
        },
        votes: [
          {
            employee: {
              type: mongoose.Schema.Types.ObjectId,
              ref: `${companyPrefix}_Employee`,
            },
            votedAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
      },
    ],
    allowMultiple: {
      type: Boolean,
      default: false,
    },
  },
});

export const buildDirectParticipantKey = (idA, idB) => {
  return [String(idA), String(idB)].sort().join(':');
};
