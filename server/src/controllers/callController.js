const CallLog = require('../models/CallLog');

// Google and Cloudflare public STUN servers (always available worldwide)
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

let cachedIceServers = null;
let cacheExpiry = 0;

const getIceServers = async (req, res, next) => {
  try {
    const now = Date.now();
    if (cachedIceServers && cacheExpiry > now) {
      return res.status(200).json({ iceServers: cachedIceServers });
    }

    const meteredAppName = process.env.METERED_APP_NAME;
    const meteredApiKey = process.env.METERED_API_KEY;

    if (meteredAppName && meteredApiKey) {
      try {
        const fetchUrl = `https://${meteredAppName}.metered.live/api/v1/turn/credentials?apiKey=${meteredApiKey}`;
        const response = await fetch(fetchUrl);
        if (response.ok) {
          const meteredServers = await response.json();
          if (Array.isArray(meteredServers) && meteredServers.length > 0) {
            cachedIceServers = [...DEFAULT_ICE_SERVERS, ...meteredServers];
            cacheExpiry = now + 1000 * 60 * 30; // 30 minutes in-memory cache
            return res.status(200).json({ iceServers: cachedIceServers });
          }
        } else {
          console.warn('[CallController] Metered API returned status:', response.status);
        }
      } catch (err) {
        console.warn('[CallController] Failed to fetch Metered TURN credentials:', err.message);
      }
    }

    // Check for custom TURN credentials in environment
    if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
      const customTurn = {
        urls: process.env.TURN_URL.split(',').map((u) => u.trim()),
        username: process.env.TURN_USERNAME,
        credential: process.env.TURN_CREDENTIAL,
      };
      return res.status(200).json({ iceServers: [...DEFAULT_ICE_SERVERS, customTurn] });
    }

    return res.status(200).json({ iceServers: DEFAULT_ICE_SERVERS });
  } catch (error) {
    next(error);
  }
};

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
  getIceServers,
  getCallLogs,
  createCallLog,
};
