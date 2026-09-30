const Group = require('../models/Group');
const Message = require('../models/Message');
const { isSuperAdminEmail } = require('../utils/superAdmin');

const MAX_GROUP_MESSAGES = 300;

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
    const welcomeMsg = {
      senderId: currentUserId,
      groupId: group._id,
      content: `Group "${name.trim()}" created. Welcome! 🎉`,
      messageType: 'text',
      status: 'delivered',
      timestamp: new Date(),
    };
    await Message.create(welcomeMsg);
    await Group.findByIdAndUpdate(group._id, {
      $push: { messages: welcomeMsg },
      $set: { lastMessage: welcomeMsg },
    });

    return res.status(201).json({ group: populated });
  } catch (error) {
    next(error);
  }
};

const getUserGroups = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const isSuperAdmin = isSuperAdminEmail(req.user.email) || req.user.role === 'admin';
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
      let msgs = group.messages;
      if (msgs.length > MAX_GROUP_MESSAGES) {
        msgs = msgs.slice(-MAX_GROUP_MESSAGES);
      }
      return res.status(200).json({
        messages: msgs.map((m) => {
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
      .sort({ timestamp: 1 })
      .limit(MAX_GROUP_MESSAGES);

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

// Clear all messages in a group (Group Admin or Super Admin)
const clearGroupMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;
    const isSuperAdmin = isSuperAdminEmail(req.user.email) || req.user.role === 'admin';

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isGroupAdmin =
      group.admins.some((id) => String(id) === String(currentUserId)) ||
      String(group.creator) === String(currentUserId) ||
      isSuperAdmin;

    if (!isGroupAdmin) {
      return res.status(403).json({ message: 'Only group admins can clear group messages' });
    }

    await Message.deleteMany({ groupId });
    group.messages = [];
    group.lastMessage = null;
    await group.save();

    return res.status(200).json({
      success: true,
      message: 'Group messages cleared successfully',
      groupId,
    });
  } catch (error) {
    next(error);
  }
};

// Delete entire group (Group Admin or Super Admin)
const deleteGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;
    const isSuperAdmin = isSuperAdminEmail(req.user.email) || req.user.role === 'admin';

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isGroupAdmin =
      group.admins.some((id) => String(id) === String(currentUserId)) ||
      String(group.creator) === String(currentUserId) ||
      isSuperAdmin;

    if (!isGroupAdmin) {
      return res.status(403).json({ message: 'Only group admins can delete the group' });
    }

    // Delete all messages associated with this group
    await Message.deleteMany({ groupId });

    // Delete group document
    await Group.findByIdAndDelete(groupId);

    return res.status(200).json({
      success: true,
      message: `Group "${group.name}" deleted successfully`,
      groupId,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createGroup,
  getUserGroups,
  getGroupMessages,
  clearGroupMessages,
  deleteGroup,
};
