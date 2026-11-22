/**
 * Equated monthly instalment for a fully-amortising loan:
 *
 *   EMI = P * r * (1 + r)^n / ((1 + r)^n - 1),  r = annualRate / 12 / 100
 *
 * A 0% rate degenerates to P / n (the formula above would divide by zero).
 * The result is rounded to 2 decimal places.
 */
function calculateEMI(principal, annualRate, tenureMonths) {
  const P = Number(principal);
  const rate = Number(annualRate);
  const n = Number(tenureMonths);

  if (!Number.isFinite(P) || P <= 0) throw new RangeError('principal must be a positive number');
  if (!Number.isFinite(rate) || rate < 0) throw new RangeError('annualRate must be zero or positive');
  if (!Number.isInteger(n) || n <= 0) throw new RangeError('tenureMonths must be a positive integer');

  if (rate === 0) return Math.round((P / n) * 100) / 100;

  const r = rate / 12 / 100;
  const growth = (1 + r) ** n;
  const emi = (P * r * growth) / (growth - 1);
  return Math.round(emi * 100) / 100;
}

module.exports = calculateEMI;
