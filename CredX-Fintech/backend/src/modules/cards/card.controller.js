const { Op, fn, col, literal } = require('sequelize');
const AppError = require('../../utils/AppError');
const { round2, toNumber } = require('../../utils/money');
const { evaluateTransaction } = require('../../utils/fraudEngine');
const { categorizeMerchant } = require('../../utils/categorizer');
const { maskPan, lastFour, detectBrand, fingerprint } = require('../../utils/cardUtils');
const { sequelize, User, Card, CardTransaction } = require('../../models');
const { creditLimitFor } = require('../../utils/creditPolicy');
const walletService = require('../wallet/wallet.service');

/** Ids of the cards owned by the user (every card query is scoped through this). */
async function ownedCardIds(userId) {
  const cards = await Card.findAll({ where: { userId }, attributes: ['id'], raw: true });
  return cards.map((c) => c.id);
}

async function findOwnedCard(cardId, userId) {
  const card = await Card.findOne({ where: { id: cardId, userId } });
  if (!card) throw AppError.notFound('Card not found', 'CARD_NOT_FOUND');
  return card;
}

const monthExpression = () =>
  sequelize.getDialect() === 'postgres'
    ? fn('to_char', fn('date_trunc', 'month', col('createdAt')), 'YYYY-MM')
    : fn('strftime', '%Y-%m', col('createdAt'));

// Purchases that count as spending: approved and not a wallet top-up.
const spendingWhere = (cardIds) => ({
  cardId: cardIds,
  status: 'approved',
  category: { [Op.or]: [{ [Op.ne]: 'wallet_topup' }, { [Op.is]: null }] },
});

// ================= CREATE CARD =================
exports.createCard = async (req, res) => {
  const { type, name, cardNumber, expiryDate } = req.body; // CVV validated by the schema, never stored
  const userId = req.user.id;

  const user = await User.findByPk(userId);
  if (!user) throw AppError.notFound('User not found');

  const cardFingerprint = fingerprint(cardNumber);
  const duplicate = await Card.findOne({ where: { userId, fingerprint: cardFingerprint }, attributes: ['id'] });
  if (duplicate) throw AppError.conflict('This card has already been added', 'DUPLICATE_CARD');

  const creditLimit = type === 'credit' ? creditLimitFor(user.credit_score) : 0;

  const card = await Card.create({
    userId,
    maskedNumber: maskPan(cardNumber),
    last4: lastFour(cardNumber),
    brand: detectBrand(cardNumber),
    fingerprint: cardFingerprint,
    cardHolderName: name,
    expiryDate,
    cardType: type,
    creditLimit,
    availableCredit: creditLimit,
    outstandingBalance: 0,
    minimumDue: 0,
    status: 'active',
  });

  res.status(201).json({ message: 'Card created successfully', card });
};

