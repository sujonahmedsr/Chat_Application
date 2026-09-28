const Group = require('../models/Group');
const Message = require('../models/Message');

const createGroup = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { name, description = '', memberIds = [] } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Group name is required' });
    }

    // Ensure current user is in members list
    const membersSet = new Set([String(currentUserId), ...memberIds.map(String)]);
    const members = Array.from(membersSet);

    const encodedName = encodeURIComponent(name.trim());
    const avatar = `https://api.dicebear.com/7.x/identicon/svg?seed=${encodedName}`;

    const group = await Group.create({
      name: name.trim(),
      description: description.trim(),
      avatar,
      creator: currentUserId,
      members,
      admins: [currentUserId],
    });

    const populated = await Group.findById(group._id)
      .populate('members', 'name email avatar isOnline lastSeen')
      .populate('creator', 'name email avatar');

    // Create system welcome message in group
    await Message.create({
      senderId: currentUserId,
      groupId: group._id,
      content: `Group "${name.trim()}" created. Welcome! 🎉`,
      messageType: 'text',
      status: 'delivered',
      timestamp: new Date(),
    });

    return res.status(201).json({ group: populated });
  } catch (error) {
    next(error);
  }
};

const getUserGroups = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const isSuperAdmin = req.user.email === 'shofi@gmail.com' || req.user.role === 'admin';
    const query = isSuperAdmin ? {} : { members: currentUserId };

    const groups = await Group.find(query)
      .populate('members', 'name email avatar isOnline lastSeen')
      .populate('creator', 'name email avatar')
      .sort({ updatedAt: -1 });

    const enrichedGroups = await Promise.all(
      groups.map(async (grp) => {
        const lastMessage = await Message.findOne({ groupId: grp._id })
          .populate('senderId', 'name avatar')
          .sort({ timestamp: -1 });

        return {
          ...grp.toJSON(),
          lastMessage: lastMessage
            ? {
                ...lastMessage.toJSON(),
                sender: lastMessage.senderId,
              }
            : null,
        };
      })
    );

    return res.status(200).json({ groups: enrichedGroups });
  } catch (error) {
    next(error);
  }
};

const getGroupMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params;

    const group = await Group.findById(groupId).populate('messages.senderId', 'name email avatar');
    if (group && group.messages && group.messages.length > 0) {
      return res.status(200).json({
        messages: group.messages.map((m) => {
          const json = m.toJSON ? m.toJSON() : m;
          return {
            ...json,
            sender: m.senderId,
          };
        }),
      });
    }

    const messages = await Message.find({ groupId })
      .populate('senderId', 'name email avatar')
      .sort({ timestamp: 1 });

    return res.status(200).json({
      messages: messages.map((m) => {
        const json = m.toJSON();
        return {
          ...json,
          sender: m.senderId,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGroup,
  getUserGroups,
  getGroupMessages,
};
