const express = require('express');
const router = express.Router();
const {
  getGoogleAuthUrl,
  googleOAuthCallback,
  googleAuth,
  getPublicSettings,
  register,
  login,
  getMe,
  logout,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// Direct Google OAuth 2.0 routes
router.get('/google/url', getGoogleAuthUrl);
router.get('/google/callback', googleOAuthCallback);
router.post('/google', googleAuth);

// Public settings & traditional routes
router.get('/settings', getPublicSettings);
router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logout);

module.exports = router;
