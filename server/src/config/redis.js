const Redis = require('ioredis');
const { REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD } = require('./config');

let redisClient = null;
let isConnected = false;

try {
  const options = {
    connectTimeout: 2500,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      if (times > 5) {
        return null; // Stop retrying after 5 attempts, smoothly fallback to in-memory
      }
      return Math.min(times * 300, 2000);
    },
    lazyConnect: true,
  };

  if (REDIS_URL && REDIS_URL.trim()) {
    redisClient = new Redis(REDIS_URL.trim(), options);
  } else {
    redisClient = new Redis({
      host: REDIS_HOST,
      port: REDIS_PORT,
      password: REDIS_PASSWORD || undefined,
      ...options,
    });
  }

  redisClient.on('connect', () => {
    isConnected = true;
    console.log('[Redis] Connected to Redis instance successfully.');
  });

  redisClient.on('ready', () => {
    isConnected = true;
  });

  redisClient.on('close', () => {
    isConnected = false;
  });

  redisClient.on('error', (err) => {
    isConnected = false;
    // Keep error output clean and non-fatal
    if (process.env.NODE_ENV !== 'production' && !redisClient._hasLoggedWarning) {
      console.warn(`[Redis] Connection warning (${err.code || err.message}). Fallback to in-memory cache.`);
      redisClient._hasLoggedWarning = true;
    }
  });

  // Attempt initial connection asynchronously without blocking server startup
  redisClient.connect().catch(() => {
    isConnected = false;
  });
} catch (err) {
  console.warn('[Redis] Initialization warning:', err.message);
  isConnected = false;
}

module.exports = {
  getRedisClient: () => redisClient,
  isRedisConnected: () => isConnected,
};
