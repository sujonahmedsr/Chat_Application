const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Message = require('../models/Message');
const Group = require('../models/Group');

const SystemSetting = require('../models/SystemSetting');
const { SUPER_ADMIN_EMAILS } = require('./superAdmin');

const seedInitialData = async () => {
  try {
    // 0. Ensure default System Settings (dummy users OFF by default)
    const existingDummySetting = await SystemSetting.findOne({ key: 'allowDummyUsers' });
    if (!existingDummySetting) {
      await SystemSetting.create({ key: 'allowDummyUsers', value: false });
      console.log('[Seed] ⚙️ Initialized allowDummyUsers: false');
    }

    // 1. Ensure Super Admins exist & have role: admin
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('admin123', salt);

    for (const email of SUPER_ADMIN_EMAILS) {
      const normalizedEmail = email.toLowerCase().trim();
      let adminUser = await User.findOne({ email: normalizedEmail });
      if (!adminUser) {
        adminUser = await User.create({
          name: normalizedEmail.split('@')[0],
          email: normalizedEmail,
          passwordHash,
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(normalizedEmail)}`,
          role: 'admin',
          isOnline: false,
          lastSeen: new Date(),
        });
        console.log(`[Seed] 🛡️ Super Admin created: ${normalizedEmail}`);
      } else if (adminUser.role !== 'admin') {
        adminUser.role = 'admin';
        await adminUser.save();
        console.log(`[Seed] 🛡️ Upgraded ${normalizedEmail} to Super Admin`);
      }
    }

    // Ensure shofiqul.sujon2021@gmail.com is set as regular user, not admin
    await User.updateOne({ email: 'shofiqul.sujon2021@gmail.com' }, { $set: { role: 'user' } });
  } catch (err) {
    console.error('[Seed] Error seeding initial data:', err.message);
  }
};

module.exports = { seedInitialData };

