const User = require('../models/User');
const Group = require('../models/Group');
const Message = require('../models/Message');
const { Conversation } = require('../models/Conversation');
const { isUserOnline, onlineUsers } = require('../sockets/presenceHandler');

// Get all users with administrative stats
const getAllUsers = async (req, res, next) => {
  try {
    const search = req.query.search ? req.query.search.trim() : '';

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query).sort({ createdAt: -1 });

    const enrichedUsers = users.map((u) => {
      const uId = String(u._id);
      return {
        id: uId,
        _id: uId,
        name: u.name,
        email: u.email,
        avatar: u.avatar,
        role: u.email === 'shofi@gmail.com' ? 'admin' : (u.role || 'user'),
        isBlockedByAdmin: !!u.isBlockedByAdmin,
        isOnline: isUserOnline(uId),
        lastSeen: u.lastSeen,
        createdAt: u.createdAt,
        friendsCount: u.friends ? u.friends.length : 0,
      };
    });

    const totalUsers = enrichedUsers.length;
    const onlineCount = enrichedUsers.filter((u) => u.isOnline).length;
    const blockedCount = enrichedUsers.filter((u) => u.isBlockedByAdmin).length;

    return res.status(200).json({
      users: enrichedUsers,
      stats: {
        totalUsers,
        onlineCount,
        blockedCount,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Toggle block / unblock user by Super Admin
const toggleBlockUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.email === 'shofi@gmail.com') {
      return res.status(400).json({ message: 'Cannot block the Super Admin account' });
    }

    const newBlockedState = !targetUser.isBlockedByAdmin;
    targetUser.isBlockedByAdmin = newBlockedState;
    await targetUser.save();

    // If blocked, disconnect their active sockets & alert them
    if (newBlockedState) {
      try {
        const { getIO } = require('../sockets/socketManager');
        const io = getIO();
        io.to(`user:${userId}`).emit('user:admin:blocked', {
          message: 'Your account has been suspended by an administrator.',
        });

        // Disconnect sockets
        const sockets = onlineUsers.get(String(userId));
        if (sockets) {
          sockets.forEach((socketId) => {
            const s = io.sockets.sockets.get(socketId);
            if (s) s.disconnect(true);
          });
        }
      } catch (e) {}
    }

    return res.status(200).json({
      success: true,
      message: newBlockedState
        ? `User ${targetUser.name} has been blocked.`
        : `User ${targetUser.name} has been unblocked.`,
      user: {
        id: String(targetUser._id),
        isBlockedByAdmin: newBlockedState,
      },
    });
  } catch (err) {
    next(err);
  }
};

// Permanently delete user and clean up relationships
const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser.email === 'shofi@gmail.com') {
      return res.status(400).json({ message: 'Cannot delete the Super Admin account' });
    }

    // Disconnect active sockets
    try {
      const { getIO } = require('../sockets/socketManager');
      const io = getIO();
      io.to(`user:${userId}`).emit('user:admin:deleted', {
        message: 'Your account has been deleted by an administrator.',
      });

      const sockets = onlineUsers.get(String(userId));
      if (sockets) {
        sockets.forEach((socketId) => {
          const s = io.sockets.sockets.get(socketId);
          if (s) s.disconnect(true);
        });
      }
    } catch (e) {}

    // 1. Remove from all other users' friends, friendRequests, sentRequests, blockedUsers
    await User.updateMany(
      {},
      {
        $pull: {
          friends: targetUser._id,
          friendRequests: { from: targetUser._id },
          sentRequests: { to: targetUser._id },
          blockedUsers: targetUser._id,
        },
      }
    );

    // 2. Remove user from all groups
    await Group.updateMany(
      { members: targetUser._id },
      {
        $pull: {
          members: targetUser._id,
          admins: targetUser._id,
        },
      }
    );

    // 3. Delete 1-on-1 conversations involving this user
    await Conversation.deleteMany({
      participants: targetUser._id,
    });

    // 4. Delete user document
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: `User ${targetUser.name} has been permanently deleted.`,
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllUsers,
  toggleBlockUser,
  deleteUser,
};
