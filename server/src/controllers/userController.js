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

module.exports = {
  getAllUsers,
  getUserById,
};
