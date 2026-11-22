/**
 * Rule-based fraud scoring for card spends (pure function, unit-tested).
 *
 * Rules (points out of 100):
 *  - amount is more than 3x the card's recent average spend  +40
 *  - amount is above the high-value threshold                 +30
 *  - more than 5 transactions on the card in the last minute  +40
 *
 * A score of 70 or more is treated as fraud. Integer points are used so the
 * threshold comparison is exact (0.4 + 0.3 in floating point is 0.7000000000000001).
 */
const DEFAULT_RULES = {
  spikeMultiplier: 3,
  highValueThreshold: 5000,
  rapidCount: 5,
  fraudThreshold: 70,
};

function evaluateTransaction({ amount, recentAmounts = [], recentCountLastMinute = 0 }, rules = DEFAULT_RULES) {
  const value = Number(amount);
  const history = recentAmounts.map(Number).filter(Number.isFinite);
  const average = history.length ? history.reduce((sum, a) => sum + a, 0) / history.length : value;

  let points = 0;
  const reasons = [];

  if (value > average * rules.spikeMultiplier) {
    points += 40;
    reasons.push(`Amount is more than ${rules.spikeMultiplier}x the recent average`);
  }
  if (value > rules.highValueThreshold) {
    points += 30;
    reasons.push('High-value transaction');
  }
  if (recentCountLastMinute > rules.rapidCount) {
    points += 40;
    reasons.push('Rapid successive transactions');
  }

  const capped = Math.min(points, 100);
  return {
    score: capped / 100,
    isFraud: capped >= rules.fraudThreshold,
    reasons,
  };
}

module.exports = { evaluateTransaction, DEFAULT_RULES };
