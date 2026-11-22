/**
 * Wallet ledger service: every operation that moves wallet money lives here.
 *
 * Each operation runs inside a single Sequelize (database) transaction:
 *  - the rows involved are locked with SELECT ... FOR UPDATE (Postgres), always
 *    in the same order (wallet first, then card/loan; wallets sorted by user id)
 *    so concurrent requests cannot double-spend or deadlock;
 *  - balances are updated and a ledger row (Transaction model) is written;
 *  - any thrown error rolls everything back, so balances never change without
 *    a matching ledger entry.
 */
const { fn, col, where, Op } = require('sequelize');
const config = require('../../config/config');
const AppError = require('../../utils/AppError');
const { round2, toNumber } = require('../../utils/money');
const { calculateCreditScore } = require('../../utils/creditScore');
const { sequelize, User, Wallet, Card, CardTransaction, Loan, Transaction } = require('../../models');

const MINIMUM_DUE_RATE = 0.05; // 5% of the outstanding balance

const TRANSFER_LIMITS = config.transfers;

const minimumDueFor = (outstanding) => round2(Math.max(0, outstanding) * MINIMUM_DUE_RATE);

const lock = (transaction) => ({ transaction, lock: transaction.LOCK.UPDATE });

/** Locks (or lazily creates, for legacy accounts) the user's wallet. */
async function lockWallet(userId, transaction) {
  const wallet = await Wallet.findOne({ where: { userId }, ...lock(transaction) });
  return wallet || Wallet.create({ userId }, { transaction });
}

async function lockOwnedCard(cardId, userId, transaction) {
  const card = await Card.findOne({ where: { id: cardId, userId }, ...lock(transaction) });
  if (!card) throw AppError.notFound('Card not found', 'CARD_NOT_FOUND');
  return card;
}

async function refreshCreditScore(userId, transaction) {
  const score = await calculateCreditScore(userId, { transaction });
  await User.update({ credit_score: score }, { where: { id: userId }, transaction });
  return score;
}

async function getWallet(userId) {
  const wallet = await Wallet.findOne({ where: { userId } });
  return wallet || Wallet.create({ userId });
}

// ================= TRANSFER (wallet -> wallet) =================
async function transfer({ senderId, receiverEmail, amount, note }) {
  return sequelize.transaction(async (t) => {
    const receiver = await User.findOne({
      where: where(fn('lower', col('email')), receiverEmail.toLowerCase()),
      transaction: t,
    });
    if (!receiver) throw AppError.notFound('Receiver not found', 'RECEIVER_NOT_FOUND');
    if (receiver.id === senderId) throw AppError.badRequest('You cannot transfer money to yourself', 'SELF_TRANSFER');
    if (receiver.account_status !== 'active') {
      throw AppError.badRequest('Receiver account is not active', 'RECEIVER_INACTIVE');
    }

    // Lock both wallets in a deterministic order (avoids A->B / B->A deadlocks).
    // Holding the sender's lock also serialises the daily-limit check below.
    const locked = await Wallet.findAll({
      where: { userId: [senderId, receiver.id] },
      order: [['userId', 'ASC']],
      ...lock(t),
    });
    const senderWallet = locked.find((w) => w.userId === senderId) || (await Wallet.create({ userId: senderId }, { transaction: t }));
    const receiverWallet = locked.find((w) => w.userId === receiver.id) || (await Wallet.create({ userId: receiver.id }, { transaction: t }));

    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const today = await Transaction.findOne({
      attributes: [[fn('COALESCE', fn('SUM', col('amount')), 0), 'total'], [fn('COUNT', col('id')), 'count']],
      where: { senderId, type: 'transfer', createdAt: { [Op.gte]: startOfDay } },
      raw: true,
      transaction: t,
    });
    if (toNumber(today.count) >= TRANSFER_LIMITS.dailyCount) {
      throw AppError.badRequest('Daily transfer count limit exceeded', 'DAILY_COUNT_LIMIT');
    }
    if (round2(toNumber(today.total) + amount) > TRANSFER_LIMITS.dailyAmount) {
      throw AppError.badRequest('Daily transfer amount limit exceeded', 'DAILY_AMOUNT_LIMIT');
    }

    if (senderWallet.balance < amount) throw AppError.badRequest('Insufficient balance', 'INSUFFICIENT_FUNDS');

    senderWallet.balance = round2(senderWallet.balance - amount);
    receiverWallet.balance = round2(receiverWallet.balance + amount);
    await senderWallet.save({ transaction: t });
    await receiverWallet.save({ transaction: t });

    const fraudScore = amount > 10000 ? 0.8 : 0.1;
    const record = await Transaction.create({
      senderId,
      receiverId: receiver.id,
      amount,
      type: 'transfer',
      status: 'completed',
      fraud_score: fraudScore,
      description: note || `Transfer to ${receiver.name}`,
    }, { transaction: t });

    const newCreditScore = await refreshCreditScore(senderId, t);

    return { transaction: record, balance: senderWallet.balance, fraudScore, newCreditScore };
  });
}

