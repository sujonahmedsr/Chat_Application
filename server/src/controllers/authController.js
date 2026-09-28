const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../utils/token');

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Friendly default avatar with DiceBear initials / avataaars
    const encodedName = encodeURIComponent(name.trim());
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodedName}`;

    const normalizedEmail = email.toLowerCase().trim();
    const isSuperAdmin = normalizedEmail === 'shofi@gmail.com';

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      avatar,
      isOnline: true,
      lastSeen: new Date(),
      role: isSuperAdmin ? 'admin' : 'user',
    });

    const token = generateToken(user._id);

    return res.status(201).json({
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if user is blocked by administrator
    if (user.isBlockedByAdmin) {
      return res.status(403).json({
        message: 'Your account has been suspended by an administrator. Please contact support.',
      });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Auto-grant super admin role to shofi@gmail.com
    if (normalizedEmail === 'shofi@gmail.com' && user.role !== 'admin') {
      user.role = 'admin';
    }

    user.isOnline = true;
    user.lastSeen = new Date();
    await user.save();

    const token = generateToken(user._id);

    return res.status(200).json({
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
};

const getMe = async (req, res, next) => {
  try {
    if (req.user.isBlockedByAdmin) {
      return res.status(403).json({
        message: 'Your account has been suspended by an administrator.',
      });
    }

    const isSuperAdmin = req.user.email === 'shofi@gmail.com';
    if (isSuperAdmin && req.user.role !== 'admin') {
      req.user.role = 'admin';
      await req.user.save();
    }

    return res.status(200).json({ user: req.user.toJSON() });
  } catch (error) {
    next(error);
  }
};

const logout = async (req, res, next) => {
  try {
    if (req.user) {
      req.user.isOnline = false;
      req.user.lastSeen = new Date();
      await req.user.save();
    }
    return res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  logout,
};
