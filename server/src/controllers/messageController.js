const Message = require('../models/Message');
const { Conversation } = require('../models/Conversation');

const getChatHistory = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;

    // Check nested Conversation document first
    const conv = await Conversation.findOne({
      participants: { $all: [currentUserId, targetUserId] },
    });

    if (conv && conv.messages && conv.messages.length > 0) {
      return res.status(200).json({
        messages: conv.messages.map((m) => m.toJSON()),
      });
    }

    // Fallback to flat messages collection for backward compatibility
    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: targetUserId },
        { senderId: targetUserId, receiverId: currentUserId },
      ],
    }).sort({ timestamp: 1 });

    return res.status(200).json({
      messages: messages.map((m) => m.toJSON()),
    });
  } catch (error) {
    next(error);
  }
};

const markMessagesAsRead = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const senderId = req.params.userId;

    const updateResult = await Message.updateMany(
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

    return res.status(200).json({
      success: true,
      modifiedCount: updateResult.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

const sendMessage = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { receiverId, content, messageType = 'text', fileUrl = '', fileName = '', fileSize = 0 } = req.body;

    if (!receiverId || (!content?.trim() && !fileUrl)) {
      return res.status(400).json({ message: 'receiverId and content/attachment are required' });
    }

    const messageData = {
      senderId: currentUserId,
      receiverId,
      content: (content || '').trim(),
      messageType,
      fileUrl,
      fileName,
      fileSize,
      status: 'sent',
      timestamp: new Date(),
    };

    const message = await Message.create(messageData);

    // Save inside nested Conversation document
    await Conversation.findOneAndUpdate(
      {
        participants: { $all: [currentUserId, receiverId] },
      },
      {
        $setOnInsert: { participants: [currentUserId, receiverId] },
        $push: { messages: messageData },
        $set: { lastMessage: messageData, updatedAt: new Date() },
      },
      { upsert: true, new: true }
    );

    return res.status(201).json({ message: message.toJSON() });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChatHistory,
  markMessagesAsRead,
  sendMessage,
};
