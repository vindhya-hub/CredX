/**
 * Express application factory.
 *
 * `createApp()` builds a fully wired app without opening a port or touching
 * the database, so the test suite (supertest) and server.js share exactly
 * the same middleware stack.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const config = require('./config/config');
const { sequelize } = require('./models');
const requestId = require('./middlewares/requestId.middleware');
const { createRateLimiters } = require('./middlewares/rateLimit.middleware');
const { notFoundHandler, errorHandler } = require('./middlewares/error.middleware');
const AppError = require('./utils/AppError');

const authRoutes = require('./modules/auth/auth.routes');
const walletRoutes = require('./modules/wallet/wallet.routes');
const transactionRoutes = require('./modules/transactions/transaction.routes');
const loanRoutes = require('./modules/loans/loan.routes');
const cardRoutes = require('./modules/cards/card.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const assistantRoutes = require('./modules/assistant/assistant.routes');
const { getEmbeddingService } = require('./modules/assistant/embeddings');

/**
 * CORS allowlist. Requests without an Origin header (curl, server-to-server,
 * same-origin navigation) are allowed; browser requests from any origin that
 * is not listed in CORS_ORIGINS are rejected with 403. "*" allows any origin
 * (not recommended outside local experiments).
 */
function corsOptions(origins) {
  const allowAll = origins.includes('*');
  const allowed = new Set(origins.map((o) => o.replace(/\/+$/, '').toLowerCase()));

  return {
    origin(origin, callback) {
      if (!origin || allowAll || allowed.has(origin.toLowerCase())) return callback(null, true);
      return callback(new AppError(403, 'Origin not allowed by CORS policy', 'CORS_ORIGIN_DENIED'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
    credentials: false, // bearer tokens only, no cookies
    maxAge: 600,
  };
}

/** HTTP access log without query strings, bodies or headers (no secrets in logs). */
function httpLogger() {
  morgan.token('path', (req) => (req.originalUrl || req.url).split('?')[0]);
  morgan.token('rid', (req) => req.id);
  const format = config.httpLogFormat === 'dev'
    ? ':method :path :status :response-time ms - :rid'
    : ':remote-addr :method :path :status :res[content-length] - :response-time ms :rid';
  return morgan(format, { skip: (req) => req.path === '/api/health' });
}

/**
 * @param {object} [options]
 * @param {object} [options.redisClient] connected node-redis client (shared rate-limit store)
 * @param {object} [options.rateLimit]   overrides for config.rateLimit (tests)
 * @param {string[]} [options.corsOrigins] overrides for config.cors.origins (tests)
 */
function createApp({ redisClient = null, rateLimit = {}, corsOrigins = config.cors.origins } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.locals.rateLimiters = createRateLimiters({ ...config.rateLimit, ...rateLimit }, redisClient);

  app.use(requestId);
  app.use(helmet());
  app.use(cors(corsOptions(corsOrigins)));
  if (!config.isTest) app.use(httpLogger());
  app.use(express.json({ limit: '100kb' }));

  // Liveness + readiness probe (used by the Docker health check). Not rate limited.
  app.get('/api/health', async (req, res) => {
    let database = 'up';
    try {
      await sequelize.authenticate();
    } catch {
      database = 'down';
    }
    const embeddings = getEmbeddingService().status();
    res.status(database === 'up' ? 200 : 503).json({
      status: database === 'up' ? 'ok' : 'degraded',
      database,
      embeddings: { provider: embeddings.provider, active: embeddings.active, state: embeddings.state },
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.use('/api', app.locals.rateLimiters.global);

  app.use('/api/auth', authRoutes);
  app.use('/api/wallet', walletRoutes);
  app.use('/api/transactions', transactionRoutes);
  app.use('/api/loans', loanRoutes);
  app.use('/api/cards', cardRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/assistant', assistantRoutes);

  app.get('/', (req, res) => {
    res.send('CredX Fintech API Running');
  });

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp, corsOptions };
