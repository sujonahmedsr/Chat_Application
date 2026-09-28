const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');

const seedInitialData = async () => {
  try {
    const userCount = await User.countDocuments();
    if (userCount > 0) {
      return;
    }

    console.log('[Seed] Seeding sample users, groups, and messages...');
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const alice = await User.create({
      name: 'Alice Johnson',
      email: 'alice@example.com',
      passwordHash,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Alice%20Johnson',
      isOnline: false,
      lastSeen: new Date(Date.now() - 1000 * 60 * 15),
    });

    const bob = await User.create({
      name: 'Bob Smith',
      email: 'bob@example.com',
      passwordHash,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Bob%20Smith',
      isOnline: false,
      lastSeen: new Date(Date.now() - 1000 * 60 * 5),
    });

    const charlie = await User.create({
      name: 'Charlie Davis',
      email: 'charlie@example.com',
      passwordHash,
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Charlie%20Davis',
      isOnline: false,
      lastSeen: new Date(Date.now() - 1000 * 60 * 60),
    });

    // Set mutual friends
    alice.friends = [bob._id, charlie._id];
    await alice.save();
    bob.friends = [alice._id, charlie._id];
    await bob.save();
    charlie.friends = [alice._id, bob._id];
    await charlie.save();

    const { Conversation } = require('../models/Conversation');

    const sample1on1Msg = {
      senderId: bob._id,
      receiverId: alice._id,
      content: 'Hey Alice! Welcome to Shofi Chat. Try calling me or sending an audio voice note or photo! 📞🎙️',
      messageType: 'text',
      status: 'delivered',
      timestamp: new Date(Date.now() - 1000 * 60 * 2),
    };

    // 1-to-1 Sample greeting message
    await Message.create(sample1on1Msg);

    // Seed into nested Conversation
    await Conversation.create({
      participants: [bob._id, alice._id],
      messages: [sample1on1Msg],
      lastMessage: sample1on1Msg,
    });

    // Sample Group
    const teamGroup = await Group.create({
      name: '🚀 Dev & Product Squad',
      description: 'Official group for team chat, real-time collaboration, and calls.',
      avatar: 'https://api.dicebear.com/7.x/identicon/svg?seed=DevProductSquad',
      creator: bob._id,
      members: [alice._id, bob._id, charlie._id],
      admins: [bob._id],
    });

    // Sample group message
    await Message.create({
      senderId: bob._id,
      groupId: teamGroup._id,
      content: 'Hey team! Welcome to our group chat. Feel free to share files, images, and voice notes! 🚀',
      messageType: 'text',
      status: 'delivered',
      timestamp: new Date(Date.now() - 1000 * 60 * 1),
    });

    console.log('[Seed] Demo accounts ready:');
    console.log('       1) alice@example.com / password123');
    console.log('       2) bob@example.com / password123');
    console.log('       3) charlie@example.com / password123');
    console.log('       4) Group: 🚀 Dev & Product Squad');
  } catch (err) {
    console.error('[Seed] Error seeding initial data:', err.message);
  }
};

module.exports = { seedInitialData };
