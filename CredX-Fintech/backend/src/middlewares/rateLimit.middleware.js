/**
 * Rate limiting (express-rate-limit).
 *
 *  - global:    every /api request, per client IP
 *  - auth:      stricter limit on login/register/refresh/password endpoints (brute-force protection)
 *  - assistant: per authenticated user (the assistant is the most CPU-heavy endpoint)
 *
 * Counters live in memory by default. When a Redis client is supplied
 * (REDIS_URL set and reachable) they are stored in Redis so limits are shared
 * across instances. Store failures fail open (request allowed, error logged)
 * so a Redis outage cannot take the API down.
 */
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const logger = require('../utils/logger');

const limiterLogger = {
  error: (error, message) => logger.error(message || 'Rate limiter error', { error }),
  warn: (error, message) => logger.warn(message || 'Rate limiter warning', { error }),
};

function buildStore(redisClient, name) {
  if (!redisClient) return undefined; // express-rate-limit's MemoryStore
  const { RedisStore } = require('rate-limit-redis');
  return new RedisStore({
    prefix: `credx:rl:${name}:`,
    sendCommand: (...args) => redisClient.sendCommand(args),
  });
}

function createLimiter({ name, windowMs, limit, redisClient, keyGenerator, message }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    store: buildStore(redisClient, name),
    passOnStoreError: true,
    logger: limiterLogger,
    ...(keyGenerator && { keyGenerator }),
    handler: (req, res, next, options) => {
      res.status(options.statusCode).json({
        message: message || 'Too many requests, please try again later.',
        code: 'RATE_LIMITED',
      });
    },
  });
}

function createRateLimiters(settings, redisClient = null) {
  return {
    global: createLimiter({
      name: 'global',
      windowMs: settings.windowMs,
      limit: settings.max,
      redisClient,
    }),
    auth: createLimiter({
      name: 'auth',
      windowMs: settings.authWindowMs,
      limit: settings.authMax,
      redisClient,
      message: 'Too many authentication attempts, please try again later.',
    }),
    assistant: createLimiter({
      name: 'assistant',
      windowMs: settings.assistantWindowMs,
      limit: settings.assistantMax,
      redisClient,
      // Runs after authMiddleware, so limit per user; fall back to the IP (IPv6-safe).
      keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip)),
      message: 'Too many assistant queries, please slow down.',
    }),
  };
}

/**
 * Route-level hook: `router.post('/login', useLimiter('auth'), ...)`.
 * The limiter instances are created once per app (see app.js) and looked up
 * from `app.locals`, so routers stay plain modules.
 */
const useLimiter = (name) => (req, res, next) => {
  const limiter = req.app.locals.rateLimiters && req.app.locals.rateLimiters[name];
  return limiter ? limiter(req, res, next) : next();
};

module.exports = { createRateLimiters, useLimiter };
