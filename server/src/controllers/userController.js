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
    const Conversation = require('../models/Conversation');

    // Remove user references from other users
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

    // Remove user from groups
    await Group.updateMany(
      { members: userId },
      { $pull: { members: userId, admins: userId } }
    );
    // Remove empty groups
    await Group.deleteMany({ members: { $size: 0 } });

    // Clean up direct messages and conversations
    await Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });
    await Conversation.deleteMany({ participants: userId });

    // Delete user
    await User.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: 'Account and profile deleted successfully',
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

