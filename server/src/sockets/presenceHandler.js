const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');

// In-memory mapping: userId -> Set of socket IDs
const onlineUsers = new Map();

const getOnlineUserSockets = (userId) => {
  return onlineUsers.get(String(userId)) || new Set();
};

const isUserOnline = (userId) => {
  const sockets = onlineUsers.get(String(userId));
  return sockets ? sockets.size > 0 : false;
};

const handleUserConnected = async (io, socket, userId) => {
  const strUserId = String(userId);
  if (!onlineUsers.has(strUserId)) {
    onlineUsers.set(strUserId, new Set());
  }
  onlineUsers.get(strUserId).add(socket.id);
  socket.userId = strUserId;

  // Join personal room for convenient targeted emits
  socket.join(`user:${strUserId}`);

  // Auto-join all group rooms this user belongs to
  try {
    const userGroups = await Group.find({ members: strUserId }, '_id');
    userGroups.forEach((g) => {
      socket.join(`group:${g._id}`);
    });
  } catch (err) {
    console.error('[Presence] Error auto-joining group rooms:', err);
  }

  console.log(`[Presence] User ${strUserId} connected (socket: ${socket.id}). Online count: ${onlineUsers.size}`);

  try {
    const user = await User.findByIdAndUpdate(
      strUserId,
      { isOnline: true, lastSeen: new Date() },
      { new: true }
    );

    // Emit full list of currently online user IDs immediately to the newly connected socket
    socket.emit('presence:sync', {
      onlineUserIds: Array.from(onlineUsers.keys()),
    });

    // Broadcast user:online to everyone
    io.emit('user:online', {
      userId: strUserId,
      lastSeen: user ? user.lastSeen : new Date(),
    });

    // Mark undelivered flat messages to this user as 'delivered'
    const undeliveredMessages = await Message.find({
      receiverId: strUserId,
      status: 'sent',
    });

    if (undeliveredMessages.length > 0) {
      await Message.updateMany(
        { receiverId: strUserId, status: 'sent' },
        { $set: { status: 'delivered' } }
      );

      // Notify the senders that their messages are delivered
      undeliveredMessages.forEach((msg) => {
        io.to(`user:${msg.senderId}`).emit('message:delivered', {
          messageId: msg._id,
          receiverId: strUserId,
        });
      });
    }
  } catch (err) {
    console.error(`[Presence] Error updating user online status:`, err);
  }
};

const handleUserDisconnected = async (io, socket) => {
  const userId = socket.userId;
  if (!userId) return;

  const sockets = onlineUsers.get(userId);
  if (sockets) {
    sockets.delete(socket.id);
    if (sockets.size === 0) {
      onlineUsers.delete(userId);

      try {
        const lastSeen = new Date();
        await User.findByIdAndUpdate(userId, {
          isOnline: false,
          lastSeen,
        });

        // Broadcast user:offline to all clients
        io.emit('user:offline', {
          userId,
          lastSeen,
        });
        console.log(`[Presence] User ${userId} went offline. Online count: ${onlineUsers.size}`);
      } catch (err) {
        console.error(`[Presence] Error updating user offline status:`, err);
      }
    }
  }
};

module.exports = {
  onlineUsers,
  getOnlineUserSockets,
  isUserOnline,
  handleUserConnected,
  handleUserDisconnected,
};
