/**
 * Optional Redis connection, used only as the shared rate-limit store when
 * REDIS_URL is set (so limits hold across several backend instances).
 * Without REDIS_URL nothing here runs and limits are kept in memory.
 */
const config = require('./config');
const logger = require('../utils/logger');

let client = null;

/**
 * Connects once at startup. Returns the client, or null when Redis is not
 * configured or unreachable (the caller then falls back to the memory store).
 */
async function connectRedis({ url = config.redisUrl, timeoutMs = 5000 } = {}) {
  if (!url) return null;
  if (client) return client;

  const { createClient } = require('redis');
  const candidate = createClient({
    url,
    // Fail commands fast while disconnected instead of queueing them forever;
    // the rate limiter then lets requests through (fail open) and logs.
    disableOfflineQueue: true,
    socket: {
      connectTimeout: timeoutMs,
      reconnectStrategy: (retries) => Math.min(retries * 500, 5000),
    },
  });

  let lastErrorLog = 0;
  candidate.on('error', (error) => {
    if (Date.now() - lastErrorLog > 30000) {
      lastErrorLog = Date.now();
      logger.warn('Redis error', { message: error.message });
    }
  });

  try {
    await Promise.race([
      candidate.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Redis connection timed out')), timeoutMs)),
    ]);
    client = candidate;
    logger.info('Redis connected; using it for rate limiting');
    return client;
  } catch (error) {
    logger.warn('Redis unavailable; falling back to in-memory rate limiting', { message: error.message });
    candidate.destroy?.();
    return null;
  }
}

async function closeRedis() {
  if (!client) return;
  const current = client;
  client = null;
  try {
    await current.close?.();
  } catch {
    current.destroy?.();
  }
}

module.exports = { connectRedis, closeRedis };
