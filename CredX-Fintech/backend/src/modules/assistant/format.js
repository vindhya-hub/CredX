/**
 * Display formatting for assistant answers and documents. Dates are shown in
 * the user's local time using the offset sent by the client.
 */
const { round2 } = require('../../utils/money');

const CATEGORY_LABELS = {
  food: 'food & dining',
  groceries: 'groceries',
  shopping: 'shopping',
  transport: 'transport',
  travel: 'travel',
  entertainment: 'entertainment',
  utilities: 'utilities & bills',
  health: 'health',
  electronics: 'electronics',
  fuel: 'fuel',
  education: 'education',
  wallet_topup: 'wallet top-ups',
  other: 'other',
};

/**
 * @param {{ currency?: string, locale?: string, utcOffsetMinutes?: number }} options
 *   utcOffsetMinutes: local time minus UTC (e.g. +330 for India).
 */
function createFormatter({ currency = 'INR', locale = 'en-IN', utcOffsetMinutes = 0 } = {}) {
  let moneyFormat;
  try {
    moneyFormat = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  } catch {
    moneyFormat = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 });
  }

  const shift = (value) => new Date(new Date(value).getTime() + utcOffsetMinutes * 60000);

  return {
    currency,
    locale,
    utcOffsetMinutes,
    money: (amount) => moneyFormat.format(round2(amount)),
    date: (value) =>
      value ? shift(value).toLocaleDateString(locale, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }) : 'unknown date',
    monthYear: (value) => shift(value).toLocaleDateString(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' }),
    category: (category) => CATEGORY_LABELS[category] || category || 'other',
  };
}

module.exports = { createFormatter, CATEGORY_LABELS };
