const { Op, fn, col } = require('sequelize');
const { toNumber } = require('./money');

const BASE_SCORE = 600;
const MIN_SCORE = 300;
const MAX_SCORE = 850;

/**
 * Pure scoring rules (unit-tested). Inputs:
 *  - totalVolume:   total amount the user has sent from their wallet
 *  - highFraudCount: outgoing transactions with fraud_score > 0.5
 *  - walletBalance: current wallet balance
 */
function computeCreditScore({ totalVolume = 0, highFraudCount = 0, walletBalance = 0 } = {}) {
  let score = BASE_SCORE;

  // Transaction volume factor
  if (totalVolume > 10000) score += 50;
  if (totalVolume > 50000) score += 100;

  // Fraud penalty
  score -= Math.max(0, highFraudCount) * 20;

  // Wallet balance stability
  if (walletBalance > 5000) score += 50;
  if (walletBalance < 100) score -= 30;

  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(score)));
}

/**
 * Loads the inputs with two aggregate queries (instead of fetching every
 * transaction row) and returns the score. Pass `transaction` to read inside
 * an open Sequelize transaction.
 */
async function calculateCreditScore(userId, { transaction } = {}) {
  // Required lazily to avoid a require cycle (models -> utils -> models).
  const Transaction = require('../modules/transactions/transaction.model');
  const Wallet = require('../modules/wallet/wallet.model');

  const [volumeRow, highFraudCount, wallet] = await Promise.all([
    Transaction.findOne({
      attributes: [[fn('SUM', col('amount')), 'total']],
      where: { senderId: userId },
      raw: true,
      transaction,
    }),
    Transaction.count({ where: { senderId: userId, fraud_score: { [Op.gt]: 0.5 } }, transaction }),
    Wallet.findOne({ where: { userId }, transaction }),
  ]);

  return computeCreditScore({
    totalVolume: toNumber(volumeRow && volumeRow.total),
    highFraudCount,
    walletBalance: wallet ? toNumber(wallet.balance) : 0,
  });
}

module.exports = calculateCreditScore;
module.exports.computeCreditScore = computeCreditScore;
module.exports.calculateCreditScore = calculateCreditScore;
