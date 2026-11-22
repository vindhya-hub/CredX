const calculateEMI = require('../../src/utils/emiCalculator');
const { computeCreditScore } = require('../../src/utils/creditScore');
const { evaluateTransaction } = require('../../src/utils/fraudEngine');
const { creditLimitFor, loanPricingFor } = require('../../src/utils/creditPolicy');
const { round2, toNumber } = require('../../src/utils/money');

describe('calculateEMI', () => {
  test('matches the standard amortisation formula', () => {
    // 1,00,000 at 12% p.a. for 12 months
    expect(calculateEMI(100000, 12, 12)).toBe(8884.88);
    // 50,000 at 8% p.a. for 24 months
    expect(calculateEMI(50000, 8, 24)).toBe(2261.36);
  });

  test('total repaid exceeds the principal by the interest', () => {
    const emi = calculateEMI(100000, 12, 12);
    expect(emi * 12).toBeGreaterThan(100000);
    expect(emi * 12).toBeCloseTo(106618.56, 1);
  });

  test('zero interest divides the principal evenly', () => {
    expect(calculateEMI(1200, 0, 12)).toBe(100);
  });

  test('accepts numeric strings and rejects invalid input', () => {
    expect(calculateEMI('100000', '12', '12')).toBe(8884.88);
    expect(() => calculateEMI(0, 12, 12)).toThrow(RangeError);
    expect(() => calculateEMI(1000, -1, 12)).toThrow(RangeError);
    expect(() => calculateEMI(1000, 12, 0)).toThrow(RangeError);
    expect(() => calculateEMI(1000, 12, 1.5)).toThrow(RangeError);
  });
});

describe('computeCreditScore', () => {
  test('starts from the base score of 600', () => {
    expect(computeCreditScore({ walletBalance: 1000 })).toBe(600);
  });

  test('rewards transaction volume and wallet stability', () => {
    expect(computeCreditScore({ totalVolume: 20000, walletBalance: 1000 })).toBe(650);
    expect(computeCreditScore({ totalVolume: 60000, walletBalance: 1000 })).toBe(750);
    expect(computeCreditScore({ totalVolume: 60000, walletBalance: 6000 })).toBe(800);
  });

  test('penalises high-fraud transactions and low balances', () => {
    expect(computeCreditScore({ highFraudCount: 2, walletBalance: 1000 })).toBe(560);
    expect(computeCreditScore({ walletBalance: 50 })).toBe(570);
  });

  test('is clamped to 300-850', () => {
    expect(computeCreditScore({ highFraudCount: 100 })).toBe(300);
    expect(computeCreditScore({ totalVolume: 1e9, walletBalance: 1e9 })).toBe(800);
    expect(computeCreditScore({ totalVolume: 1e9, walletBalance: 1e9 })).toBeLessThanOrEqual(850);
  });
});

describe('evaluateTransaction (fraud rules)', () => {
  test('normal purchases pass', () => {
    const v = evaluateTransaction({ amount: 500, recentAmounts: [400, 600, 500], recentCountLastMinute: 0 });
    expect(v).toEqual({ score: 0, isFraud: false, reasons: [] });
  });

  test('spike + high value reaches the threshold exactly (integer points, no float drift)', () => {
    const v = evaluateTransaction({ amount: 6000, recentAmounts: [1000, 1000], recentCountLastMinute: 0 });
    expect(v.score).toBe(0.7);
    expect(v.isFraud).toBe(true);
    expect(v.reasons).toHaveLength(2);
  });

  test('rapid successive transactions add risk', () => {
    const v = evaluateTransaction({ amount: 100, recentAmounts: [100], recentCountLastMinute: 6 });
    expect(v.score).toBe(0.4);
    expect(v.isFraud).toBe(false);
  });

  test('first purchase on a card is compared with itself', () => {
    expect(evaluateTransaction({ amount: 3000 }).isFraud).toBe(false);
    expect(evaluateTransaction({ amount: 9000 }).score).toBe(0.3); // high value only
  });
});

describe('credit policy and money helpers', () => {
  test('credit limits and loan pricing by score', () => {
    expect(creditLimitFor(800)).toBe(200000);
    expect(creditLimitFor(700)).toBe(100000);
    expect(creditLimitFor(560)).toBe(50000);
    expect(creditLimitFor(400)).toBe(25000);
    expect(loanPricingFor(760)).toEqual({ interestRate: 8 });
    expect(loanPricingFor(650)).toEqual({ interestRate: 12 });
    expect(loanPricingFor(649)).toBeNull();
  });

  test('round2 avoids binary floating point surprises', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2('10.005')).toBe(10.01);
    expect(toNumber('12.50')).toBe(12.5);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('abc')).toBe(0);
  });
});
