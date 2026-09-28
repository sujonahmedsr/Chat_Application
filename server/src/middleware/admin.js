const User = require('../models/User');

const requireAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isSuperAdmin = user.email === 'shofi@gmail.com' || user.role === 'admin';
    if (!isSuperAdmin) {
      return res.status(403).json({ message: 'Access denied: Super Admin privileges required' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { requireAdmin };
