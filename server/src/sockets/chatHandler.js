const Message = require('../models/Message');
const User = require('../models/User');
const Group = require('../models/Group');
const { Conversation } = require('../models/Conversation');
const { isUserOnline } = require('./presenceHandler');
const { isSuperAdminEmail } = require('../utils/superAdmin');
const { encryptServerMessage, decryptServerMessage } = require('../utils/encryption');

const MAX_SOCKET_MESSAGES = 300;

const registerChatHandlers = (io, socket) => {
  // Join a new group room dynamically
  socket.on('group:join', ({ groupId }) => {
    if (groupId) {
      socket.join(`group:${groupId}`);
      console.log(`[Socket] User ${socket.userId} joined group:${groupId}`);
    }
  });

  // Send message (direct or group)
  socket.on('message:send', async (data, callback) => {
    try {
      const senderId = socket.userId;
      if (!senderId) {
        if (callback) callback({ error: 'Unauthorized socket' });
        return;
      }

      const {
        receiverId,
        groupId,
        content = '',
        messageType = 'text',
        fileUrl = '',
        fileName = '',
        fileSize = 0,
        callDuration = 0,
        callStatus = '',
        replyTo = null,
        tempId,
      } = data;

      if (!receiverId && !groupId) {
        if (callback) callback({ error: 'receiverId or groupId is required' });
        return;
      }

      if (!content.trim() && !fileUrl && messageType !== 'call') {
        if (callback) callback({ error: 'Message content or attachment is required' });
        return;
      }

      // Check if blocked in 1-to-1
      if (receiverId) {
        const receiver = await User.findById(receiverId);
        const sender = await User.findById(senderId);
        const isSuperAdmin = isSuperAdminEmail(sender?.email) || sender?.role === 'admin';
        if (!isSuperAdmin) {
          const isBlocked =
            receiver?.blockedUsers?.some((id) => String(id) === String(senderId)) ||
            sender?.blockedUsers?.some((id) => String(id) === String(receiverId));
          if (isBlocked) {
            if (callback) callback({ error: 'Cannot send message to this user' });
            return;
          }
        }
      }

      const formattedReplyTo = replyTo && replyTo.id ? {
        id: String(replyTo.id),
        content: (replyTo.content || '').substring(0, 200),
        senderName: replyTo.senderName || '',
      } : undefined;

      // Group message flow - capped to 300 messages
      if (groupId) {
        socket.join(`group:${groupId}`);
        const messageData = {
          senderId,
          content: encryptServerMessage(content.trim()),
          messageType,
          fileUrl,
          fileName,
          fileSize,
          callDuration,
          callStatus,
          replyTo: formattedReplyTo,
          status: 'delivered',
          timestamp: new Date(),
        };

        // Create flat Message document
        const message = await Message.create({
          ...messageData,
          groupId,
        });

        const nestedData = {
          ...messageData,
          _id: message._id,
        };

        // Store nested inside Group document, slice to keep latest 300 messages only
        await Group.findByIdAndUpdate(groupId, {
          $push: {
            messages: {
              $each: [nestedData],
              $slice: -MAX_SOCKET_MESSAGES,
            },
          },
          $set: { lastMessage: nestedData, updatedAt: new Date() },
        });

        // Async clean flat messages beyond 300
        Message.find({ groupId })
          .sort({ timestamp: -1 })
          .skip(MAX_SOCKET_MESSAGES)
          .select('_id')
          .then((excess) => {
            if (excess.length > 0) {
              Message.deleteMany({ _id: { $in: excess.map((m) => m._id) } }).catch(() => {});
            }
          })
          .catch(() => {});

        const sender = await User.findById(senderId, 'name avatar email');
        const messageJSON = {
          ...message.toJSON(),
          content: decryptServerMessage(message.content),
          sender: sender ? sender.toJSON() : null,
        };

        // Broadcast to all sockets in the group room
        io.to(`group:${String(groupId)}`).emit('group:message:receive', messageJSON);

        if (callback) {
          callback({ success: true, message: messageJSON, tempId });
        }
        return;
      }

      // 1-to-1 direct message flow - capped to 300 messages
      const receiverOnline = isUserOnline(receiverId);
      const initialStatus = receiverOnline ? 'delivered' : 'sent';

      const messageData = {
        senderId,
        receiverId,
        content: encryptServerMessage(content.trim()),
        messageType,
        fileUrl,
        fileName,
        fileSize,
        callDuration,
        callStatus,
        replyTo: formattedReplyTo,
        status: initialStatus,
        timestamp: new Date(),
      };

      const message = await Message.create(messageData);

      const nestedData = {
        ...messageData,
        _id: message._id,
      };

      // Save inside nested Conversation document with 300 cap
      await Conversation.findOneAndUpdate(
        {
          participants: { $all: [senderId, receiverId] },
        },
        {
          $setOnInsert: { participants: [senderId, receiverId] },
          $push: {
            messages: {
              $each: [nestedData],
              $slice: -MAX_SOCKET_MESSAGES,
            },
          },
          $set: { lastMessage: nestedData, updatedAt: new Date() },
        },
        { upsert: true, new: true }
      );

      // Async clean flat 1-to-1 messages beyond 300
      Message.find({
        $or: [
          { senderId, receiverId },
          { senderId: receiverId, receiverId: senderId },
        ],
      })
        .sort({ timestamp: -1 })
        .skip(MAX_SOCKET_MESSAGES)
        .select('_id')
        .then((excess) => {
          if (excess.length > 0) {
            Message.deleteMany({ _id: { $in: excess.map((m) => m._id) } }).catch(() => {});
          }
        })
        .catch(() => {});

      const senderUser = await User.findById(senderId, 'name avatar email');
      const messageJSON = {
        ...message.toJSON(),
        content: decryptServerMessage(message.content),
        sender: senderUser ? senderUser.toJSON() : null,
      };

      // Emit to receiver's personal room
      io.to(`user:${String(receiverId)}`).emit('message:receive', messageJSON);

      // Emit acknowledgment back to sender socket
      if (callback) {
        callback({ success: true, message: messageJSON, tempId });
      }

      // Realtime Sync across sender's other devices/tabs (e.g. mobile <-> desktop)
      socket.to(`user:${String(senderId)}`).emit('message:receive', messageJSON);
      socket.to(`user:${String(senderId)}`).emit('message:sent-sync', messageJSON);
    } catch (err) {
      console.error('[ChatHandler] Error sending message:', err);
      if (callback) callback({ error: 'Failed to send message' });
    }
  });

  // Delete message event
  socket.on('message:delete', async ({ messageId, receiverId, groupId }, callback) => {
    try {
      const currentUserId = socket.userId;
      if (!currentUserId || !messageId) return;

      const mongoose = require('mongoose');
      if (typeof messageId !== 'string' || !mongoose.Types.ObjectId.isValid(messageId)) {
        if (callback) callback({ success: true, messageId });
        return;
      }

      const objectId = new mongoose.Types.ObjectId(messageId);
      const user = await User.findById(currentUserId);
      const isSuperAdmin = isSuperAdminEmail(user?.email) || user?.role === 'admin';

      let msg = await Message.findById(objectId);
      let senderId = msg?.senderId;
      let effectiveReceiverId = msg?.receiverId || receiverId;
      let effectiveGroupId = msg?.groupId || groupId;
      let content = msg?.content;
      let timestamp = msg?.timestamp;

      if (msg) {
        const isSender = String(msg.senderId) === String(currentUserId);
        if (!isSender && !isSuperAdmin) {
          if (callback) callback({ error: 'Unauthorized to delete message' });
          return;
        }
        await Message.findByIdAndDelete(objectId);
      }

      // Check Conversation
      const conv = await Conversation.findOne({ 'messages._id': objectId });
      if (conv) {
        const nestedMsg = conv.messages.id(objectId);
        if (nestedMsg) {
          const isSender = String(nestedMsg.senderId) === String(currentUserId);
          if (!isSender && !isSuperAdmin && !msg) {
            if (callback) callback({ error: 'Unauthorized to delete message' });
            return;
          }
          senderId = senderId || nestedMsg.senderId;
          effectiveReceiverId = effectiveReceiverId || nestedMsg.receiverId;
        }
        conv.messages.pull(objectId);
        conv.lastMessage = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1] : null;
        await conv.save();
      }

      // Check Group
      const grp = await Group.findOne({ 'messages._id': objectId });
      if (grp) {
        const nestedMsg = grp.messages.id(objectId);
        if (nestedMsg) {
          const isSender = String(nestedMsg.senderId) === String(currentUserId);
          if (!isSender && !isSuperAdmin && !msg) {
            if (callback) callback({ error: 'Unauthorized to delete message' });
            return;
          }
          senderId = senderId || nestedMsg.senderId;
          effectiveGroupId = effectiveGroupId || grp._id;
        }
        grp.messages.pull(objectId);
        grp.lastMessage = grp.messages.length > 0 ? grp.messages[grp.messages.length - 1] : null;
        await grp.save();
      }

      // Clean up in Group if effectiveGroupId known
      if (effectiveGroupId) {
        await Group.findByIdAndUpdate(effectiveGroupId, {
          $pull: {
            messages: {
              $or: [
                { _id: objectId },
                ...(content && timestamp ? [{ senderId, content, timestamp }] : [])
              ]
            }
          }
        });
        io.to(`group:${effectiveGroupId}`).emit('message:deleted', {
          messageId: String(objectId),
          groupId: String(effectiveGroupId),
        });
      } else if (effectiveReceiverId) {
        const sid = senderId || currentUserId;
        await Conversation.updateMany(
          { participants: { $all: [sid, effectiveReceiverId] } },
          {
            $pull: {
              messages: {
                $or: [
                  { _id: objectId },
                  ...(content && timestamp ? [{ senderId: sid, content, timestamp }] : [])
                ]
              }
            }
          }
        );
        io.to(`user:${effectiveReceiverId}`).emit('message:deleted', {
          messageId: String(objectId),
          senderId: String(sid),
        });
        io.to(`user:${sid}`).emit('message:deleted', {
          messageId: String(objectId),
          receiverId: String(effectiveReceiverId),
        });
      }

      if (callback) callback({ success: true, messageId: String(objectId) });
    } catch (err) {
      console.error('[ChatHandler] Error deleting message via socket:', err);
      if (callback) callback({ error: 'Failed to delete message' });
    }
  });

  // Read receipts (1-to-1)
  socket.on('message:read', async ({ senderId }) => {
    try {
      const currentUserId = socket.userId;
      if (!currentUserId || !senderId) return;

      const result = await Message.updateMany(
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

      if (result.modifiedCount > 0) {
        io.to(`user:${senderId}`).emit('message:read', {
          readerId: currentUserId,
        });
      }
    } catch (err) {
      console.error('[ChatHandler] Error marking messages read:', err);
    }
  });

  // 1-to-1 typing indicators
  socket.on('typing:start', ({ receiverId }) => {
    if (!socket.userId || !receiverId) return;
    io.to(`user:${receiverId}`).emit('typing:start', {
      senderId: socket.userId,
    });
  });

  socket.on('typing:stop', ({ receiverId }) => {
    if (!socket.userId || !receiverId) return;
    io.to(`user:${receiverId}`).emit('typing:stop', {
      senderId: socket.userId,
    });
  });

  // Group typing indicators
  socket.on('group:typing:start', async ({ groupId }) => {
    if (!socket.userId || !groupId) return;
    const sender = await User.findById(socket.userId, 'name');
    socket.to(`group:${groupId}`).emit('group:typing:start', {
      groupId,
      senderId: socket.userId,
      senderName: sender ? sender.name : 'Someone',
    });
  });

  socket.on('group:typing:stop', ({ groupId }) => {
    if (!socket.userId || !groupId) return;
    socket.to(`group:${groupId}`).emit('group:typing:stop', {
      groupId,
      senderId: socket.userId,
    });
  });

  // ===== MESSAGE REACTION (Emoji Toggle) =====
  socket.on('message:react', async ({ messageId, emoji, receiverId, groupId }, callback) => {
    try {
      const userId = socket.userId;
      if (!userId || !messageId || !emoji) return;

      const user = await User.findById(userId, 'name');
      const reaction = { emoji, userId, userName: user?.name || '' };

      const message = await Message.findById(messageId);
      if (!message) {
        if (callback) callback({ error: 'Message not found' });
        return;
      }

      if (!message.reactions) message.reactions = [];

      // Toggle: if same emoji by same user exists, remove it; otherwise add/replace
      const existingIdx = message.reactions.findIndex(
        (r) => String(r.userId) === String(userId) && r.emoji === emoji
      );

      if (existingIdx >= 0) {
        message.reactions.splice(existingIdx, 1);
      } else {
        // Remove any previous reaction from this user first
        message.reactions = message.reactions.filter(
          (r) => String(r.userId) !== String(userId)
        );
        message.reactions.push(reaction);
      }

      await message.save();

      // Sync nested documents
      const reactionsData = message.reactions.map((r) => ({
        emoji: r.emoji,
        userId: r.userId,
        userName: r.userName,
      }));

      if (message.groupId) {
        await Group.updateOne(
          { 'messages._id': messageId },
          { $set: { 'messages.$.reactions': reactionsData } }
        );
      } else if (message.receiverId) {
        await Conversation.updateOne(
          { 'messages._id': messageId },
          { $set: { 'messages.$.reactions': reactionsData } }
        );
      }

      const emitPayload = {
        messageId: String(messageId),
        reactions: reactionsData,
      };

      // Broadcast to relevant parties
      const effectiveGroupId = groupId || message.groupId;
      if (effectiveGroupId) {
        io.to(`group:${effectiveGroupId}`).emit('message:reaction', emitPayload);
      } else {
        const targetId =
          String(message.receiverId) === String(userId)
            ? String(message.senderId)
            : String(message.receiverId);
        io.to(`user:${targetId}`).emit('message:reaction', emitPayload);
        io.to(`user:${userId}`).emit('message:reaction', emitPayload);
      }

      if (callback) callback({ success: true, reactions: reactionsData });
    } catch (err) {
      console.error('[ChatHandler] Error handling reaction:', err);
      if (callback) callback({ error: 'Failed to add reaction' });
    }
  });
};

module.exports = { registerChatHandlers };
