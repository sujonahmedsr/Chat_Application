const User = require('../models/User');
const Message = require('../models/Message');

const getAllUsers = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const search = req.query.search ? req.query.search.trim() : '';

    const query = {
      _id: { $ne: currentUserId },
    };

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query).sort({ isOnline: -1, name: 1 });

    // Enrich users with unread message count and last message preview
    const enrichedUsers = await Promise.all(
      users.map(async (u) => {
        const unreadCount = await Message.countDocuments({
          senderId: u._id,
          receiverId: currentUserId,
          status: { $in: ['sent', 'delivered'] },
        });

        const lastMessage = await Message.findOne({
          $or: [
            { senderId: currentUserId, receiverId: u._id },
            { senderId: u._id, receiverId: currentUserId },
          ],
        }).sort({ timestamp: -1 });

        return {
          ...u.toJSON(),
          unreadCount,
          lastMessage: lastMessage ? lastMessage.toJSON() : null,
        };
      })
    );

    return res.status(200).json({ users: enrichedUsers });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    return res.status(200).json({ user: user.toJSON() });
  } catch (error) {
    next(error);
  }
};

const { uploadImage } = require('../utils/imageUpload');

const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { name, username, avatar, bio, settings } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (name && name.trim()) {
      user.name = name.trim();
    }

    // Username is permanently locked to email handle; cannot be modified by user
    if (user.email) {
      user.username = user.email.split('@')[0];
    }

    if (bio !== undefined) {
      user.bio = (bio || '').trim();
    }

    if (avatar !== undefined && avatar.trim()) {
      // Process upload to Cloudinary (or base64 fallback)
      const uploadedAvatarUrl = await uploadImage(avatar.trim(), 'avatars');
      user.avatar = uploadedAvatarUrl;
    }

    if (settings && typeof settings === 'object') {
      user.settings = {
        saveChatHistory: settings.saveChatHistory !== undefined ? !!settings.saveChatHistory : user.settings?.saveChatHistory ?? true,
        chatRetentionDays: typeof settings.chatRetentionDays === 'number' ? settings.chatRetentionDays : (user.settings?.chatRetentionDays || 15),
        hasCompletedSetup: settings.hasCompletedSetup !== undefined ? !!settings.hasCompletedSetup : true,
      };
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile and preferences updated successfully',
      user: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

const uploadAvatarOnly = async (req, res, next) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ message: 'No image provided' });
    }

    const uploadedUrl = await uploadImage(image, 'avatars');
    return res.status(200).json({
      success: true,
      url: uploadedUrl,
    });
  } catch (error) {
    next(error);
  }
};

const deleteProfile = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Protect Super Admin from deletion
    const { SUPER_ADMIN_EMAILS } = require('../utils/superAdmin');
    if (SUPER_ADMIN_EMAILS.includes((user.email || '').toLowerCase())) {
      return res.status(403).json({ message: 'Super Admin account cannot be deleted.' });
    }

    const Group = require('../models/Group');
    const { Conversation } = require('../models/Conversation');
    const Message = require('../models/Message');
    const CallLog = require('../models/CallLog');

    // 1. Remove user references from other users (friends, requests, blocked)
    await User.updateMany(
      {},
      {
        $pull: {
          friends: userId,
          friendRequests: { from: userId },
          sentRequests: { to: userId },
          blockedUsers: userId,
        },
      }
    );

    // 2. Clean up groups created by this user
    const createdGroups = await Group.find({ creator: userId });
    const createdGroupIds = createdGroups.map((g) => g._id);
    if (createdGroupIds.length > 0) {
      await Message.deleteMany({ groupId: { $in: createdGroupIds } });
      await Group.deleteMany({ _id: { $in: createdGroupIds } });
    }

    // 3. Remove user from all other groups and scrub their nested messages
    await Group.updateMany(
      { members: userId },
      {
        $pull: {
          members: userId,
          admins: userId,
          messages: { senderId: userId },
        },
      }
    );
    // Remove empty groups
    await Group.deleteMany({ members: { $size: 0 } });

    // 4. Wipe all direct messages and nested conversations
    await Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });
    if (Conversation) {
      await Conversation.deleteMany({ participants: userId });
    }

    // 5. Clean up all call logs involving this user
    await CallLog.deleteMany({
      $or: [{ callerId: userId }, { receiverId: userId }],
    });

    // 6. Delete user account document
    await User.findByIdAndDelete(userId);

    // 7. Realtime Socket notification across all devices
    try {
      const { getIO } = require('../sockets/socketManager');
      const io = getIO();
      io.to(`user:${userId}`).emit('user:admin:deleted', {
        message: 'Your account and all communication data have been completely deleted.',
      });
      io.emit('user:offline', { userId: String(userId) });
      io.emit('friend:unfriended', { userId: String(userId) });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: 'Your account and all communication data have been deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateProfile,
  uploadAvatarOnly,
  deleteProfile,
};

