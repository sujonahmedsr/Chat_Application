const { getRedisClient, isRedisConnected } = require('../config/redis');

// In-memory fallback cache store for ultra-fast performance if Redis is not running
const memoryStore = new Map();

// Periodic cleanup of expired in-memory items (unref to avoid hanging CLI / build tasks)
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of memoryStore.entries()) {
    if (entry.expiresAt && entry.expiresAt <= now) {
      memoryStore.delete(key);
    }
  }
}, 60000);
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

class CacheService {
  constructor() {
    this.defaultTTL = 300; // 5 minutes default TTL
  }

  /**
   * Get value from cache (Redis or Memory)
   */
  async get(key) {
    if (!key) return null;

    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        if (client) {
          const raw = await client.get(key);
          if (raw) {
            return JSON.parse(raw);
          }
          return null;
        }
      }
    } catch (err) {
      // Redis get failed, gracefully fall back to memory
    }

    // In-memory fallback lookup
    const entry = memoryStore.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      memoryStore.delete(key);
      return null;
    }
    return entry.value;
  }

  /**
   * Store value into cache with TTL in seconds
   */
  async set(key, value, ttlSeconds = this.defaultTTL) {
    if (!key || value === undefined) return;

    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        if (client) {
          const serialized = JSON.stringify(value);
          if (ttlSeconds > 0) {
            await client.setex(key, ttlSeconds, serialized);
          } else {
            await client.set(key, serialized);
          }
          return;
        }
      }
    } catch (err) {
      // Redis set failed, gracefully fall back to memory
    }

    // In-memory store
    memoryStore.set(key, {
      value,
      expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null,
    });
  }

  /**
   * Delete a key from cache
   */
  async del(key) {
    if (!key) return;

    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        if (client) {
          await client.del(key);
        }
      }
    } catch (err) {
      // Ignore Redis del failure
    }

    memoryStore.delete(key);
  }

  /**
   * Delete all keys matching a prefix or wildcard pattern
   */
  async delPattern(pattern) {
    if (!pattern) return;

    try {
      if (isRedisConnected()) {
        const client = getRedisClient();
        if (client) {
          const keys = await client.keys(pattern);
          if (keys && keys.length > 0) {
            await client.del(...keys);
          }
        }
      }
    } catch (err) {
      // Ignore Redis delPattern failure
    }

    // In-memory pattern cleanup
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    for (const key of memoryStore.keys()) {
      if (regexPattern.test(key)) {
        memoryStore.delete(key);
      }
    }
  }

  // Domain-specific helpers for high performance

  /**
   * Friends list cache
   */
  async getFriendsCache(userId) {
    return this.get(`friends:cache:${userId}`);
  }

  async setFriendsCache(userId, friends, ttl = 300) {
    return this.set(`friends:cache:${userId}`, friends, ttl);
  }

  async invalidateFriends(userId) {
    if (userId) {
      await this.del(`friends:cache:${userId}`);
    }
  }

  /**
   * Direct Chat Messages cache
   */
  getConversationCacheKey(userA, userB) {
    const sorted = [String(userA), String(userB)].sort();
    return `messages:direct:${sorted[0]}:${sorted[1]}`;
  }

  async getMessagesCache(userA, userB) {
    return this.get(this.getConversationCacheKey(userA, userB));
  }

  async setMessagesCache(userA, userB, messages, ttl = 300) {
    return this.set(this.getConversationCacheKey(userA, userB), messages, ttl);
  }

  async invalidateDirectMessages(userA, userB) {
    const key = this.getConversationCacheKey(userA, userB);
    await this.del(key);
    // Invalidate friends list cache for both users since lastMessage preview changes
    await this.invalidateFriends(userA);
    await this.invalidateFriends(userB);
  }

  /**
   * Group Chat Messages & Groups list cache
   */
  async getGroupMessagesCache(groupId) {
    return this.get(`messages:group:${groupId}`);
  }

  async setGroupMessagesCache(groupId, messages, ttl = 300) {
    return this.set(`messages:group:${groupId}`, messages, ttl);
  }

  async invalidateGroupMessages(groupId) {
    await this.del(`messages:group:${groupId}`);
    // Invalidate groups list cache
    await this.delPattern('groups:cache:*');
  }

  async getUserGroupsCache(userId) {
    return this.get(`groups:cache:${userId}`);
  }

  async setUserGroupsCache(userId, groups, ttl = 300) {
    return this.set(`groups:cache:${userId}`, groups, ttl);
  }

  async invalidateUserGroups(userId) {
    if (userId) {
      await this.del(`groups:cache:${userId}`);
    } else {
      await this.delPattern('groups:cache:*');
    }
  }

  /**
   * User profile cache for /auth/me
   */
  async getUserCache(userId) {
    return this.get(`user:cache:${userId}`);
  }

  async setUserCache(userId, user, ttl = 600) {
    return this.set(`user:cache:${userId}`, user, ttl);
  }

  async invalidateUser(userId) {
    if (userId) {
      await this.del(`user:cache:${userId}`);
    }
  }
}

const cacheService = new CacheService();
module.exports = cacheService;
