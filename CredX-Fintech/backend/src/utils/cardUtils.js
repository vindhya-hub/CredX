/**
 * Card-number helpers used to avoid ever persisting a full PAN.
 *
 * Stored per card: brand, last 4 digits, a masked display string and a keyed
 * HMAC "fingerprint" (to detect the same card being added twice). The full
 * number and the CVV are validated in memory and then discarded.
 */
const crypto = require('crypto');
const config = require('../config/config');

const digitsOnly = (value) => String(value ?? '').replace(/\D/g, '');

/** Luhn (mod 10) checksum used by all major card networks. */
function luhnCheck(number) {
  const digits = digitsOnly(number);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Computes the Luhn check digit for a partial number (without the check digit). */
function luhnCheckDigit(partial) {
  const digits = digitsOnly(partial);
  let sum = 0;
  let double = true;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return String((10 - (sum % 10)) % 10);
}

function detectBrand(number) {
  const digits = digitsOnly(number);
  if (/^4/.test(digits)) return 'VISA';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(digits)) return 'MASTERCARD';
  if (/^3[47]/.test(digits)) return 'AMEX';
  if (/^(6011|64[4-9]|65)/.test(digits)) return 'DISCOVER';
  if (/^(60|81|82|508)/.test(digits)) return 'RUPAY';
  return 'CARD';
}

const lastFour = (number) => digitsOnly(number).slice(-4);

/** Display mask that only reveals the last four digits. */
const maskPan = (number) => `**** **** **** ${lastFour(number)}`;

/**
 * HMAC key for card fingerprints: CARD_FINGERPRINT_SECRET, or a key derived
 * from JWT_SECRET when no dedicated secret is configured. There is no
 * hardcoded fallback: without either secret this throws.
 */
function fingerprintKey() {
  if (config.cardFingerprintSecret) return config.cardFingerprintSecret;
  if (!config.jwt.accessSecret) {
    throw new Error('CARD_FINGERPRINT_SECRET or JWT_SECRET must be configured to fingerprint cards');
  }
  return crypto.createHmac('sha256', config.jwt.accessSecret).update('credx:card-fingerprint:v1').digest('hex');
}

/** Keyed hash of the PAN: lets us detect duplicates without being reversible. */
const fingerprint = (number) => crypto.createHmac('sha256', fingerprintKey()).update(digitsOnly(number)).digest('hex');

/** "MM/YY" expiry is valid through the last day of that month. */
function isExpiryValid(expiry, now = new Date()) {
  const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(String(expiry ?? '').trim());
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  const endOfExpiryMonth = Date.UTC(year, month, 1); // first instant after the expiry month
  return endOfExpiryMonth > now.getTime();
}

module.exports = {
  digitsOnly,
  luhnCheck,
  luhnCheckDigit,
  detectBrand,
  lastFour,
  maskPan,
  fingerprint,
  isExpiryValid,
};
