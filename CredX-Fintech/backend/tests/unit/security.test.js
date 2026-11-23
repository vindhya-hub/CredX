const crypto = require('crypto');
const config = require('../../src/config/config');
const { assertConfig } = require('../../src/config/config');
const { luhnCheck, detectBrand, maskPan, lastFour, fingerprint, isExpiryValid, digitsOnly } = require('../../src/utils/cardUtils');
const generateCardNumber = require('../../src/utils/cardGenerator');
const { redact } = require('../../src/utils/logger');
const { TEST_CARDS } = require('../helpers/setup');

const secret = () => crypto.randomBytes(48).toString('hex');

/** A valid production-like config built from the loaded test config. */
const validConfig = (overrides = {}) => {
  const cfg = JSON.parse(JSON.stringify(config));
  cfg.isTest = false;
  cfg.isProd = true;
  cfg.jwt.accessSecret = secret();
  cfg.jwt.refreshSecret = secret();
  cfg.db = { ...cfg.db, dialect: 'postgres', url: undefined, host: 'db.internal', name: 'credx', user: 'credx', password: secret() };
  cfg.bcryptRounds = 12;
  cfg.cors.origins = ['https://credx.example.com'];
  return Object.assign(cfg, overrides);
};

describe('assertConfig', () => {
  test('accepts a complete configuration', () => {
    expect(assertConfig(validConfig())).toEqual([]);
  });

  test('requires both JWT secrets', () => {
    const cfg = validConfig();
    cfg.jwt.accessSecret = undefined;
    cfg.jwt.refreshSecret = undefined;
    expect(() => assertConfig(cfg)).toThrow(/JWT_SECRET is required[\s\S]*JWT_REFRESH_SECRET is required/);
  });

  test('rejects short secrets in every environment', () => {
    for (const env of [{ isProd: true }, { isProd: false }]) {
      const cfg = validConfig(env);
      cfg.jwt.accessSecret = 'too-short';
      expect(() => assertConfig(cfg)).toThrow(/JWT_SECRET must be at least 32 characters/);
    }
  });

  test('rejects identical access and refresh secrets', () => {
    const cfg = validConfig();
    cfg.jwt.refreshSecret = cfg.jwt.accessSecret;
    expect(() => assertConfig(cfg)).toThrow(/must be different/);
  });

  test('requires database credentials from the environment (no default password)', () => {
    const cfg = validConfig();
    cfg.db.password = undefined;
    cfg.db.host = undefined;
    expect(() => assertConfig(cfg)).toThrow(/DB_HOST is required[\s\S]*DB_PASSWORD is required/);
    cfg.db.url = `postgres://credx:${secret()}@db:5432/credx`;
    expect(() => assertConfig(cfg)).not.toThrow();
  });

  test('validates tunables', () => {
    expect(() => assertConfig(validConfig({ bcryptRounds: 8 }))).toThrow(/BCRYPT_ROUNDS/);
    const weights = validConfig();
    weights.assistant.keywordWeight = 1.5;
    expect(() => assertConfig(weights)).toThrow(/ASSISTANT_KEYWORD_WEIGHT/);
    const limits = validConfig();
    limits.rateLimit.authMax = 0;
    expect(() => assertConfig(limits)).toThrow(/authMax/);
  });

  test('sqlite is refused outside the test suite', () => {
    const cfg = validConfig();
    cfg.db.dialect = 'sqlite';
    expect(() => assertConfig(cfg)).toThrow(/only supported for the test suite/);
  });

  test('error messages never contain secret values', () => {
    const cfg = validConfig();
    cfg.jwt.accessSecret = 'short-but-secret-value';
    try {
      assertConfig(cfg);
    } catch (error) {
      expect(error.message).not.toContain('short-but-secret-value');
      expect(error.code).toBe('INVALID_CONFIG');
    }
  });

  test('the test environment itself generated strong random secrets', () => {
    expect(process.env.JWT_SECRET).toMatch(/^[0-9a-f]{96}$/);
    expect(process.env.JWT_SECRET).not.toBe(process.env.JWT_REFRESH_SECRET);
  });
});

describe('card utilities (no full card numbers are ever stored)', () => {
  test('Luhn checksum', () => {
    expect(luhnCheck(TEST_CARDS.visa)).toBe(true);
    expect(luhnCheck(TEST_CARDS.amex)).toBe(true);
    expect(luhnCheck('4242424242424241')).toBe(false);
    expect(luhnCheck('123')).toBe(false);
    expect(luhnCheck(generateCardNumber('5'))).toBe(true);
  });

  test('brand detection', () => {
    expect(detectBrand(TEST_CARDS.visa)).toBe('VISA');
    expect(detectBrand(TEST_CARDS.mastercard)).toBe('MASTERCARD');
    expect(detectBrand('2221000000000009')).toBe('MASTERCARD');
    expect(detectBrand(TEST_CARDS.amex)).toBe('AMEX');
    expect(detectBrand('6011111111111117')).toBe('DISCOVER');
    expect(detectBrand('9999')).toBe('CARD');
  });

  test('masking reveals only the last four digits', () => {
    expect(maskPan('4242 4242 4242 4242')).toBe('**** **** **** 4242');
    expect(lastFour(TEST_CARDS.amex)).toBe('0005');
    expect(digitsOnly('4242-4242')).toBe('42424242');
  });

  test('fingerprints are keyed, deterministic and do not contain the number', () => {
    const a = fingerprint(TEST_CARDS.visa);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprint('4242 4242 4242 4242')).toBe(a);
    expect(a).not.toContain('4242424242');
    expect(fingerprint(TEST_CARDS.mastercard)).not.toBe(a);
    const unkeyed = crypto.createHash('sha256').update(TEST_CARDS.visa).digest('hex');
    expect(a).not.toBe(unkeyed);
  });

  test('expiry is valid through the end of the expiry month', () => {
    const now = new Date('2026-11-22T00:00:00Z');
    expect(isExpiryValid('11/26', now)).toBe(true);
    expect(isExpiryValid('10/26', now)).toBe(false);
    expect(isExpiryValid('13/30', now)).toBe(false);
    expect(isExpiryValid('garbage', now)).toBe(false);
  });
});

describe('logger redaction', () => {
  test('removes credentials and card data at any depth', () => {
    const out = redact({
      email: 'a@example.com',
      password: 'x',
      nested: { refreshToken: 'y', cardNumber: '4242', cvv: '123', items: [{ apiKey: 'z' }] },
      headers: { authorization: 'Bearer abc' },
    });
    expect(out).toEqual({
      email: 'a@example.com',
      password: '[REDACTED]',
      nested: { refreshToken: '[REDACTED]', cardNumber: '[REDACTED]', cvv: '[REDACTED]', items: [{ apiKey: '[REDACTED]' }] },
      headers: { authorization: '[REDACTED]' },
    });
  });

  test('errors are reduced to safe fields', () => {
    const error = Object.assign(new Error('boom'), { sql: 'SELECT secret', code: 'E1' });
    const out = redact({ error });
    expect(out.error).toEqual(expect.objectContaining({ name: 'Error', message: 'boom', code: 'E1' }));
    expect(out.error.sql).toBeUndefined();
  });
});
