const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const SystemSetting = require('../models/SystemSetting');
const { generateToken } = require('../utils/token');
const { isSuperAdminEmail } = require('../utils/superAdmin');
const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_CALLBACK_URL,
  CLIENT_URL,
} = require('../config/config');

// Helper to decode or verify Google credential if provided
const decodeGoogleCredential = (credential) => {
  try {
    if (!credential) return null;
    const decoded = jwt.decode(credential);
    return decoded;
  } catch (err) {
    console.error('[Auth] Failed to decode Google credential:', err);
    return null;
  }
};

// 1. Get Direct Google OAuth 2.0 URL
const getGoogleAuthUrl = async (req, res, next) => {
  try {
    const clientId = GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(200).json({
        hasClientId: false,
        message: 'Google Client ID not configured in .env',
      });
    }

    const host = req.get('host');
    const protocol = req.protocol === 'http' && host.includes('render.com') ? 'https' : req.protocol;
    const defaultCallback = `${protocol}://${host}/api/auth/google/callback`;
    const isHostLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const callbackUrl = isHostLocal ? defaultCallback : (GOOGLE_CALLBACK_URL || defaultCallback);

    // Detect where user is coming from (via query param or config CLIENT_URL)
    const fallbackClient = (CLIENT_URL || 'http://localhost:3000').split(',')[0].trim();
    const clientOrigin = req.query.client_url || req.get('origin') || req.get('referer') || fallbackClient;
    const cleanOrigin = (clientOrigin || '').replace(/\/+$/, '').split('?')[0];

    const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth';
    const options = {
      redirect_uri: callbackUrl,
      client_id: clientId,
      access_type: 'offline',
      response_type: 'code',
      prompt: 'select_account',
      scope: ['openid', 'https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email'].join(' '),
      state: cleanOrigin,
    };

    const qs = new URLSearchParams(options);
    return res.status(200).json({
      hasClientId: true,
      url: `${rootUrl}?${qs.toString()}`,
    });
  } catch (err) {
    next(err);
  }
};

// 2. Direct Google OAuth 2.0 Callback
const googleOAuthCallback = async (req, res, next) => {
  const defaultClient = (CLIENT_URL || 'http://localhost:3000').split(',')[0].trim();
  const targetClient = (req.query.state || defaultClient).replace(/\/+$/, '');

  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${targetClient}/login?error=Google_code_missing`);
    }

    const host = req.get('host');
    const protocol = req.protocol === 'http' && host.includes('render.com') ? 'https' : req.protocol;
    const defaultCallback = `${protocol}://${host}/api/auth/google/callback`;
    const isHostLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const callbackUrl = isHostLocal ? defaultCallback : (GOOGLE_CALLBACK_URL || defaultCallback);

    // Exchange code for Google tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: String(code),
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenData.access_token) {
      console.error('[Google OAuth] Token exchange error:', tokenData);
      return res.redirect(`${targetClient}/login?error=Google_token_exchange_failed`);
    }

    // Fetch user profile from Google using access token
    const userinfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
      },
    });

    const googleUser = await userinfoResponse.json();
    if (!googleUser || !googleUser.email) {
      return res.redirect(`${targetClient}/login?error=Google_profile_fetch_failed`);
    }

    const email = googleUser.email.toLowerCase().trim();
    const defaultUsername = email.split('@')[0];
    const name = googleUser.name || googleUser.given_name || defaultUsername;
    const avatar = googleUser.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`;
    const isSuperAdmin = isSuperAdminEmail(email);

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({
        name,
        email,
        username: defaultUsername,
        googleId: googleUser.sub || '',
        avatar,
        role: isSuperAdmin ? 'admin' : 'user',
        isOnline: true,
        lastSeen: new Date(),
        settings: {
          saveChatHistory: true,
          chatRetentionDays: 15,
          hasCompletedSetup: false,
        },
      });
    } else {
      if (user.isBlockedByAdmin) {
        return res.redirect(`${targetClient}/login?error=Account_suspended`);
      }

      if (isSuperAdmin && user.role !== 'admin') {
        user.role = 'admin';
      }

      user.username = defaultUsername;
      if (avatar && (!user.avatar || user.avatar.includes('dicebear.com'))) {
        user.avatar = avatar;
      }
      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();
    }

    const jwtToken = generateToken(user._id);

    // Redirect user back to frontend with token
    return res.redirect(`${targetClient}/?token=${jwtToken}`);
  } catch (err) {
    console.error('[Google OAuth Callback] Error:', err);
    return res.redirect(`${targetClient}/login?error=Google_auth_internal_error`);
  }
};

// 3. Google Identity Services / GIS token authentication endpoint
const googleAuth = async (req, res, next) => {
  try {
    const { credential, email: directEmail, name: directName, avatar: directAvatar, googleId: directGoogleId } = req.body;

    let email = directEmail;
    let name = directName;
    let avatar = directAvatar;
    let googleId = directGoogleId;

    if (credential) {
      const decoded = decodeGoogleCredential(credential);
      if (decoded) {
        email = decoded.email || email;
        name = decoded.name || decoded.given_name || name;
        avatar = decoded.picture || avatar;
        googleId = decoded.sub || googleId;
      }
    }

    if (!email) {
      return res.status(400).json({ message: 'Google authentication failed: Email is required' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const defaultUsername = normalizedEmail.split('@')[0];
    const isSuperAdmin = isSuperAdminEmail(normalizedEmail);

    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      const finalName = (name && name.trim()) || defaultUsername;
      const finalAvatar = avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(finalName)}`;

      user = await User.create({
        name: finalName,
        email: normalizedEmail,
        username: defaultUsername,
        googleId: googleId || '',
        avatar: finalAvatar,
        role: isSuperAdmin ? 'admin' : 'user',
        isOnline: true,
        lastSeen: new Date(),
        settings: {
          saveChatHistory: true,
          chatRetentionDays: 15,
          hasCompletedSetup: false,
        },
      });
    } else {
      if (user.isBlockedByAdmin) {
        return res.status(403).json({
          message: 'Your account has been suspended by an administrator.',
        });
      }

      if (isSuperAdmin && user.role !== 'admin') {
        user.role = 'admin';
      }

      user.username = defaultUsername;
      if (avatar && (!user.avatar || user.avatar.includes('dicebear.com'))) {
        user.avatar = avatar;
      }

      if (googleId && !user.googleId) {
        user.googleId = googleId;
      }

      user.isOnline = true;
      user.lastSeen = new Date();
      await user.save();
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    next(error);
  }
};

