const crypto = require('crypto');
const { luhnCheckDigit } = require('./cardUtils');

/**
 * Generates a random, Luhn-valid 16-digit card number for demo/seed data.
 * Uses a cryptographically secure RNG.
 *
 * @param {string} prefix issuer prefix (e.g. "4" for Visa-style, "5" for Mastercard-style)
 */
function generateCardNumber(prefix = '4') {
  let number = String(prefix);
  while (number.length < 15) {
    number += crypto.randomInt(0, 10);
  }
  return number + luhnCheckDigit(number);
}

module.exports = generateCardNumber;
