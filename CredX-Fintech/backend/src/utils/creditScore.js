const Transaction = require('../modules/transactions/transaction.model');
const Wallet = require('../modules/wallet/wallet.model');

async function calculateCreditScore(userId) {
  const transactions = await Transaction.findAll({
    where: { senderId: userId }
  });

  const wallet = await Wallet.findOne({
    where: { userId }
  });

  let score = 600; // Base score

  // 📊 Transaction volume factor
  const totalVolume = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  if (totalVolume > 10000) score += 50;
  if (totalVolume > 50000) score += 100;

  // 🚨 Fraud penalty
  const highFraudTx = transactions.filter(tx => tx.fraud_score > 0.5);

  if (highFraudTx.length > 0) {
    score -= highFraudTx.length * 20;
  }

  // 💰 Wallet balance stability
  if (wallet.balance > 5000) score += 50;
  if (wallet.balance < 100) score -= 30;

  // Cap score range
  if (score > 850) score = 850;
  if (score < 300) score = 300;

  return score;
}

module.exports = calculateCreditScore;