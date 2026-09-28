const mongoose = require('mongoose');

const nestedMessageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    content: {
      type: String,
      default: '',
      trim: true,
      maxlength: 10000,
    },
    messageType: {
      type: String,
      enum: ['text', 'image', 'file', 'audio', 'call'],
      default: 'text',
    },
    fileUrl: {
      type: String,
      default: '',
    },
    fileName: {
      type: String,
      default: '',
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    callDuration: {
      type: Number,
      default: 0,
    },
    callStatus: {
      type: String,
      enum: ['', 'completed', 'missed', 'rejected', 'busy'],
      default: '',
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read'],
      default: 'sent',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        return ret;
      },
    },
  }
);

const conversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    // Nested array of all messages exchanged in this conversation
    messages: [nestedMessageSchema],
    lastMessage: {
      type: Object,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

conversationSchema.index({ participants: 1 });

module.exports = {
  Conversation: mongoose.model('Conversation', conversationSchema),
  nestedMessageSchema,
};
