/**
 * Money helpers. Balances are stored as DECIMAL(14,2); Postgres returns
 * DECIMAL as strings, so everything goes through toNumber/round2 before
 * arithmetic to avoid string concatenation and binary floating-point drift.
 */
const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const round2 = (value) => Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;

/** Model attribute getter that always yields a JS number (or null). */
const decimalGetter = (field) =>
  function get() {
    const raw = this.getDataValue(field);
    return raw === null || raw === undefined ? raw : Number(raw);
  };

module.exports = { toNumber, round2, decimalGetter };
