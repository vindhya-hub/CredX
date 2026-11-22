/**
 * Process entry point: validates configuration, connects to PostgreSQL,
 * applies schema upgrades, optionally connects Redis (shared rate-limit
 * store), starts listening and shuts down gracefully on SIGINT/SIGTERM.
 */
const config = require('./config/config');
const logger = require('./utils/logger');
const { sequelize, connectDB } = require('./config/db');
const { connectRedis, closeRedis } = require('./config/redis');
const { prepareDatabase } = require('./db/migrations');
const { createApp } = require('./app');

async function start() {
  for (const warning of config.assertConfig()) logger.warn(warning);

  await connectDB();
  await prepareDatabase(sequelize, { mode: config.db.sync });

  const redisClient = await connectRedis();
  const app = createApp({ redisClient });

  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`, {
      env: config.env,
      corsOrigins: config.cors.origins,
      rateLimitStore: redisClient ? 'redis' : 'memory',
    });
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down`);
    const forceExit = setTimeout(() => process.exit(1), 10000);
    forceExit.unref();
    server.close(async () => {
      await Promise.allSettled([sequelize.close(), closeRedis()]);
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return server;
}

start().catch((error) => {
  if (error.code === 'INVALID_CONFIG') {
    // Plain text so the list of problems is readable; contains no values.
    process.stderr.write(['', error.message, '', ''].join('\n'));
  } else {
    logger.error('Failed to start server', { message: error.message, code: error.code });
  }
  process.exit(1);
});
