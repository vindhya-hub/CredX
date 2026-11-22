/**
 * Builds retrieval documents from one user's records.
 *
 * Each record becomes { id, type, title, text, snippet, date, amount, meta }:
 *   text       what BM25 sees: a descriptive sentence plus category
 *              synonyms, so "dining" or "restaurants" still match a food
 *              purchase
 *   embedText  what the embedding model sees: a short sentence with just the
 *              meaning-bearing parts (amounts and dates are handled by
 *              structured filters, and they dilute sentence embeddings)
 *   snippet  the short line shown to the user as a citation
 *   meta     structured fields used for filtering and aggregation
 *
 * Only masked card data ever appears here (brand + last 4); full card
 * numbers and CVVs are not stored by the app at all.
 */
const { CATEGORY_SYNONYMS } = require('./query/intent');

const LEDGER_LABELS = {
  transfer: 'Wallet transfer',
  deposit: 'Wallet top-up',
  loan_disbursement: 'Loan disbursement',
  emi_payment: 'Loan EMI payment',
  card_payment: 'Credit card bill payment',
};

const cardLabel = (card) =>
  card ? `${card.brand || 'CARD'} ${card.cardType} card ending ${card.last4 || '????'}` : 'a card that was removed';

// Only what the user already sees in their transfer history (no internal ids).
const pickCounterparty = (user) => (user ? { name: user.name, email: user.email } : null);

const categoryKeywords = (category) => (CATEGORY_SYNONYMS[category] || []).slice(0, 8).join(' ');

function cardTransactionDocument(tx, cardsById, fmt) {
  const card = cardsById.get(tx.cardId);
  const category = tx.category || 'other';
  const declined = tx.status === 'declined';
  const fraudText = tx.isFraud ? ' Flagged as potential fraud (suspicious), declined and the card was frozen.' : '';
  const verb = declined ? 'Declined card purchase' : 'Card purchase';
  return {
    id: `card_transaction:${tx.id}`,
    type: 'card_transaction',
    title: tx.merchant || 'Card purchase',
    date: tx.createdAt,
    amount: tx.amount,
    text:
      `${verb} at ${tx.merchant || 'unknown merchant'} for ${fmt.money(tx.amount)} (${tx.amount}). ` +
      `Category ${fmt.category(category)}: ${categoryKeywords(category)}. ` +
      `Spent on ${fmt.date(tx.createdAt)} (${fmt.monthYear(tx.createdAt)}) with ${cardLabel(card)}. ` +
      `Card transaction status ${tx.status || 'approved'}.${fraudText}`,
    // "Starbucks (food & dining)": boilerplate words lower the similarity to
    // short topic queries like "coffee" (0.52 vs 0.30 with a full sentence).
    embedText: `${tx.merchant || 'Unknown merchant'} (${fmt.category(category)})`,
    snippet: `${fmt.money(tx.amount)} at ${tx.merchant || 'unknown merchant'} · ${fmt.category(category)} · ${cardLabel(card)} · ${fmt.date(tx.createdAt)}${declined ? ' · declined' : ''}`,
    meta: {
      recordId: tx.id,
      cardId: tx.cardId,
      merchant: tx.merchant,
      category,
      status: tx.status || 'approved',
      isFraud: Boolean(tx.isFraud),
      fraudScore: tx.fraudScore,
      cardType: card ? card.cardType : null,
      brand: card ? card.brand : null,
      last4: card ? card.last4 : null,
    },
  };
}

function ledgerDocument(tx, userId, fmt) {
  const outgoing = tx.senderId === userId;
  const label = LEDGER_LABELS[tx.type] || 'Wallet transaction';
  let detail;
  if (tx.type === 'transfer') {
    const other = outgoing ? tx.receiver : tx.sender;
    const who = other ? `${other.name} (${other.email})` : 'another user';
    detail = outgoing ? `sent to ${who}` : `received from ${who}`;
  } else if (tx.type === 'deposit') {
    detail = 'added to the wallet (deposit, top up)';
  } else if (tx.type === 'loan_disbursement') {
    detail = 'credited to the wallet from a loan';
  } else if (tx.type === 'emi_payment') {
    detail = 'paid from the wallet towards a loan instalment';
  } else if (tx.type === 'card_payment') {
    detail = 'paid from the wallet towards a credit card bill';
  } else {
    detail = outgoing ? 'paid from the wallet' : 'received in the wallet';
  }
  const direction = outgoing ? 'money out (debit)' : 'money in (credit)';
  return {
    id: `wallet_transaction:${tx.id}`,
    type: 'wallet_transaction',
    title: label,
    date: tx.createdAt,
    amount: tx.amount,
    text:
      `${label} of ${fmt.money(tx.amount)} (${tx.amount}) ${detail} on ${fmt.date(tx.createdAt)} (${fmt.monthYear(tx.createdAt)}). ` +
      `Wallet ledger ${direction}, status ${tx.status}.${tx.description ? ` Note: ${tx.description}.` : ''}`,
    embedText: `${label} ${detail}${tx.description ? `: ${tx.description}` : ''}`,
    snippet: `${outgoing ? '−' : '+'}${fmt.money(tx.amount)} · ${label} ${detail} · ${fmt.date(tx.createdAt)}`,
    meta: {
      recordId: tx.id,
      ledgerType: tx.type,
      direction: outgoing ? 'debit' : 'credit',
      counterparty: tx.type === 'transfer' ? pickCounterparty(outgoing ? tx.receiver : tx.sender) : null,
      referenceId: tx.referenceId || null,
    },
  };
}

