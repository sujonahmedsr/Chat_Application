const Message = require('../models/Message');
const { Conversation } = require('../models/Conversation');
const Group = require('../models/Group');
const { isSuperAdminEmail } = require('../utils/superAdmin');
const { encryptServerMessage, decryptServerMessage } = require('../utils/encryption');

const MAX_CHAT_MESSAGES = 300;

// Enforce 300 messages cap for 1-to-1 conversation
const enforceMessageCap = async (userA, userB) => {
  try {
    const excess = await Message.find({
      $or: [
        { senderId: userA, receiverId: userB },
        { senderId: userB, receiverId: userA },
      ],
    })
      .sort({ timestamp: -1 })
      .skip(MAX_CHAT_MESSAGES)
      .select('_id');

    if (excess.length > 0) {
      await Message.deleteMany({ _id: { $in: excess.map((m) => m._id) } });
    }
  } catch (err) {
    console.error('[MessageCap] Error capping messages:', err);
  }
};

const getChatHistory = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;
    const userSettings = req.user.settings || {};

    // Calculate retention cutoff if configured
    let cutoffDate = null;
    if (userSettings.saveChatHistory === false) {
      // Disappearing / unsaved: show only messages from past 24 hours
      cutoffDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (userSettings.chatRetentionDays && userSettings.chatRetentionDays > 0) {
      cutoffDate = new Date(Date.now() - userSettings.chatRetentionDays * 24 * 60 * 60 * 1000);
    }

    // Check nested Conversation document first
    const conv = await Conversation.findOne({
      participants: { $all: [currentUserId, targetUserId] },
    });

    if (conv && conv.messages && conv.messages.length > 0) {
      let filteredMessages = conv.messages;
      if (cutoffDate) {
        filteredMessages = filteredMessages.filter(
          (m) => new Date(m.timestamp) >= cutoffDate
        );
      }
      // Return maximum last 300 messages
      if (filteredMessages.length > MAX_CHAT_MESSAGES) {
        filteredMessages = filteredMessages.slice(-MAX_CHAT_MESSAGES);
      }
      return res.status(200).json({
        messages: filteredMessages.map((m) => {
          const json = m.toJSON ? m.toJSON() : m;
          return {
            ...json,
            content: decryptServerMessage(json.content),
          };
        }),
      });
    }

    // Fallback to flat messages collection
    const query = {
      $or: [
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId },
      ],
    };

    if (cutoffDate) {
      query.timestamp = { $gte: cutoffDate };
    }

    const messages = await Message.find(query)
      .sort({ timestamp: 1 })
      .limit(MAX_CHAT_MESSAGES);

    return res.status(200).json({
      messages: messages.map((m) => {
        const json = m.toJSON();
        return {
          ...json,
          content: decryptServerMessage(json.content),
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

const markMessagesAsRead = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const senderId = req.params.userId;

    const updateResult = await Message.updateMany(
      {
        senderId,
        receiverId: currentUserId,
        status: { $ne: 'read' },
      },
      {
        $set: { status: 'read' },
      }
    );

    // Also update nested conversation messages
    await Conversation.updateOne(
      {
        participants: { $all: [currentUserId, senderId] },
      },
      {
        $set: { 'messages.$[elem].status': 'read' },
      },
      {
        arrayFilters: [{ 'elem.senderId': senderId, 'elem.status': { $ne: 'read' } }],
      }
    );

    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().to(`user:${senderId}`).emit('message:read', {
        readerId: String(currentUserId),
      });
      getIO().to(`user:${currentUserId}`).emit('message:read', {
        readerId: String(currentUserId),
      });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { receiverId, content, messageType = 'text', fileUrl = '', fileName = '', fileSize = 0, replyTo = null } = req.body;

    if (!receiverId || (!content?.trim() && !fileUrl)) {
      return res.status(400).json({ message: 'receiverId and content/attachment are required' });
    }

    // Verify neither user has blocked the other
    const User = require('../models/User');
    const sender = await User.findById(currentUserId);
    const receiver = await User.findById(receiverId);

    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    const isSuperAdmin = isSuperAdminEmail(sender?.email) || sender?.role === 'admin';
    if (!isSuperAdmin) {
      const isBlocked =
        receiver.blockedUsers?.some((id) => String(id) === String(currentUserId)) ||
        sender.blockedUsers?.some((id) => String(id) === String(receiverId));
      if (isBlocked) {
        return res.status(403).json({ message: 'Cannot send message: user is blocked' });
      }
    }

    const messageData = {
      senderId: currentUserId,
      receiverId,
      content: encryptServerMessage((content || '').trim()),
      messageType,
      fileUrl,
      fileName,
      fileSize,
      replyTo: replyTo && replyTo.id ? {
        id: String(replyTo.id),
        content: (replyTo.content || '').substring(0, 200),
        senderName: replyTo.senderName || '',
      } : undefined,
      status: 'sent',
      timestamp: new Date(),
    };

    const message = await Message.create(messageData);

    const nestedData = {
      ...messageData,
      _id: message._id,
    };

    // Save inside nested Conversation document with 300 slice cap
    await Conversation.findOneAndUpdate(
      {
        participants: { $all: [currentUserId, receiverId] },
      },
      {
        $setOnInsert: { participants: [currentUserId, receiverId] },
        $push: {
          messages: {
            $each: [nestedData],
            $slice: -MAX_CHAT_MESSAGES,
          },
        },
        $set: { lastMessage: nestedData, updatedAt: new Date() },
      },
      { upsert: true, new: true }
    );

    // Asynchronously prune older messages beyond 300
    enforceMessageCap(currentUserId, receiverId);

    try {
      const { getIO } = require('../sockets/socketManager');
      const senderUser = await User.findById(currentUserId, 'name avatar email');
      const messageJSON = {
        ...message.toJSON(),
        content: decryptServerMessage(message.content),
        sender: senderUser ? senderUser.toJSON() : null,
      };
      getIO().to(`user:${String(receiverId)}`).emit('message:receive', messageJSON);
      getIO().to(`user:${String(currentUserId)}`).emit('message:receive', messageJSON);
      getIO().to(`user:${String(currentUserId)}`).emit('message:sent-sync', messageJSON);
    } catch (e) {}

    return res.status(201).json({
      message: {
        ...message.toJSON(),
        content: decryptServerMessage(message.content),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete single message:
// 1-to-1 chat: ONLY the sender can delete their own message.
// Group chat: ONLY the group creator or message sender can delete.
const deleteMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { id } = req.params;

    const mongoose = require('mongoose');
    if (!id || typeof id !== 'string' || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(200).json({ success: true, message: 'Message deleted successfully' });
    }

    const objectId = new mongoose.Types.ObjectId(id);

    // 1. Look in Message collection
    const message = await Message.findById(objectId);
    let senderId = message?.senderId;
    let receiverId = message?.receiverId;
    let groupId = message?.groupId;
    let content = message?.content;
    let timestamp = message?.timestamp;

    if (message) {
      if (message.groupId) {
        const grp = await Group.findById(message.groupId);
        const isGroupCreator = grp && String(grp.creator) === String(currentUserId);
        const isSender = String(message.senderId) === String(currentUserId);
        if (!isGroupCreator && !isSender) {
          return res.status(403).json({ message: 'Only the message sender or group creator can delete this message' });
        }
      } else {
        // Direct 1-to-1 message: ONLY the sender can delete their own message!
        const isSender = String(message.senderId) === String(currentUserId);
        if (!isSender) {
          return res.status(403).json({ message: 'You can only delete your own messages' });
        }
      }
      await Message.findByIdAndDelete(objectId);
    }

    // 2. Look in Conversation by subdocument _id
    const conv = await Conversation.findOne({ 'messages._id': objectId });
    if (conv) {
      const nestedMsg = conv.messages.id(objectId);
      if (nestedMsg) {
        const isSender = String(nestedMsg.senderId) === String(currentUserId);
        if (!isSender && !message) {
          return res.status(403).json({ message: 'You can only delete your own messages' });
        }
        senderId = senderId || nestedMsg.senderId;
        receiverId = receiverId || nestedMsg.receiverId;
      }
      conv.messages.pull(objectId);
      conv.lastMessage = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
      await conv.save();
    }

    // 3. Look in Group by subdocument _id
    const grp = await Group.findOne({ 'messages._id': objectId });
    if (grp) {
      const nestedMsg = grp.messages.id(objectId);
      if (nestedMsg) {
        const isGroupCreator = String(grp.creator) === String(currentUserId);
        const isSender = String(nestedMsg.senderId) === String(currentUserId);
        if (!isGroupCreator && !isSender && !message) {
          return res.status(403).json({ message: 'Only the message sender or group creator can delete this message' });
        }
        senderId = senderId || nestedMsg.senderId;
        groupId = groupId || grp._id;
      }
      grp.messages.pull(objectId);
      grp.lastMessage = grp.messages.length > 0 ? grp.messages[grp.messages.length - 1] : null;
      await grp.save();
    }

    // 4. Also clean up any lingering message in Conversation for these participants
    if (senderId && receiverId) {
      await Conversation.updateMany(
        { participants: { $all: [senderId, receiverId] } },
        {
          $pull: {
            messages: {
              $or: [
                { _id: objectId },
                ...(content && timestamp ? [{ senderId, content, timestamp }] : [])
              ]
            }
          }
        }
      );
    }

    // 5. Also clean up lingering message in Group
    if (groupId) {
      await Group.findByIdAndUpdate(groupId, {
        $pull: {
          messages: {
            $or: [
              { _id: objectId },
              ...(content && timestamp ? [{ senderId, content, timestamp }] : [])
            ]
          }
        }
      });
    }

    try {
      const { getIO } = require('../sockets/socketManager');
      const io = getIO();
      if (groupId) {
        io.to(`group:${groupId}`).emit('message:deleted', {
          messageId: String(objectId),
          groupId: String(groupId),
        });
      }
      if (receiverId) {
        io.to(`user:${receiverId}`).emit('message:deleted', {
          messageId: String(objectId),
          senderId: String(senderId || currentUserId),
        });
      }
      io.to(`user:${currentUserId}`).emit('message:deleted', {
        messageId: String(objectId),
      });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
      messageId: String(objectId),
      receiverId: receiverId ? String(receiverId) : null,
      groupId: groupId ? String(groupId) : null,
    });
  } catch (error) {
    next(error);
  }
};

// Clear full message history between two users
const clearChatHistory = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { peerId } = req.body;

    if (!peerId) {
      return res.status(400).json({ message: 'peerId is required' });
    }

    // 1. Delete flat messages between these users
    await Message.deleteMany({
      $or: [
        { senderId: currentUserId, receiverId: peerId },
        { senderId: peerId, receiverId: currentUserId },
      ],
    });

    // 2. Clear messages in Conversation document
    await Conversation.findOneAndUpdate(
      { participants: { $all: [currentUserId, peerId] } },
      { $set: { messages: [], lastMessage: null, updatedAt: new Date() } }
    );

    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().to(`user:${peerId}`).emit('conversation:cleared', { peerId: String(currentUserId) });
      getIO().to(`user:${currentUserId}`).emit('conversation:cleared', { peerId: String(peerId) });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: 'Chat history cleared successfully',
      peerId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChatHistory,
  markMessagesAsRead,
  sendMessage,
  deleteMessage,
  clearChatHistory,
  enforceMessageCap,
  MAX_CHAT_MESSAGES,
};
