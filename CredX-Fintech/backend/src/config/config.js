/**
 * Central runtime configuration.
 *
 * Every environment variable the backend reads is parsed here, so the rest
 * of the code never touches `process.env` directly. Each variable is
 * documented in `backend/.env.example` and in the README.
 *
 * Rules:
 *  - Secrets (JWT secrets, DB password, card fingerprint key) have NO
 *    defaults anywhere. assertConfig() refuses to start without them.
 *  - Non-secret settings may have safe defaults (localhost, ports, limits).
 *  - `.env` is loaded with dotenv, except under NODE_ENV=test: the test
 *    suite must never read a developer's real `.env`; its setup file
 *    generates throwaway secrets with crypto.randomBytes instead.
 */
const env = process.env.NODE_ENV || 'development';
const isProd = env === 'production';
const isTest = env === 'test';

if (!isTest) require('dotenv').config({ quiet: true });

const str = (value, fallback = undefined) =>
  value === undefined || value === null || String(value).trim() === '' ? fallback : String(value).trim();

const int = (value, fallback) => {
  const parsed = Number.parseInt(str(value, ''), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const float = (value, fallback) => {
  const parsed = Number.parseFloat(str(value, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const bool = (value, fallback = false) => {
  const v = str(value);
  if (v === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
};

const list = (value, fallback = []) => {
  const v = str(value);
  if (v === undefined) return fallback;
  return v
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
};

/** TRUST_PROXY accepts a hop count ("1"), a boolean, or an Express preset/IP list. */
const parseTrustProxy = (value) => {
  const v = str(value);
  if (v === undefined) return false;
  if (/^\d+$/.test(v)) return Number(v);
  if (['true', 'false'].includes(v.toLowerCase())) return v.toLowerCase() === 'true';
  return v;
};

// Local development only: the Vite dev server. Production has no default.
const DEV_CORS_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

const MIN_SECRET_LENGTH = 32;

const config = {
  env,
  isProd,
  isTest,
  port: int(process.env.PORT, 5000),

  db: {
    url: str(process.env.DATABASE_URL),
    // "sqlite" exists for the automated tests only.
    dialect: str(process.env.DB_DIALECT, 'postgres'),
    host: str(process.env.DB_HOST, isProd ? undefined : 'localhost'),
    port: int(process.env.DB_PORT, 5432),
    name: str(process.env.DB_NAME),
    user: str(process.env.DB_USER),
    password: str(process.env.DB_PASSWORD),
    storage: str(process.env.DB_STORAGE, ':memory:'),
    ssl: bool(process.env.DB_SSL, false),
    sslRejectUnauthorized: bool(process.env.DB_SSL_REJECT_UNAUTHORIZED, true),
    logging: bool(process.env.DB_LOGGING, false),
    // alter: create + alter tables to match models (development default)
    // safe:  create missing tables/columns/indexes only (production default)
    // none:  never touch the schema
    sync: str(process.env.DB_SYNC, isProd ? 'safe' : 'alter'),
    pool: {
      max: int(process.env.DB_POOL_MAX, 10),
      min: int(process.env.DB_POOL_MIN, 0),
      idle: int(process.env.DB_POOL_IDLE_MS, 10000),
      acquire: int(process.env.DB_POOL_ACQUIRE_MS, 30000),
    },
    connectRetries: int(process.env.DB_CONNECT_RETRIES, 10),
    connectRetryDelayMs: int(process.env.DB_CONNECT_RETRY_DELAY_MS, 3000),
  },

  jwt: {
    accessSecret: str(process.env.JWT_SECRET),
    refreshSecret: str(process.env.JWT_REFRESH_SECRET),
    accessTtl: str(process.env.JWT_ACCESS_TTL, '15m'),
    refreshTtl: str(process.env.JWT_REFRESH_TTL, '7d'),
    issuer: str(process.env.JWT_ISSUER, 'credx-api'),
    audience: str(process.env.JWT_AUDIENCE, 'credx-app'),
  },

  bcryptRounds: int(process.env.BCRYPT_ROUNDS, 12),

  auth: {
    // Password-reset tokens are normally delivered out of band (e-mail). No mail
    // provider is wired up, so for local demos the token can be echoed back in
    // the API response. This is forced off in production.
    exposeResetToken: bool(process.env.AUTH_EXPOSE_RESET_TOKEN, false) && !isProd,
    resetTokenTtlMinutes: int(process.env.AUTH_RESET_TOKEN_TTL_MINUTES, 15),
  },

  cors: {
    origins: list(process.env.CORS_ORIGINS, isProd ? [] : DEV_CORS_ORIGINS),
  },

  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

  rateLimit: {
    windowMs: int(process.env.RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    max: int(process.env.RATE_LIMIT_MAX, 300),
    authWindowMs: int(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
    authMax: int(process.env.AUTH_RATE_LIMIT_MAX, 20),
    assistantWindowMs: int(process.env.ASSISTANT_RATE_LIMIT_WINDOW_MS, 60 * 1000),
    assistantMax: int(process.env.ASSISTANT_RATE_LIMIT_MAX, 30),
  },

  redisUrl: str(process.env.REDIS_URL, null),

  transfers: {
    dailyAmount: float(process.env.TRANSFER_DAILY_LIMIT, 5000),
    dailyCount: int(process.env.TRANSFER_DAILY_COUNT, 5),
  },

  loans: {
    // Applications are rejected while the user already has this many active loans.
    maxActive: int(process.env.LOAN_MAX_ACTIVE, 3),
  },

  // Key for the keyed hash (HMAC) used to detect duplicate cards without
  // storing the card number. Optional: when unset, a key is derived from
  // JWT_SECRET (never from a hardcoded value).
  cardFingerprintSecret: str(process.env.CARD_FINGERPRINT_SECRET),

  logLevel: str(process.env.LOG_LEVEL, isTest ? 'silent' : 'info'),
  httpLogFormat: str(process.env.HTTP_LOG_FORMAT, isProd ? 'short' : 'dev'),

  assistant: {
    // "transformers" = local sentence-embedding model (falls back to hashing
    // automatically when it cannot load); "hashing" = deterministic fallback only.
    embeddingsProvider: str(process.env.EMBEDDINGS_PROVIDER, isTest ? 'hashing' : 'transformers'),
    embeddingModel: str(process.env.EMBEDDINGS_MODEL, 'Xenova/all-MiniLM-L6-v2'),
    embeddingDtype: str(process.env.EMBEDDINGS_DTYPE, 'q8'),
    embeddingCacheDir: str(process.env.EMBEDDINGS_CACHE_DIR),
    embeddingRetryMs: int(process.env.EMBEDDINGS_RETRY_MS, 5 * 60 * 1000),
    // How long a query waits for a model that is still loading before using the fallback.
    embeddingWaitMs: int(process.env.EMBEDDINGS_WAIT_MS, 2000),
    embeddingCacheSize: int(process.env.EMBEDDINGS_CACHE_SIZE, 5000),
    warmup: bool(process.env.EMBEDDINGS_WARMUP, !isTest),
    // Score fusion: "weighted" = keywordWeight * bm25 + (1 - keywordWeight) * cosine
    // (both min-max normalised); "rrf" = weighted reciprocal rank fusion.
    fusion: str(process.env.ASSISTANT_FUSION, 'weighted'),
    keywordWeight: float(process.env.ASSISTANT_KEYWORD_WEIGHT, 0.4),
    rrfK: int(process.env.ASSISTANT_RRF_K, 60),
    // Minimum cosine similarity for a record with no keyword overlap to count
    // as relevant (per embedder; these are the defaults for each).
    minSimilarityModel: float(process.env.ASSISTANT_MIN_SIMILARITY_MODEL, 0.3),
    minSimilarityHashing: float(process.env.ASSISTANT_MIN_SIMILARITY_HASHING, 0.2),
    // ...and at least this fraction of the best similarity among the candidates.
    relativeCutoff: float(process.env.ASSISTANT_RELATIVE_CUTOFF, 0.85),
    topK: int(process.env.ASSISTANT_TOP_K, 5),
    maxRecords: int(process.env.ASSISTANT_MAX_RECORDS, 500),
    currency: str(process.env.CURRENCY, 'INR'),
    locale: str(process.env.LOCALE, 'en-IN'),
  },
};

const isPositiveInt = (n) => Number.isInteger(n) && n > 0;

/**
 * Fail fast on configuration that would make the API insecure or unusable.
 * Called by server.js and the seed script before anything else happens.
 * @returns {string[]} warnings (non-fatal)
 */
function assertConfig(cfg = config) {
  const problems = [];
  const warnings = [];
  const { accessSecret, refreshSecret } = cfg.jwt;

  // --- secrets ---
  if (!accessSecret) problems.push('JWT_SECRET is required');
  else if (accessSecret.length < MIN_SECRET_LENGTH) problems.push(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  if (!refreshSecret) problems.push('JWT_REFRESH_SECRET is required');
  else if (refreshSecret.length < MIN_SECRET_LENGTH) problems.push(`JWT_REFRESH_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  if (accessSecret && refreshSecret && accessSecret === refreshSecret) {
    problems.push('JWT_SECRET and JWT_REFRESH_SECRET must be different');
  }
  if (cfg.cardFingerprintSecret && cfg.cardFingerprintSecret.length < MIN_SECRET_LENGTH) {
    problems.push(`CARD_FINGERPRINT_SECRET must be at least ${MIN_SECRET_LENGTH} characters when set`);
  }

  // --- database ---
  if (!['postgres', 'sqlite'].includes(cfg.db.dialect)) problems.push('DB_DIALECT must be "postgres" (or "sqlite" for tests)');
  if (cfg.db.dialect === 'sqlite' && !cfg.isTest) problems.push('DB_DIALECT=sqlite is only supported for the test suite');
  if (cfg.db.dialect === 'postgres' && !cfg.db.url) {
    for (const [key, value] of [['DB_HOST', cfg.db.host], ['DB_NAME', cfg.db.name], ['DB_USER', cfg.db.user], ['DB_PASSWORD', cfg.db.password]]) {
      if (!value) problems.push(`${key} is required (or set DATABASE_URL)`);
    }
  }
  if (!['alter', 'safe', 'none'].includes(cfg.db.sync)) problems.push('DB_SYNC must be one of: alter, safe, none');

  // --- auth / http ---
  const minRounds = cfg.isProd ? 10 : 4;
  if (!Number.isInteger(cfg.bcryptRounds) || cfg.bcryptRounds < minRounds || cfg.bcryptRounds > 15) {
    problems.push(`BCRYPT_ROUNDS must be an integer between ${minRounds} and 15`);
  }
  for (const [key, value] of Object.entries(cfg.rateLimit)) {
    if (!isPositiveInt(value)) problems.push(`Rate limit setting ${key} must be a positive integer`);
  }
  if (cfg.isProd && cfg.cors.origins.includes('*')) warnings.push('CORS_ORIGINS="*" allows any website to call the API');
  if (cfg.isProd && !cfg.cors.origins.length) {
    warnings.push('CORS_ORIGINS is empty: only same-origin requests (e.g. via the nginx proxy) will work');
  }

  // --- assistant ---
  if (!['transformers', 'hashing'].includes(cfg.assistant.embeddingsProvider)) {
    problems.push('EMBEDDINGS_PROVIDER must be "transformers" or "hashing"');
  }
  if (!['weighted', 'rrf'].includes(cfg.assistant.fusion)) problems.push('ASSISTANT_FUSION must be "weighted" or "rrf"');
  if (!(cfg.assistant.keywordWeight >= 0 && cfg.assistant.keywordWeight <= 1)) {
    problems.push('ASSISTANT_KEYWORD_WEIGHT must be between 0 and 1');
  }
  if (!isPositiveInt(cfg.assistant.rrfK)) problems.push('ASSISTANT_RRF_K must be a positive integer');
  for (const key of ['minSimilarityModel', 'minSimilarityHashing']) {
    if (!(cfg.assistant[key] >= -1 && cfg.assistant[key] <= 1)) problems.push(`Assistant setting ${key} must be between -1 and 1`);
  }
  if (!(cfg.assistant.relativeCutoff >= 0 && cfg.assistant.relativeCutoff <= 1)) {
    problems.push('ASSISTANT_RELATIVE_CUTOFF must be between 0 and 1');
  }
  if (!isPositiveInt(cfg.assistant.topK) || cfg.assistant.topK > 20) problems.push('ASSISTANT_TOP_K must be between 1 and 20');
  if (!isPositiveInt(cfg.assistant.maxRecords)) problems.push('ASSISTANT_MAX_RECORDS must be a positive integer');

  if (problems.length) {
    const error = new Error(`Invalid configuration:\n - ${problems.join('\n - ')}\nSee backend/.env.example (or run "npm run setup:env").`);
    error.code = 'INVALID_CONFIG';
    error.problems = problems;
    throw error;
  }
  return warnings;
}

module.exports = config;
module.exports.assertConfig = assertConfig;
module.exports.MIN_SECRET_LENGTH = MIN_SECRET_LENGTH;
