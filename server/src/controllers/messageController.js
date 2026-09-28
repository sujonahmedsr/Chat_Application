const Message = require('../models/Message');

const getChatHistory = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;

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
    const { receiverId, content } = req.body;

    if (!receiverId || !content || !content.trim()) {
      return res.status(400).json({ message: 'receiverId and content are required' });
    }

    const message = await Message.create({
      senderId: currentUserId,
      receiverId,
      content: content.trim(),
      status: 'sent',
      timestamp: new Date(),
    });

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
