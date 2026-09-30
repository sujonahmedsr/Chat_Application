const User = require('../models/User');
const { Conversation } = require('../models/Conversation');
const Message = require('../models/Message');
const { isUserOnline } = require('../sockets/presenceHandler');

const { isSuperAdminEmail } = require('../utils/superAdmin');

// Get all confirmed friends for current user (Super Admin gets all users directly)
const getFriends = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const isSuperAdmin = isSuperAdminEmail(req.user.email) || req.user.role === 'admin';

    let friends;
    if (isSuperAdmin) {
      // Super Admin can directly chat with any registered user
      friends = await User.find({ _id: { $ne: currentUserId } }, 'name email avatar isOnline lastSeen');
    } else {
      const currentUser = await User.findById(currentUserId).populate(
        'friends',
        'name email avatar isOnline lastSeen blockedUsers'
      );

      if (!currentUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      const myBlockedIds = (currentUser.blockedUsers || []).map(String);
      const rawFriends = currentUser.friends || [];
      // Completely hide if user is blocked by me OR if that user has blocked me
      friends = rawFriends.filter((f) => {
        const fId = String(f._id);
        const hasBlockedMe = (f.blockedUsers || []).map(String).includes(String(currentUserId));
        const isBlockedByMe = myBlockedIds.includes(fId);
        return !isBlockedByMe && !hasBlockedMe;
      });
    }

    // Enrich with live presence and conversation preview
    const enrichedFriends = await Promise.all(
      friends.map(async (f) => {
        const conversation = await Conversation.findOne({
          participants: { $all: [currentUserId, f._id] },
        });

        // Compute unread count from nested messages
        let unreadCount = 0;
        let lastMessage = null;

        if (conversation && conversation.messages?.length > 0) {
          const msgs = conversation.messages;
          lastMessage = msgs[msgs.length - 1];

          unreadCount = msgs.filter(
            (m) => String(m.senderId) === String(f._id) && m.status !== 'read'
          ).length;
        }

        const online = isUserOnline(f._id);

        return {
          ...f.toJSON(),
          isOnline: online,
          lastSeen: online ? new Date() : f.lastSeen,
          unreadCount,
          lastMessage: lastMessage ? lastMessage.toJSON() : null,
        };
      })
    );

    return res.status(200).json({ friends: enrichedFriends });
  } catch (error) {
    next(error);
  }
};

// Get pending incoming friend requests
const getPendingRequests = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'friendRequests.from',
      'name email avatar isOnline'
    );

    return res.status(200).json({
      requests: user.friendRequests || [],
    });
  } catch (error) {
    next(error);
  }
};

// Search users to add as friends (if query is empty, return all users for discovery)
const searchUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const search = req.query.q ? req.query.q.trim() : '';

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const friendIds = (currentUser.friends || []).map(String);
    const sentIds = (currentUser.sentRequests || []).map((r) => String(r.to));
    const receivedIds = (currentUser.friendRequests || []).map((r) => String(r.from));
    const myBlockedIds = (currentUser.blockedUsers || []).map(String);

    let query = { _id: { $ne: currentUserId } };
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('name email username avatar isOnline lastSeen blockedUsers')
      .limit(60);

    const results = users.map((u) => {
      const uId = String(u._id);
      const isBlockedByMe = myBlockedIds.includes(uId);
      const userBlockedList = (u.blockedUsers || []).map(String);
      const hasBlockedMe = userBlockedList.includes(String(currentUserId));

      return {
        id: u._id,
        _id: u._id,
        name: u.name,
        email: u.email,
        username: u.username,
        avatar: u.avatar,
        isOnline: isUserOnline(u._id),
        lastSeen: u.lastSeen,
        isFriend: friendIds.includes(uId),
        hasSentRequest: sentIds.includes(uId),
        hasReceivedRequest: receivedIds.includes(uId),
        isBlockedByMe,
        hasBlockedMe,
        isBlocked: isBlockedByMe || hasBlockedMe,
      };
    });

    return res.status(200).json({ users: results });
  } catch (error) {
    next(error);
  }
};

// Send a friend request
const sendFriendRequest = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;

    if (String(currentUserId) === String(targetUserId)) {
      return res.status(400).json({ message: 'Cannot add yourself as a friend' });
    }

    const targetUser = await User.findById(targetUserId);
    const currentUser = await User.findById(currentUserId);

    if (!targetUser || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if either user is blocked
    const myBlockedIds = (currentUser.blockedUsers || []).map(String);
    const targetBlockedIds = (targetUser.blockedUsers || []).map(String);
    if (myBlockedIds.includes(String(targetUserId)) || targetBlockedIds.includes(String(currentUserId))) {
      return res.status(403).json({ message: 'Cannot send friend request to this user' });
    }

    // Check if already friends
    if (currentUser.friends?.includes(targetUserId)) {
      return res.status(400).json({ message: 'Already friends' });
    }

    // Check if request already sent
    const alreadySent = currentUser.sentRequests?.some(
      (r) => String(r.to) === String(targetUserId)
    );
    if (alreadySent) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    // Check if other user already sent a request to us - if so, auto accept!
    const alreadyReceived = currentUser.friendRequests?.some(
      (r) => String(r.from) === String(targetUserId)
    );
    if (alreadyReceived) {
      // Auto accept mutual request
      return acceptFriendRequest(req, res, next);
    }

    // Push request
    await User.findByIdAndUpdate(targetUserId, {
      $push: { friendRequests: { from: currentUserId } },
    });

    await User.findByIdAndUpdate(currentUserId, {
      $push: { sentRequests: { to: targetUserId } },
    });

    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().to(`user:${targetUserId}`).emit('friend:request:received', {
        from: currentUser.toJSON(),
      });
    } catch (e) {
      // socket might be offline or testing
    }

    return res.status(200).json({ success: true, message: 'Friend request sent!' });
  } catch (error) {
    next(error);
  }
};

