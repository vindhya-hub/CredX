const crypto = require('crypto');
const { maskPan } = require('./cardUtils');

/** Random 3-digit CVV (demo data only; CVVs are never persisted). */
function generateCVV() {
  return String(crypto.randomInt(0, 1000)).padStart(3, '0');
}

/** Expiry five years from now in "MM/YY" format. */
function generateExpiry(now = new Date()) {
  const year = now.getUTCFullYear() + 5;
  const month = String(crypto.randomInt(1, 13)).padStart(2, '0');
  return `${month}/${String(year).slice(-2)}`;
}

/** Kept for backwards compatibility; masks everything except the last 4 digits. */
const maskCard = (number) => maskPan(number);

module.exports = { generateCVV, generateExpiry, maskCard };
