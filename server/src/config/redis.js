const Redis = require('ioredis');
const { REDIS_URL } = require('./config');

let redisClient = null;
let isConnected = false;

// Only initialize Redis client if a non-empty REDIS_URL is configured
if (REDIS_URL && REDIS_URL.trim()) {
  const isLocalHost = REDIS_URL.includes('127.0.0.1') || REDIS_URL.includes('localhost');
  const isProduction = process.env.NODE_ENV === 'production';

  // In production (e.g. Render), skip connecting to localhost to avoid connection errors
  if (!isProduction || !isLocalHost) {
    try {
      redisClient = new Redis(REDIS_URL.trim(), {
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        retryStrategy(times) {
          if (times > 3) return null; // Stop retrying after 3 attempts, smoothly fallback to in-memory
          return Math.min(times * 300, 1500);
        },
        lazyConnect: true,
      });

      redisClient.on('connect', () => {
        isConnected = true;
        console.log('[Redis] Connected to external Redis instance successfully.');
      });

      redisClient.on('ready', () => {
        isConnected = true;
      });

      redisClient.on('close', () => {
        isConnected = false;
      });

      redisClient.on('error', (err) => {
        isConnected = false;
      });

      // Attempt non-blocking connection
      redisClient.connect().catch(() => {
        isConnected = false;
      });
    } catch (err) {
      isConnected = false;
    }
  }
}

module.exports = {
  getRedisClient: () => redisClient,
  isRedisConnected: () => isConnected,
};
