/**
 * Hermetic test environment, applied before any module is loaded.
 *
 * - Secrets are generated fresh for every run with crypto.randomBytes:
 *   nothing secret is committed, and a developer's real .env is never read
 *   (config.js skips dotenv when NODE_ENV=test).
 * - The database is an in-memory SQLite instance per test file.
 * - The embedding model is replaced by the deterministic hashing embedder.
 */
const crypto = require('crypto');

const randomSecret = () => crypto.randomBytes(48).toString('hex');

Object.assign(process.env, {
  NODE_ENV: 'test',
  DB_DIALECT: 'sqlite',
  DB_STORAGE: ':memory:',
  JWT_SECRET: randomSecret(),
  JWT_REFRESH_SECRET: randomSecret(),
  CARD_FINGERPRINT_SECRET: randomSecret(),
  BCRYPT_ROUNDS: '4',
  EMBEDDINGS_PROVIDER: 'hashing',
  EMBEDDINGS_WARMUP: 'false',
  LOG_LEVEL: 'silent',
  AUTH_EXPOSE_RESET_TOKEN: 'true',
  CORS_ORIGINS: 'http://localhost:5173',
  RATE_LIMIT_MAX: '100000',
  AUTH_RATE_LIMIT_MAX: '100000',
  ASSISTANT_RATE_LIMIT_MAX: '100000',
});

for (const key of ['DATABASE_URL', 'REDIS_URL', 'DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'TRUST_PROXY']) {
  delete process.env[key];
}
