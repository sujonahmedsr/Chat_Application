const CallLog = require('../models/CallLog');

// Google and Cloudflare public STUN servers + Metered Global TURN Relay fallback
const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
  { urls: 'stun:stun.relay.metered.ca:80' },
  {
    urls: [
      'turn:global.relay.metered.ca:80',
      'turn:global.relay.metered.ca:80?transport=tcp',
      'turn:global.relay.metered.ca:443',
      'turns:global.relay.metered.ca:443?transport=tcp',
    ],
    username: '21b9764963d38d0b9408466c',
    credential: 'NLDW6hUUVg3lSPF1',
  },
];

let cachedIceServers = null;
let cacheExpiry = 0;

const getIceServers = async (req, res, next) => {
  try {
    const now = Date.now();
    if (cachedIceServers && cacheExpiry > now) {
      return res.status(200).json({ iceServers: cachedIceServers });
    }

    const rawMeteredAppName = process.env.METERED_APP_NAME || 'shofichat';
    const meteredApiKey = process.env.METERED_API_KEY;
    const meteredSecretKey = process.env.METERED_SECRET_KEY || meteredApiKey;
    const meteredAppName = rawMeteredAppName.replace(/https?:\/\//, '').replace('.metered.live', '').trim();

    let fetchedTurnServers = null;

    // 1. Try direct fetch with credential API Key if available
    if (meteredApiKey) {
      try {
        const v1Res = await fetch(`https://${meteredAppName}.metered.live/api/v1/turn/credentials?apiKey=${meteredApiKey}`);
        if (v1Res.ok) {
          const v1Data = await v1Res.json();
          if (Array.isArray(v1Data) && v1Data.length > 0) {
            fetchedTurnServers = v1Data;
          }
        }
      } catch (e) {
        console.warn('[CallController] v1 turn/credentials fetch failed:', e.message);
      }
    }

    // 2. If v1 direct fetch didn't return servers, query v2 with secretKey to list active credentials
    if (!fetchedTurnServers && meteredSecretKey) {
      try {
        const v2Res = await fetch(`https://${meteredAppName}.metered.live/api/v2/turn/credentials?secretKey=${meteredSecretKey}`);
        if (v2Res.ok) {
          const v2Data = await v2Res.json();
          const records = v2Data?.data;
          if (Array.isArray(records) && records.length > 0) {
            const activeRecord = records[0];
            // If the record has an apiKey, fetch the complete server list
            if (activeRecord.apiKey) {
              const v1Retry = await fetch(`https://${meteredAppName}.metered.live/api/v1/turn/credentials?apiKey=${activeRecord.apiKey}`);
              if (v1Retry.ok) {
                const retryData = await v1Retry.json();
                if (Array.isArray(retryData) && retryData.length > 0) {
                  fetchedTurnServers = retryData;
                }
              }
            }
            // Fallback: manually construct TURN server list from active username & password
            if (!fetchedTurnServers && activeRecord.username && activeRecord.password) {
              fetchedTurnServers = [
                { urls: 'stun:stun.relay.metered.ca:80' },
                {
                  urls: [
                    'turn:global.relay.metered.ca:80',
                    'turn:global.relay.metered.ca:80?transport=tcp',
                    'turn:global.relay.metered.ca:443',
                    'turns:global.relay.metered.ca:443?transport=tcp',
                  ],
                  username: activeRecord.username,
                  credential: activeRecord.password,
                },
              ];
            }
          }
        }
      } catch (e) {
        console.warn('[CallController] v2 turn/credentials list query failed:', e.message);
      }
    }

    // 3. Custom TURN credentials from environment
    if (!fetchedTurnServers && process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
      fetchedTurnServers = [
        {
          urls: process.env.TURN_URL.split(',').map((u) => u.trim()),
          username: process.env.TURN_USERNAME,
          credential: process.env.TURN_CREDENTIAL,
        },
      ];
    }

    // Combine standard STUN with resolved TURN servers (or use guaranteed DEFAULT_ICE_SERVERS)
    const baseStuns = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
    ];

    if (fetchedTurnServers && fetchedTurnServers.length > 0) {
      cachedIceServers = [...baseStuns, ...fetchedTurnServers];
    } else {
      cachedIceServers = DEFAULT_ICE_SERVERS;
    }

    cacheExpiry = now + 1000 * 60 * 30; // 30 minutes in-memory cache
    return res.status(200).json({ iceServers: cachedIceServers });
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