// Accept a friend request
const acceptFriendRequest = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const fromUserId = req.params.userId;

    const fromUser = await User.findById(fromUserId);
    const currentUser = await User.findById(currentUserId);

    if (!fromUser || !currentUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Add each other to friends array and remove pending request records
    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { friends: fromUserId },
      $pull: { friendRequests: { from: fromUserId } },
    });

    await User.findByIdAndUpdate(fromUserId, {
      $addToSet: { friends: currentUserId },
      $pull: { sentRequests: { to: currentUserId } },
    });

    // Ensure conversation document exists between newly formed friends
    let conversation = await Conversation.findOne({
      participants: { $all: [currentUserId, fromUserId] },
    });

    if (!conversation) {
      await Conversation.create({
        participants: [currentUserId, fromUserId],
        messages: [],
      });
    }

    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().to(`user:${fromUserId}`).emit('friend:request:accepted', {
        friend: currentUser.toJSON(),
      });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: `You and ${fromUser.name} are now friends!`,
      friend: fromUser.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// Reject / cancel friend request
const rejectFriendRequest = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const fromUserId = req.params.userId;

    await User.findByIdAndUpdate(currentUserId, {
      $pull: { friendRequests: { from: fromUserId } },
    });

    await User.findByIdAndUpdate(fromUserId, {
      $pull: { sentRequests: { to: currentUserId } },
    });

    return res.status(200).json({ success: true, message: 'Friend request declined' });
  } catch (error) {
    next(error);
  }
};

// Unfriend a user
const unfriendUser = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;

    await User.findByIdAndUpdate(currentUserId, {
      $pull: { friends: targetUserId },
    });

    await User.findByIdAndUpdate(targetUserId, {
      $pull: { friends: currentUserId },
    });

    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().to(`user:${targetUserId}`).emit('friend:unfriended', {
        userId: String(currentUserId),
      });
    } catch (e) {}

    return res.status(200).json({ success: true, message: 'Friend removed successfully' });
  } catch (error) {
    next(error);
  }
};

// Block a user
const blockUser = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;

    if (String(currentUserId) === String(targetUserId)) {
      return res.status(400).json({ message: 'Cannot block yourself' });
    }

    // Add to blockedUsers, remove from friends, and clear friend requests in both directions
    await User.findByIdAndUpdate(currentUserId, {
      $addToSet: { blockedUsers: targetUserId },
      $pull: {
        friends: targetUserId,
        friendRequests: { from: targetUserId },
        sentRequests: { to: targetUserId },
      },
    });

    await User.findByIdAndUpdate(targetUserId, {
      $pull: {
        friends: currentUserId,
        friendRequests: { from: currentUserId },
        sentRequests: { to: currentUserId },
      },
    });

    // Wipe conversation and messages between them ("block kora hole sob conversation gayeb hoye jabe")
    await Conversation.findOneAndDelete({
      participants: { $all: [currentUserId, targetUserId] },
    });
    await Message.deleteMany({
      $or: [
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId },
      ],
    });

    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().to(`user:${targetUserId}`).emit('friend:blocked', {
        userId: String(currentUserId),
      });
      getIO().to(`user:${currentUserId}`).emit('friend:blocked', {
        userId: String(targetUserId),
      });
    } catch (e) {}

    return res.status(200).json({ success: true, message: 'User blocked' });
  } catch (error) {
    next(error);
  }
};

// Unblock a user
const unblockUser = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;

    await User.findByIdAndUpdate(currentUserId, {
      $pull: { blockedUsers: targetUserId },
    });

    try {
      const { getIO } = require('../sockets/socketManager');
      getIO().to(`user:${targetUserId}`).emit('friend:unblocked', {
        userId: String(currentUserId),
      });
      getIO().to(`user:${currentUserId}`).emit('friend:unblocked', {
        userId: String(targetUserId),
      });
    } catch (e) {}

    return res.status(200).json({ success: true, message: 'User unblocked' });
  } catch (error) {
    next(error);
  }
};

// Get list of blocked users
const getBlockedUsers = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate(
      'blockedUsers',
      'name email avatar isOnline lastSeen'
    );

    return res.status(200).json({ blockedUsers: user.blockedUsers || [] });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getFriends,
  getPendingRequests,
  searchUsers,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  unfriendUser,
  blockUser,
  unblockUser,
  getBlockedUsers,
};
