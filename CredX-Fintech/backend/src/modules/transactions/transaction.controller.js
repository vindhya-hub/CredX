const { Op } = require('sequelize');
const { sequelize } = require('../../config/db');
const Wallet = require('../wallet/wallet.model');
const Transaction = require('./transaction.model');
const User = require('../users/user.model');
const calculateCreditScore = require('../../utils/creditScore');


// =====================================
// 💸 TRANSFER FUNCTION (FULL VERSION)
// =====================================
exports.transfer = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { receiverEmail, amount } = req.body;
    const senderId = req.user.id;

    // ============================
    // ✅ INPUT VALIDATION
    // ============================
    if (!receiverEmail || !amount) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    if (amount <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    // ============================
    // 🛑 DAILY LIMIT CHECK
    // ============================
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dailyTransactions = await Transaction.findAll({
      where: {
        senderId: senderId,
        createdAt: {
          [Op.gte]: today
        }
      }
    });

    const dailyTotal = dailyTransactions.reduce(
      (sum, tx) => sum + tx.amount,
      0
    );

    const MAX_DAILY_AMOUNT = 5000;
    const MAX_DAILY_COUNT = 5;

    if (dailyTotal + amount > MAX_DAILY_AMOUNT) {
      return res.status(400).json({
        message: "Daily transfer amount limit exceeded"
      });
    }

    if (dailyTransactions.length >= MAX_DAILY_COUNT) {
      return res.status(400).json({
        message: "Daily transfer count limit exceeded"
      });
    }

    // ============================
    // 👤 FETCH SENDER WALLET
    // ============================
    const senderWallet = await Wallet.findOne({
      where: { userId: senderId },
      transaction: t
    });

    if (!senderWallet) {
      return res.status(404).json({ message: "Sender wallet not found" });
    }

    // ============================
    // 👤 FETCH RECEIVER
    // ============================
    const receiverUser = await User.findOne({
      where: { email: receiverEmail }
    });

    if (!receiverUser) {
      return res.status(404).json({ message: "Receiver not found" });
    }

    const receiverWallet = await Wallet.findOne({
      where: { userId: receiverUser.id },
      transaction: t
    });

    if (!receiverWallet) {
      return res.status(404).json({ message: "Receiver wallet not found" });
    }

    // ============================
    // 💰 BALANCE CHECK
    // ============================
    if (senderWallet.balance < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }

    // ============================
    // 🧠 BASIC FRAUD LOGIC
    // ============================
    const fraudScore = amount > 10000 ? 0.8 : 0.1;

    // ============================
    // 🔄 UPDATE BALANCES
    // ============================
    senderWallet.balance -= amount;
    await senderWallet.save({ transaction: t });

    receiverWallet.balance += amount;
    await receiverWallet.save({ transaction: t });

    // ============================
    // 📝 RECORD TRANSACTION
    // ============================
    await Transaction.create({
      senderId: senderId,
      receiverId: receiverUser.id,
      amount,
      fraud_score: fraudScore,
      status: "completed",
      type: "transfer"
    }, { transaction: t });

    // ============================
    // 🤖 RECALCULATE CREDIT SCORE
    // ============================
    const newScore = await calculateCreditScore(senderId);

    const user = await User.findByPk(senderId);
    user.credit_score = newScore;
    await user.save({ transaction: t });

    await t.commit();

    res.json({
      message: "Transfer successful",
      fraudScore,
      newCreditScore: newScore
    });

  } catch (error) {
    await t.rollback();
    res.status(500).json({ error: error.message });
  }
};


// =====================================
// 📜 TRANSACTION HISTORY
// =====================================
exports.getHistory = async (req, res) => {
  try {
    const userId = req.user.id;

    const transactions = await Transaction.findAll({
      where: {
        [Op.or]: [
          { senderId: userId },
          { receiverId: userId }
        ]
      },
      order: [['createdAt', 'DESC']]
    });

    res.json(transactions);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};