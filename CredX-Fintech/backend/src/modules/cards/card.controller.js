const { Op } = require('sequelize');
const Card = require('./card.model');
const User = require('../users/user.model');
const Wallet = require('../wallet/wallet.model');
const CardTransaction = require('./cardTransaction.model');
const generateCardNumber = require('../../utils/cardGenerator');
const { generateCVV, generateExpiry, maskCard } = require('../../utils/cardDetailsGenerator');
const { sequelize } = require("../../config/db");

exports.getSpendingAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await sequelize.query(
      `
      SELECT 
        DATE_FORMAT(ct.createdAt, '%Y-%m') AS month,
        SUM(ct.amount) AS totalSpent,
        COUNT(ct.id) AS totalTransactions,
        AVG(ct.amount) AS avgTransaction,
        SUM(CASE WHEN ct.isFraud = true THEN 1 ELSE 0 END) AS fraudCount
      FROM CardTransactions ct
      INNER JOIN Cards c ON ct.cardId = c.id
      WHERE c.userId = :userId
      GROUP BY month
      ORDER BY month ASC
      `,
      {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json(result);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getCategoryAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await sequelize.query(
      `
      SELECT 
        ct.merchant,
        SUM(ct.amount) AS totalSpent
      FROM CardTransactions ct
      INNER JOIN Cards c ON ct.cardId = c.id
      WHERE c.userId = :userId
      GROUP BY ct.merchant
      ORDER BY totalSpent DESC
      `,
      {
        replacements: { userId },
        type: sequelize.QueryTypes.SELECT
      }
    );

    res.json(result);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ================= CREATE CARD =================
// ================= CREATE CARD =================
exports.createCard = async (req, res) => {
  try {
    const { type, cardNumber, cvv, expiryDate, name } = req.body;
    const userId = req.user.id;

    if (!cardNumber || !cvv || !expiryDate || !name) {
      return res.status(400).json({
        message: "All card details are required"
      });
    }

    if (cardNumber.length !== 16) {
      return res.status(400).json({
        message: "Invalid card number"
      });
    }

    if (cvv.length < 3 || cvv.length > 4) {
      return res.status(400).json({
        message: "Invalid CVV"
      });
    }

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    let creditLimit = 0;

    // ✅ FIXED LOGIC — NO DENIAL
    if (type === 'credit') {
      // Credit limit depends on score but does NOT deny
      if (user.credit_score >= 750) {
        creditLimit = 200000;
      } else if (user.credit_score >= 650) {
        creditLimit = 100000;
      } else if (user.credit_score >= 550) {
        creditLimit = 50000;
      } else {
        creditLimit = 25000; // low score still gets card
      }
    }

    const card = await Card.create({
      userId,
      cardNumber,
      maskedNumber: maskCard(cardNumber),
      cvv,
      expiryDate,
      cardHolderName: name,
      cardType: type,
      creditLimit,
      availableCredit: creditLimit,
      outstandingBalance: 0,
      minimumDue: 0,
      status: "active"
    });

    res.json({
      message: "Card created successfully",
      card
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ================= SPEND (WITH FRAUD ENGINE) =================
exports.spend = async (req, res) => {
  try {
    const { cardId, amount } = req.body;
    const userId = req.user.id;

    const card = await Card.findOne({ where: { id: cardId, userId } });
    if (!card) return res.status(404).json({ message: "Card not found" });

    if (card.status !== 'active') {
      return res.status(400).json({ message: "Card is frozen" });
    }

    // Debit Logic
    if (card.cardType === 'debit') {
      const wallet = await Wallet.findOne({ where: { userId } });
      if (wallet.balance < amount) {
        return res.status(400).json({ message: "Insufficient wallet balance" });
      }
      wallet.balance -= amount;
      await wallet.save();
    }

    // Credit Logic
    if (card.cardType === 'credit') {
      if (card.availableCredit < amount) {
        return res.status(400).json({ message: "Credit limit exceeded" });
      }
      card.availableCredit -= amount;
      card.outstandingBalance += amount;
      card.minimumDue = parseFloat((card.outstandingBalance * 0.05).toFixed(2));
      await card.save();
    }

    // ================= FRAUD DETECTION =================
    const recentTransactions = await CardTransaction.findAll({
      where: { cardId },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const avgSpend = recentTransactions.length
      ? recentTransactions.reduce((sum, t) => sum + t.amount, 0) /
        recentTransactions.length
      : amount;

    let fraudScore = 0;

    if (amount > avgSpend * 3) fraudScore += 0.4;
    if (amount > 5000) fraudScore += 0.3;

    const oneMinuteAgo = new Date(Date.now() - 60000);
    const rapidTx = await CardTransaction.count({
      where: {
        cardId,
        createdAt: { [Op.gt]: oneMinuteAgo }
      }
    });

    if (rapidTx > 5) fraudScore += 0.4;

    const isFraud = fraudScore > 0.7;

    if (isFraud) {
      card.status = 'frozen';
      await card.save();
    }

    await CardTransaction.create({
      cardId,
      amount,
      merchant: "Simulated Merchant",
      fraudScore,
      isFraud
    });

    res.json({
      message: "Transaction successful",
      fraudScore,
      isFraud
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// ================= PAY CREDIT BILL =================
exports.payCreditBill = async (req, res) => {
  try {
    const { cardId, amount } = req.body;

    const card = await Card.findOne({
      where: { id: cardId, userId: req.user.id }
    });

    if (!card) {
      return res.status(404).json({ message: "Credit card not found" });
    }

    if (card.cardType !== 'credit') {
      return res.status(400).json({ message: "Not a credit card" });
    }

    card.availableCredit += amount;

    if (card.availableCredit > card.creditLimit) {
      card.availableCredit = card.creditLimit;
    }

    await card.save();

    res.json({ message: "Bill paid successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ================= GET USER CARDS =================
exports.getUserCards = async (req, res) => {
  try {
    const cards = await Card.findAll({
      where: { userId: req.user.id },
      attributes: {
        exclude: ['cardNumber', 'cvv']
      }
    });

    res.json(cards);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ================= GET USER CARDS =================
exports.getUserCards = async (req, res) => {
  try {
    const cards = await Card.findAll({
      where: { userId: req.user.id },
      attributes: { exclude: ['cardNumber', 'cvv'] }
    });

    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ================= TOGGLE FREEZE =================
exports.toggleFreeze = async (req, res) => {
  try {
    const { cardId } = req.body;

    const card = await Card.findOne({
      where: { id: cardId, userId: req.user.id }
    });

    if (!card) return res.status(404).json({ message: "Card not found" });

    card.status = card.status === "active" ? "frozen" : "active";
    await card.save();

    res.json({ status: card.status });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ================= SIMULATE TRANSACTIONS =================
exports.simulateTransactions = async (req, res) => {
  try {
    const { cardId, count } = req.body;

    const merchants = ["Amazon", "Uber", "Netflix", "Apple", "Walmart"];

    for (let i = 0; i < count; i++) {
      await CardTransaction.create({
        cardId,
        amount: Math.floor(Math.random() * 1000) + 100,
        merchant: merchants[Math.floor(Math.random() * merchants.length)],
        fraudScore: 0,
        isFraud: false
      });
    }

    res.json({ message: "Simulation complete" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCardTransactions = async (req, res) => {
  try {
    const { cardId } = req.params;

    const transactions = await CardTransaction.findAll({
      where: { cardId },
      order: [['createdAt', 'DESC']]
    });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// ================= DELETE CARD =================
exports.deleteCard = async (req, res) => {
  try {
    const { cardId } = req.params;

    const card = await Card.findOne({
      where: { id: cardId, userId: req.user.id }
    });

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    await card.destroy();

    res.json({ message: "Card deleted successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getUserSpendings = async (req, res) => {
  try {
    const transactions = await CardTransaction.findAll({
      include: {
        model: Card,
        where: { userId: req.user.id }
      },
      order: [['createdAt', 'DESC']]
    });

    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);

    res.json({
      totalSpent,
      transactions
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
exports.getUserSpendings = async (req, res) => {
  try {

    const cards = await Card.findAll({
      where: { userId: req.user.id },
      attributes: ["id"]
    });

    const cardIds = cards.map(c => c.id);

    const transactions = await CardTransaction.findAll({
      where: { cardId: cardIds },
      order: [['createdAt', 'DESC']]
    });

    const totalSpent = transactions.reduce(
      (sum, t) => sum + Number(t.amount),
      0
    );

    res.json({
      totalSpent,
      transactions
    });

  } catch (error) {
    console.error("Spendings Error:", error);
    res.status(500).json({ error: error.message });
  }
};
exports.getCardById = async (req, res) => {
  try {
    const card = await Card.findOne({
      where: {
        id: req.params.id,
        userId: req.user.id
      }
    });

    if (!card) {
      return res.status(404).json({ message: "Card not found" });
    }

    res.json(card);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};