function cardDocument(card, fmt) {
  const isCredit = card.cardType === 'credit';
  const creditText = isCredit
    ? ` Credit limit ${fmt.money(card.creditLimit)}, available credit ${fmt.money(card.availableCredit)}, ` +
      `outstanding balance ${fmt.money(card.outstandingBalance)}, minimum due ${fmt.money(card.minimumDue)} (bill amount due).`
    : ' Debit card: purchases are paid from the wallet balance.';
  return {
    id: `card:${card.id}`,
    type: 'card',
    title: cardLabel(card),
    date: card.createdAt,
    amount: isCredit ? card.creditLimit : null,
    text:
      `${cardLabel(card)} (${card.maskedNumber || ''}), cardholder ${card.cardHolderName || 'unknown'}. ` +
      `Card status ${card.status}. Expires ${card.expiryDate || 'unknown'}.${creditText}`,
    embedText: isCredit
      ? `${cardLabel(card)} with a credit limit, available credit, outstanding balance and minimum due`
      : `${cardLabel(card)} that pays from the wallet`,
    snippet: isCredit
      ? `${cardLabel(card)} · limit ${fmt.money(card.creditLimit)} · available ${fmt.money(card.availableCredit)} · outstanding ${fmt.money(card.outstandingBalance)} · ${card.status}`
      : `${cardLabel(card)} · ${card.status} · expires ${card.expiryDate || 'unknown'}`,
    meta: {
      recordId: card.id,
      cardType: card.cardType,
      brand: card.brand,
      last4: card.last4,
      status: card.status,
      creditLimit: card.creditLimit,
      availableCredit: card.availableCredit,
      outstandingBalance: card.outstandingBalance,
      minimumDue: card.minimumDue,
    },
  };
}

function loanDocument(loan, fmt) {
  const active = loan.status !== 'closed' && loan.remainingBalance > 0;
  return {
    id: `loan:${loan.id}`,
    type: 'loan',
    title: `Loan of ${fmt.money(loan.amount)}`,
    date: loan.createdAt,
    amount: loan.amount,
    text:
      `Loan of ${fmt.money(loan.amount)} at ${loan.interestRate}% annual interest for ${loan.tenureMonths} months (tenure). ` +
      `Monthly EMI instalment ${fmt.money(loan.emi)}. Paid ${fmt.money(loan.paidAmount)}, remaining balance owed ${fmt.money(loan.remainingBalance)}. ` +
      `Loan status ${active ? 'active (repaying)' : 'closed (fully repaid)'}. Borrowed on ${fmt.date(loan.createdAt)}.`,
    embedText: `${active ? 'Active' : 'Closed'} loan with a monthly EMI instalment, interest rate and remaining balance`,
    snippet: `${fmt.money(loan.amount)} · EMI ${fmt.money(loan.emi)} × ${loan.tenureMonths} months at ${loan.interestRate}% · remaining ${fmt.money(loan.remainingBalance)} · ${active ? 'active' : 'closed'}`,
    meta: {
      recordId: loan.id,
      active,
      emi: loan.emi,
      interestRate: loan.interestRate,
      tenureMonths: loan.tenureMonths,
      remainingBalance: loan.remainingBalance,
      paidAmount: loan.paidAmount,
    },
  };
}

function walletDocument(wallet, fmt) {
  return {
    id: `wallet:${wallet.id}`,
    type: 'wallet',
    title: 'Wallet',
    date: wallet.updatedAt,
    amount: wallet.balance,
    text: `Wallet balance ${fmt.money(wallet.balance)} (${wallet.balance}) available money in the CredX wallet.`,
    embedText: 'Wallet balance: the money available in my wallet',
    snippet: `Wallet balance ${fmt.money(wallet.balance)}`,
    meta: { recordId: wallet.id, balance: wallet.balance },
  };
}

function accountDocument(user, fmt) {
  return {
    id: `account:${user.id}`,
    type: 'account',
    title: 'Account profile',
    date: user.createdAt,
    amount: null,
    text:
      `Account profile for ${user.name}. Credit score ${user.credit_score} (credit rating). ` +
      `KYC status ${user.kyc_status}. Account status ${user.account_status}. Member since ${fmt.date(user.createdAt)}.`,
    embedText: 'Account profile with credit score, KYC and account status',
    snippet: `Credit score ${user.credit_score} · KYC ${user.kyc_status} · account ${user.account_status}`,
    meta: { recordId: user.id, creditScore: user.credit_score },
  };
}

/**
 * @param {{ user, wallet, cards, cardTransactions, ledger, loans }} records plain objects
 * @param {ReturnType<import('./format').createFormatter>} fmt
 */
function buildDocuments(records, fmt) {
  const cardsById = new Map(records.cards.map((card) => [card.id, card]));
  return [
    ...(records.user ? [accountDocument(records.user, fmt)] : []),
    ...(records.wallet ? [walletDocument(records.wallet, fmt)] : []),
    ...records.cards.map((card) => cardDocument(card, fmt)),
    ...records.loans.map((loan) => loanDocument(loan, fmt)),
    ...records.cardTransactions.map((tx) => cardTransactionDocument(tx, cardsById, fmt)),
    ...records.ledger.map((tx) => ledgerDocument(tx, records.user.id, fmt)),
  ];
}

module.exports = {
  buildDocuments,
  cardTransactionDocument,
  ledgerDocument,
  cardDocument,
  loanDocument,
  walletDocument,
  accountDocument,
  cardLabel,
};
