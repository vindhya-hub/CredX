const { Sequelize } = require('sequelize');
const config = require('./config');
const logger = require('../utils/logger');

/**
 * PostgreSQL in every real environment. The test suite runs against an
 * in-memory SQLite database (DB_DIALECT=sqlite) so it needs no server.
 */
function createSequelize(db = config.db) {
  const logging = db.logging ? (sql) => logger.debug(sql) : false;

  if (db.dialect === 'sqlite') {
    return new Sequelize({ dialect: 'sqlite', storage: db.storage, logging });
  }

  const options = {
    dialect: 'postgres',
    logging,
    pool: db.pool,
    dialectOptions: db.ssl ? { ssl: { require: true, rejectUnauthorized: db.sslRejectUnauthorized } } : {},
  };

  if (db.url) return new Sequelize(db.url, options);
  return new Sequelize(db.name, db.user, db.password, { ...options, host: db.host, port: db.port });
}

const sequelize = createSequelize();

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Verifies connectivity, retrying while the database container starts up.
 * Throws after the last attempt instead of letting the server run without a DB.
 */
async function connectDB({ retries = config.db.connectRetries, delayMs = config.db.connectRetryDelayMs } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await sequelize.authenticate();
      logger.info('Database connected', { dialect: sequelize.getDialect() });
      return;
    } catch (error) {
      if (attempt >= retries) {
        logger.error('Database connection failed', { attempt, message: error.message });
        throw error;
      }
      logger.warn('Database not ready, retrying', { attempt, retries, message: error.message });
      await wait(delayMs);
    }
  }
}

module.exports = { sequelize, connectDB, createSequelize };
