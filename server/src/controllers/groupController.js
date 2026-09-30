const Group = require('../models/Group');
const Message = require('../models/Message');
const { isSuperAdminEmail } = require('../utils/superAdmin');
const { decryptServerMessage } = require('../utils/encryption');
const { getIO } = require('../sockets/socketManager');

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
      .populate('creator', 'name email avatar')
      .populate('admins', 'name email avatar');

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

    const groupData = populated.toJSON ? populated.toJSON() : populated;
    try {
      const io = getIO();
      members.forEach((mId) => {
        io.to(`user:${mId}`).emit('group:created', { group: groupData });
      });
    } catch (e) {}

    return res.status(201).json({ group: groupData });
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
      .populate('admins', 'name email avatar')
      .sort({ updatedAt: -1 });

    const enrichedGroups = await Promise.all(
      groups.map(async (grp) => {
        const lastMessage = await Message.findOne({ groupId: grp._id })
          .populate('senderId', 'name avatar')
          .sort({ timestamp: -1 });

        const grpJson = grp.toJSON();
        const creatorId = String(grp.creator?._id || grp.creator?.id || grp.creator || '');
        const adminIds = new Set((grpJson.admins || []).map((a) => String(a?._id || a?.id || a)));

        // If creator is not in admins, add them dynamically
        if (creatorId && !adminIds.has(creatorId)) {
          grpJson.admins = [...(grpJson.admins || []), grpJson.creator || creatorId];
        }

        return {
          ...grpJson,
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
            content: decryptServerMessage(json.content),
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
          content: decryptServerMessage(json.content),
          sender: m.senderId,
        };
      }),
    });
  } catch (error) {
    next(error);
  }
};

// Clear all messages in a group (Only Group Creator)
const clearGroupMessages = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isSuperAdmin = isSuperAdminEmail(req.user.email) || req.user.role === 'admin';
    const creatorId = String(group.creator?._id || group.creator?.id || group.creator || '');
    const isGroupCreator = creatorId === String(currentUserId);
    const isGroupAdmin =
      isSuperAdmin ||
      isGroupCreator ||
      (group.admins || []).some((a) => String(a?._id || a?.id || a) === String(currentUserId));

    if (!isGroupAdmin) {
      return res.status(403).json({ message: 'Only group admins can clear group history' });
    }

    await Message.deleteMany({ groupId });
    group.messages = [];
    group.lastMessage = null;
    await group.save();

    try {
      getIO().to(`group:${groupId}`).emit('group:messages:cleared', { groupId: String(groupId) });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: 'Group messages cleared successfully',
      groupId,
    });
  } catch (error) {
    next(error);
  }
};

// Delete entire group (Only Group Admin or Creator)
const deleteGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isSuperAdmin = isSuperAdminEmail(req.user.email) || req.user.role === 'admin';
    const creatorId = String(group.creator?._id || group.creator?.id || group.creator || '');
    const isGroupCreator = creatorId === String(currentUserId);
    const isGroupAdmin =
      isSuperAdmin ||
      isGroupCreator ||
      (group.admins || []).some((a) => String(a?._id || a?.id || a) === String(currentUserId));

    if (!isGroupAdmin) {
      return res.status(403).json({ message: 'Only group admins can delete the group' });
    }

    // Delete all messages associated with this group
    await Message.deleteMany({ groupId });

    // Delete group document
    await Group.findByIdAndDelete(groupId);

    try {
      getIO().to(`group:${groupId}`).emit('group:deleted', { groupId: String(groupId) });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: `Group "${group.name}" deleted successfully`,
      groupId,
    });
  } catch (error) {
    next(error);
  }
};

// Add members to group (Group Admin or Creator only)
const addGroupMembers = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const currentUserId = req.user._id;
    const { memberIds = [] } = req.body;

    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: 'Member IDs are required' });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isSuperAdmin = isSuperAdminEmail(req.user.email) || req.user.role === 'admin';
    const isGroupAdmin =
      isSuperAdmin ||
      (group.admins || []).some((id) => String(id) === String(currentUserId)) ||
      String(group.creator) === String(currentUserId);

    if (!isGroupAdmin) {
      return res.status(403).json({ message: 'Only group admins can add members' });
    }

    // Add unique member IDs
    const currentMemberIds = (group.members || []).map((m) => String(m._id || m));
    memberIds.forEach((id) => {
      const strId = String(id);
      if (!currentMemberIds.includes(strId)) {
        group.members.push(strId);
      }
    });

    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate('members', 'name email avatar isOnline lastSeen')
      .populate('creator', 'name email avatar')
      .populate('admins', 'name email avatar');

    const updatedGroupData = updatedGroup.toJSON ? updatedGroup.toJSON() : updatedGroup;
    try {
      const io = getIO();
      io.to(`group:${groupId}`).emit('group:updated', { group: updatedGroupData });
      memberIds.forEach((mId) => {
        io.to(`user:${mId}`).emit('group:created', { group: updatedGroupData });
      });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: 'Members added successfully',
      group: updatedGroupData,
    });
  } catch (error) {
    next(error);
  }
};

// Remove member from group (Group Admin or Creator only, or self-leaving)
const removeGroupMember = async (req, res, next) => {
  try {
    const { groupId, userId } = req.params;
    const currentUserId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: 'Group not found' });
    }

    const isSuperAdmin = isSuperAdminEmail(req.user.email) || req.user.role === 'admin';
    const creatorId = String(group.creator?._id || group.creator?.id || group.creator || '');
    const isGroupCreator = creatorId === String(currentUserId);
    const isGroupAdmin =
      isSuperAdmin ||
      isGroupCreator ||
      (group.admins || []).some((id) => String(id?._id || id?.id || id) === String(currentUserId));

    const isSelfLeaving = String(currentUserId) === String(userId);

    if (!isGroupAdmin && !isSelfLeaving) {
      return res.status(403).json({ message: 'Only group admins can remove members' });
    }

    if (String(creatorId) === String(userId) && !isSelfLeaving) {
      return res.status(400).json({ message: 'Cannot remove the group creator' });
    }

    group.members = (group.members || []).filter((m) => String(m._id || m) !== String(userId));
    group.admins = (group.admins || []).filter((a) => String(a._id || a) !== String(userId));

    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate('members', 'name email avatar isOnline lastSeen')
      .populate('creator', 'name email avatar')
      .populate('admins', 'name email avatar');

    const updatedGroupData = updatedGroup.toJSON ? updatedGroup.toJSON() : updatedGroup;
    try {
      const io = getIO();
      io.to(`group:${groupId}`).emit('group:updated', { group: updatedGroupData });
      io.to(`user:${userId}`).emit('group:removed', { groupId: String(groupId) });
    } catch (e) {}

    return res.status(200).json({
      success: true,
      message: isSelfLeaving ? 'You left the group' : 'Member removed successfully',
      group: updatedGroupData,
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
  addGroupMembers,
  removeGroupMember,
};