// 4. Public system settings
const getPublicSettings = async (req, res, next) => {
  try {
    const dummySetting = await SystemSetting.findOne({ key: 'allowDummyUsers' });
    const allowDummyUsers = dummySetting ? !!dummySetting.value : false;

    return res.status(200).json({
      allowDummyUsers,
      hasGoogleClientId: !!GOOGLE_CLIENT_ID,
    });
  } catch (error) {
    next(error);
  }
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const isSuperAdmin = isSuperAdminEmail(normalizedEmail);

    const dummySetting = await SystemSetting.findOne({ key: 'allowDummyUsers' });
    const allowDummyUsers = dummySetting ? !!dummySetting.value : false;
    if (!allowDummyUsers && !isSuperAdmin) {
      return res.status(403).json({
        message: 'Sign-ups are currently restricted to Google Authentication only.',
      });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const encodedName = encodeURIComponent(name.trim());
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodedName}`;

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      username: normalizedEmail.split('@')[0],
      passwordHash,
      avatar,
      isOnline: true,
      lastSeen: new Date(),
      role: isSuperAdmin ? 'admin' : 'user',
      settings: {
        saveChatHistory: true,
        chatRetentionDays: 15,
        hasCompletedSetup: false,
      },
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
    const isSuperAdmin = isSuperAdminEmail(normalizedEmail);

    if (!isSuperAdmin) {
      const dummySetting = await SystemSetting.findOne({ key: 'allowDummyUsers' });
      const allowDummyUsers = dummySetting ? !!dummySetting.value : false;
      const isDemoAccount = ['alice@example.com', 'bob@example.com', 'charlie@example.com'].includes(normalizedEmail);
      if (isDemoAccount && !allowDummyUsers) {
        return res.status(403).json({
          message: 'Dummy user login is disabled by Super Admin. Please sign in with Google.',
        });
      }
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (user.isBlockedByAdmin) {
      return res.status(403).json({
        message: 'Your account has been suspended by an administrator. Please contact support.',
      });
    }

    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ message: 'Invalid email or password' });
      }
    } else {
      return res.status(401).json({ message: 'This account uses Google Sign-In. Please sign in with Google.' });
    }

    if (isSuperAdmin && user.role !== 'admin') {
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

    const isSuperAdmin = isSuperAdminEmail(req.user.email);
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
  getGoogleAuthUrl,
  googleOAuthCallback,
  googleAuth,
  getPublicSettings,
  register,
  login,
  getMe,
  logout,
};
