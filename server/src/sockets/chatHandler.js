const Message = require('../models/Message');
const User = require('../models/User');
const Group = require('../models/Group');
const { Conversation } = require('../models/Conversation');
const { isUserOnline } = require('./presenceHandler');

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
        tempId,
      } = data;

      if (!receiverId && !groupId) {
        if (callback) callback({ error: 'receiverId or groupId is required' });
        return;
      }

      if (!content.trim() && !fileUrl) {
        if (callback) callback({ error: 'Message content or attachment is required' });
        return;
      }

      // Group message flow - nested inside Group document
      if (groupId) {
        const messageData = {
          senderId,
          content: content.trim(),
          messageType,
          fileUrl,
          fileName,
          fileSize,
          status: 'delivered',
          timestamp: new Date(),
        };

        // Also create flat Message document for query flexibility
        const message = await Message.create({
          ...messageData,
          groupId,
        });

        // Store nested inside Group document
        await Group.findByIdAndUpdate(groupId, {
          $push: { messages: messageData },
          $set: { lastMessage: messageData, updatedAt: new Date() },
        });

        const sender = await User.findById(senderId, 'name avatar email');
        const messageJSON = {
          ...message.toJSON(),
          sender: sender ? sender.toJSON() : null,
        };

        // Broadcast to all sockets in the group room
        io.to(`group:${groupId}`).emit('group:message:receive', messageJSON);

        if (callback) {
          callback({ success: true, message: messageJSON, tempId });
        }
        return;
      }

      // 1-to-1 direct message flow - nested inside Conversation document
      const receiverOnline = isUserOnline(receiverId);
      const initialStatus = receiverOnline ? 'delivered' : 'sent';

      const messageData = {
        senderId,
        receiverId,
        content: content.trim(),
        messageType,
        fileUrl,
        fileName,
        fileSize,
        status: initialStatus,
        timestamp: new Date(),
      };

      const message = await Message.create(messageData);

      // Save inside nested Conversation document
      await Conversation.findOneAndUpdate(
        {
          participants: { $all: [senderId, receiverId] },
        },
        {
          $setOnInsert: { participants: [senderId, receiverId] },
          $push: { messages: messageData },
          $set: { lastMessage: messageData, updatedAt: new Date() },
        },
        { upsert: true, new: true }
      );

      const messageJSON = message.toJSON();

      // Emit to receiver's room
      io.to(`user:${receiverId}`).emit('message:receive', messageJSON);

      // Emit acknowledgment back to sender
      if (callback) {
        callback({ success: true, message: messageJSON, tempId });
      }

      // Also broadcast to other tabs of the sender
      socket.to(`user:${senderId}`).emit('message:sent-sync', messageJSON);
    } catch (err) {
      console.error('[ChatHandler] Error sending message:', err);
      if (callback) callback({ error: 'Failed to send message' });
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
};

module.exports = { registerChatHandlers };
