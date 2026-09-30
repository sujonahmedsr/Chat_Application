const User = require('../models/User');
const Message = require('../models/Message');
const { Conversation } = require('../models/Conversation');

const cleanExpiredMessages = async () => {
  try {
    const usersWithRetention = await User.find({
      $or: [
        { 'settings.saveChatHistory': false },
        { 'settings.chatRetentionDays': { $exists: true, $ne: null } },
      ],
    }).select('_id settings');

    for (const u of usersWithRetention) {
      const settings = u.settings || {};
      let retentionDays = settings.chatRetentionDays;
      if (settings.saveChatHistory === false) {
        retentionDays = 1; // 1 day retention if save is turned off
      }

      if (retentionDays && retentionDays > 0) {
        const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

        // Delete flat messages
        await Message.deleteMany({
          $or: [{ senderId: u._id }, { receiverId: u._id }],
          timestamp: { $lt: cutoff },
        });

        // Pull expired messages from nested Conversation arrays
        await Conversation.updateMany(
          { participants: u._id },
          {
            $pull: {
              messages: { timestamp: { $lt: cutoff } },
            },
          }
        );
      }
    }
  } catch (err) {
    console.error('[CleanupJob] Error cleaning expired messages:', err);
  }
};

const startMessageCleanupScheduler = () => {
  // Run on startup after 10s
  setTimeout(cleanExpiredMessages, 10000);
  // Run periodically every 1 hour
  setInterval(cleanExpiredMessages, 60 * 60 * 1000);
};

module.exports = {
  cleanExpiredMessages,
  startMessageCleanupScheduler,
};