// ================= TOP-UP =================
// Without a card: simulated bank transfer into the wallet (demo funding).
// With a credit card: charged to the card (cash advance) and credited to the wallet.
async function topUp({ userId, amount, cardId }) {
  return sequelize.transaction(async (t) => {
    const wallet = await lockWallet(userId, t);
    let card = null;

    if (cardId) {
      card = await lockOwnedCard(cardId, userId, t);
      if (card.cardType !== 'credit') {
        throw AppError.badRequest(
          'Debit cards draw from your wallet, so they cannot top it up. Choose a credit card or a bank top-up.',
          'DEBIT_CARD_TOPUP',
        );
      }
      if (card.status !== 'active') throw AppError.badRequest('Card is not active', 'CARD_INACTIVE');
      if (card.availableCredit < amount) {
        throw AppError.badRequest('Insufficient available credit on this card', 'CREDIT_LIMIT_EXCEEDED');
      }

      card.availableCredit = round2(card.availableCredit - amount);
      card.outstandingBalance = round2(card.outstandingBalance + amount);
      card.minimumDue = minimumDueFor(card.outstandingBalance);
      await card.save({ transaction: t });

      await CardTransaction.create({
        cardId: card.id,
        amount,
        merchant: 'CredX Wallet top-up',
        category: 'wallet_topup',
        status: 'approved',
      }, { transaction: t });
    }

    wallet.balance = round2(wallet.balance + amount);
    await wallet.save({ transaction: t });

    const record = await Transaction.create({
      senderId: null,
      receiverId: userId,
      amount,
      type: 'deposit',
      status: 'completed',
      referenceId: card ? card.id : null,
      description: card ? `Top-up from credit card ending ${card.last4}` : 'Wallet top-up (simulated bank transfer)',
    }, { transaction: t });

    return { wallet, card, transaction: record };
  });
}

// ================= PAY CREDIT CARD BILL (wallet -> card) =================
async function payCardBill({ userId, cardId, amount }) {
  return sequelize.transaction(async (t) => {
    const wallet = await lockWallet(userId, t);
    const card = await lockOwnedCard(cardId, userId, t);

    if (card.cardType !== 'credit') throw AppError.badRequest('Only credit card bills can be paid', 'NOT_A_CREDIT_CARD');

    const outstanding = card.outstandingBalance;
    if (outstanding <= 0) throw AppError.badRequest('This card has no outstanding balance', 'NOTHING_TO_PAY');

    const payment = amount === undefined ? outstanding : amount;
    if (payment > outstanding) {
      throw AppError.badRequest(`Payment exceeds the outstanding balance of ${outstanding.toFixed(2)}`, 'OVERPAYMENT');
    }
    if (wallet.balance < payment) throw AppError.badRequest('Insufficient wallet balance', 'INSUFFICIENT_FUNDS');

    wallet.balance = round2(wallet.balance - payment);
    card.outstandingBalance = round2(outstanding - payment);
    card.availableCredit = round2(Math.min(card.creditLimit, card.availableCredit + payment));
    card.minimumDue = round2(Math.min(card.outstandingBalance, Math.max(0, card.minimumDue - payment)));
    await wallet.save({ transaction: t });
    await card.save({ transaction: t });

    const record = await Transaction.create({
      senderId: userId,
      receiverId: null,
      amount: payment,
      type: 'card_payment',
      status: 'completed',
      referenceId: card.id,
      description: `Credit card bill payment (card ending ${card.last4})`,
    }, { transaction: t });

    const newCreditScore = await refreshCreditScore(userId, t);

    return { card, wallet, transaction: record, newCreditScore };
  });
}

// ================= LOAN: DISBURSE (on approval) =================
async function disburseLoan({ userId, loanAttributes }) {
  return sequelize.transaction(async (t) => {
    const wallet = await lockWallet(userId, t);
    const loan = await Loan.create({ userId, ...loanAttributes }, { transaction: t });

    wallet.balance = round2(wallet.balance + loan.amount);
    await wallet.save({ transaction: t });

    await Transaction.create({
      senderId: null,
      receiverId: userId,
      amount: loan.amount,
      type: 'loan_disbursement',
      status: 'completed',
      referenceId: loan.id,
      description: `Loan disbursement (${loan.tenureMonths} months at ${loan.interestRate}%)`,
    }, { transaction: t });

    return { loan, wallet };
  });
}

// ================= LOAN: PAY EMI (wallet -> loan) =================
async function payLoanEmi({ userId, loanId }) {
  return sequelize.transaction(async (t) => {
    const wallet = await lockWallet(userId, t);
    const loan = await Loan.findOne({ where: { id: loanId, userId }, ...lock(t) });
    if (!loan) throw AppError.notFound('Loan not found', 'LOAN_NOT_FOUND');
    if (loan.status === 'closed' || loan.remainingBalance <= 0) {
      throw AppError.badRequest('Loan already paid', 'LOAN_CLOSED');
    }

    // The final instalment only covers what is left.
    const installment = round2(Math.min(loan.emi, loan.remainingBalance));
    if (wallet.balance < installment) {
      throw AppError.badRequest('Insufficient wallet balance to pay EMI', 'INSUFFICIENT_FUNDS');
    }

    wallet.balance = round2(wallet.balance - installment);
    loan.paidAmount = round2(loan.paidAmount + installment);
    loan.remainingBalance = round2(loan.remainingBalance - installment);
    if (loan.remainingBalance <= 0) {
      loan.remainingBalance = 0;
      loan.status = 'closed';
    }
    await wallet.save({ transaction: t });
    await loan.save({ transaction: t });

    const record = await Transaction.create({
      senderId: userId,
      receiverId: null,
      amount: installment,
      type: 'emi_payment',
      status: 'completed',
      referenceId: loan.id,
      description: 'Loan EMI payment',
    }, { transaction: t });

    const newCreditScore = await refreshCreditScore(userId, t);

    return { loan, wallet, transaction: record, newCreditScore };
  });
}

module.exports = {
  getWallet,
  transfer,
  topUp,
  payCardBill,
  disburseLoan,
  payLoanEmi,
  minimumDueFor,
  lockWallet,
  TRANSFER_LIMITS,
};