// ================= SPEND (WITH FRAUD ENGINE) =================
// Fraud is evaluated before any money moves. A flagged purchase is declined
// (recorded with status "declined") and the card is frozen; otherwise the
// wallet (debit) or available credit (credit) is charged atomically.
exports.spend = async (req, res) => {
  const { cardId, amount, merchant, category } = req.body;
  const userId = req.user.id;

  const result = await sequelize.transaction(async (t) => {
    const wallet = await walletService.lockWallet(userId, t);
    const card = await Card.findOne({ where: { id: cardId, userId }, transaction: t, lock: t.LOCK.UPDATE });
    if (!card) throw AppError.notFound('Card not found', 'CARD_NOT_FOUND');
    if (card.status !== 'active') throw AppError.badRequest('Card is frozen', 'CARD_FROZEN');

    const [recent, recentCountLastMinute] = await Promise.all([
      CardTransaction.findAll({
        attributes: ['amount'],
        where: { cardId, status: 'approved' },
        order: [['createdAt', 'DESC']],
        limit: 10,
        transaction: t,
      }),
      CardTransaction.count({ where: { cardId, createdAt: { [Op.gt]: new Date(Date.now() - 60000) } }, transaction: t }),
    ]);

    const verdict = evaluateTransaction({
      amount,
      recentAmounts: recent.map((r) => r.amount),
      recentCountLastMinute,
    });
    const resolvedCategory = category || categorizeMerchant(merchant);

    if (verdict.isFraud) {
      card.status = 'frozen';
      await card.save({ transaction: t });
      const declined = await CardTransaction.create({
        cardId, amount, merchant, category: resolvedCategory, status: 'declined', fraudScore: verdict.score, isFraud: true,
      }, { transaction: t });
      return { declined: true, verdict, transaction: declined };
    }

    if (card.cardType === 'debit') {
      if (wallet.balance < amount) throw AppError.badRequest('Insufficient wallet balance', 'INSUFFICIENT_FUNDS');
      wallet.balance = round2(wallet.balance - amount);
      await wallet.save({ transaction: t });
    } else {
      if (card.availableCredit < amount) throw AppError.badRequest('Credit limit exceeded', 'CREDIT_LIMIT_EXCEEDED');
      card.availableCredit = round2(card.availableCredit - amount);
      card.outstandingBalance = round2(card.outstandingBalance + amount);
      card.minimumDue = walletService.minimumDueFor(card.outstandingBalance);
      await card.save({ transaction: t });
    }

    const approved = await CardTransaction.create({
      cardId, amount, merchant, category: resolvedCategory, status: 'approved', fraudScore: verdict.score, isFraud: false,
    }, { transaction: t });

    return { declined: false, verdict, transaction: approved, card, wallet };
  });

  if (result.declined) {
    // The decline and the card freeze are committed; report it to the client.
    return res.status(402).json({
      message: 'Transaction declined: flagged as potential fraud. The card has been frozen.',
      code: 'TRANSACTION_DECLINED',
      fraudScore: result.verdict.score,
      isFraud: true,
      reasons: result.verdict.reasons,
      transaction: result.transaction,
    });
  }

  return res.json({
    message: 'Transaction successful',
    fraudScore: result.verdict.score,
    isFraud: false,
    transaction: result.transaction,
    card: result.card,
    walletBalance: result.wallet.balance,
  });
};

// ================= PAY CREDIT CARD BILL FROM WALLET =================
exports.payCreditBill = async (req, res) => {
  const { cardId, amount } = req.body;
  const { card, wallet, transaction } = await walletService.payCardBill({ userId: req.user.id, cardId, amount });
  res.json({
    message: 'Bill paid successfully',
    card,
    walletBalance: wallet.balance,
    transaction,
  });
};

// ================= GET USER CARDS =================
exports.getUserCards = async (req, res) => {
  const cards = await Card.findAll({ where: { userId: req.user.id }, order: [['createdAt', 'ASC']] });
  res.json(cards);
};

// ================= GET CARD BY ID =================
exports.getCardById = async (req, res) => {
  const card = await findOwnedCard(req.validated.params.id, req.user.id);
  res.json(card);
};

// ================= TOGGLE FREEZE =================
exports.toggleFreeze = async (req, res) => {
  const card = await findOwnedCard(req.body.cardId, req.user.id);
  card.status = card.status === 'active' ? 'frozen' : 'active';
  await card.save();
  res.json({ status: card.status });
};

// ================= SIMULATE TRANSACTIONS =================
// Generates historical demo purchases spread over the last `daysBack` days.
// These are sample data only: balances are not changed.
const DEMO_MERCHANTS = [
  ['Swiggy', 'food'], ['Zomato', 'food'], ['Starbucks', 'food'], ["Domino's Pizza", 'food'],
  ['Amazon', 'shopping'], ['Flipkart', 'shopping'], ['Myntra', 'shopping'],
  ['Uber', 'transport'], ['Ola', 'transport'],
  ['Netflix', 'entertainment'], ['BookMyShow', 'entertainment'], ['Spotify', 'entertainment'],
  ['Apple', 'electronics'], ['BigBasket', 'groceries'], ['Walmart', 'groceries'],
  ['Shell', 'fuel'], ['IndiGo', 'travel'], ['Airtel', 'utilities'], ['Apollo Pharmacy', 'health'],
];

