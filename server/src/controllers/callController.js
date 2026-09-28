const CallLog = require('../models/CallLog');

const getCallLogs = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;

    const callLogs = await CallLog.find({
      $or: [{ callerId: currentUserId }, { receiverId: currentUserId }],
    })
      .populate('callerId', 'name email avatar')
      .populate('receiverId', 'name email avatar')
      .sort({ timestamp: -1 })
      .limit(50);

    return res.status(200).json({ callLogs });
  } catch (error) {
    next(error);
  }
};

const createCallLog = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    const { receiverId, callType = 'audio', status, duration = 0 } = req.body;

    if (!receiverId || !status) {
      return res.status(400).json({ message: 'receiverId and status are required' });
    }

    const log = await CallLog.create({
      callerId: currentUserId,
      receiverId,
      callType,
      status,
      duration: Math.round(duration),
      timestamp: new Date(),
    });

    const populated = await CallLog.findById(log._id)
      .populate('callerId', 'name email avatar')
      .populate('receiverId', 'name email avatar');

    return res.status(201).json({ callLog: populated });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getCallLogs,
  createCallLog,
};
