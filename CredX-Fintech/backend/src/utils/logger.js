/**
 * Minimal leveled logger with secret redaction.
 *
 * - Never logs request bodies; callers pass small metadata objects.
 * - Any key that looks like a credential or card data is replaced with
 *   "[REDACTED]" before it is written, at any nesting depth.
 * - JSON lines in production (easy to ship to a log pipeline), readable
 *   single lines elsewhere.
 */
const config = require('../config/config');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };
const SENSITIVE_KEY = /pass(word)?|secret|token|authorization|cookie|cvv|cvc|card_?number|\bpan\b|fingerprint|api_?key/i;

function redact(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 6) return '[Truncated]';
  if (value instanceof Error) {
    return { name: value.name, message: value.message, code: value.code, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEY.test(key) ? '[REDACTED]' : redact(val, depth + 1);
    }
    return out;
  }
  return value;
}

function threshold() {
  return LEVELS[config.logLevel] ?? LEVELS.info;
}

function write(level, message, meta) {
  if (LEVELS[level] < threshold()) return;
  const safeMeta = meta === undefined ? undefined : redact(meta);
  const stream = level === 'error' || level === 'warn' ? process.stderr : process.stdout;

  if (config.isProd) {
    stream.write(`${JSON.stringify({ time: new Date().toISOString(), level, message, ...(safeMeta && { meta: safeMeta }) })}\n`);
    return;
  }
  const suffix = safeMeta === undefined ? '' : ` ${JSON.stringify(safeMeta)}`;
  stream.write(`[${new Date().toISOString()}] ${level.toUpperCase()} ${message}${suffix}\n`);
}

module.exports = {
  debug: (message, meta) => write('debug', message, meta),
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  redact,
};