exports.simulateTransactions = async (req, res) => {
  const { cardId, count, daysBack } = req.body;
  await findOwnedCard(cardId, req.user.id);

  const now = Date.now();
  const rows = Array.from({ length: count }, () => {
    const [merchant, category] = DEMO_MERCHANTS[Math.floor(Math.random() * DEMO_MERCHANTS.length)];
    const createdAt = new Date(now - Math.floor(Math.random() * daysBack * 24 * 60 * 60 * 1000));
    return {
      cardId,
      amount: Math.floor(Math.random() * 1000) + 100,
      merchant,
      category,
      status: 'approved',
      fraudScore: 0,
      isFraud: false,
      createdAt,
      updatedAt: createdAt,
    };
  });

  await CardTransaction.bulkCreate(rows); // one INSERT instead of `count` round trips
  res.status(201).json({ message: 'Simulation complete', created: rows.length });
};

// ================= CARD TRANSACTIONS =================
exports.getCardTransactions = async (req, res) => {
  const { cardId } = req.validated.params;
  const { limit, offset } = req.validated.query;
  await findOwnedCard(cardId, req.user.id); // ownership check (prevents reading other users' cards)

  const transactions = await CardTransaction.findAll({
    where: { cardId },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  res.json(transactions);
};

// ================= DELETE CARD =================
exports.deleteCard = async (req, res) => {
  const card = await findOwnedCard(req.validated.params.cardId, req.user.id);
  if (card.cardType === 'credit' && card.outstandingBalance > 0) {
    throw AppError.badRequest('Pay the outstanding balance before removing this card', 'OUTSTANDING_BALANCE');
  }
  await card.destroy();
  res.json({ message: 'Card deleted successfully' });
};

// ================= SPENDINGS =================
exports.getUserSpendings = async (req, res) => {
  const { limit, offset } = req.validated.query;
  const cardIds = await ownedCardIds(req.user.id);
  if (!cardIds.length) return res.json({ totalSpent: 0, transactions: [] });

  const [totalSpent, transactions] = await Promise.all([
    CardTransaction.sum('amount', { where: spendingWhere(cardIds) }),
    CardTransaction.findAll({ where: { cardId: cardIds }, order: [['createdAt', 'DESC']], limit, offset }),
  ]);

  return res.json({ totalSpent: round2(totalSpent), transactions });
};

// ================= MONTHLY ANALYTICS =================
// Aggregated in SQL (dialect-aware month bucketing) instead of in JS.
exports.getSpendingAnalytics = async (req, res) => {
  const cardIds = await ownedCardIds(req.user.id);
  if (!cardIds.length) return res.json([]);

  const month = monthExpression();
  const rows = await CardTransaction.findAll({
    attributes: [
      [month, 'month'],
      [fn('SUM', literal(`CASE WHEN "status" = 'approved' THEN "amount" ELSE 0 END`)), 'totalSpent'],
      [fn('SUM', literal(`CASE WHEN "status" = 'approved' THEN 1 ELSE 0 END`)), 'totalTransactions'],
      [fn('AVG', col('amount')), 'avgTransaction'],
      [fn('SUM', literal('CASE WHEN "isFraud" THEN 1 ELSE 0 END')), 'fraudCount'],
    ],
    where: { cardId: cardIds },
    group: [month],
    order: [[month, 'ASC']],
    raw: true,
  });

  return res.json(rows.map((r) => ({
    month: r.month,
    totalSpent: round2(r.totalSpent),
    totalTransactions: toNumber(r.totalTransactions),
    avgTransaction: round2(r.avgTransaction),
    fraudCount: toNumber(r.fraudCount),
  })));
};

// ================= MERCHANT / CATEGORY ANALYTICS =================
exports.getCategoryAnalytics = async (req, res) => {
  const { groupBy } = req.validated.query;
  const cardIds = await ownedCardIds(req.user.id);
  if (!cardIds.length) return res.json([]);

  const rows = await CardTransaction.findAll({
    attributes: [groupBy, [fn('SUM', col('amount')), 'totalSpent'], [fn('COUNT', col('id')), 'count']],
    where: spendingWhere(cardIds),
    group: [groupBy],
    order: [[literal('"totalSpent"'), 'DESC']],
    raw: true,
  });

  return res.json(rows.map((r) => ({ [groupBy]: r[groupBy], totalSpent: round2(r.totalSpent), count: toNumber(r.count) })));
};
