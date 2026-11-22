/**
 * Virtual assistant: answers natural-language questions about the logged-in
 * user's own data.
 *
 * Pipeline for one question:
 *   1. Load the user's cards and merchant names, then parse the question
 *      (intent, time range, categories, merchants, card, amounts).
 *   2. Load the user's records (time-bounded where the question is) and turn
 *      them into documents (documents.js). Every query is scoped by userId.
 *   3. Select candidates: the document types the intent needs, narrowed by
 *      the structured filters.
 *   4. Hybrid retrieval over the candidates: BM25 + embedding cosine
 *      similarity, fused with configurable weights (retrieval/). When the
 *      question names something that is not a known category or merchant
 *      ("yoga"), retrieval relevance decides which records match.
 *   5. Compose a templated answer from exact SQL aggregates and the
 *      retrieved records, and return the top records as citations.
 */
const { Op, fn, col } = require('sequelize');
const config = require('../../config/config');
const logger = require('../../utils/logger');
const { round2, toNumber } = require('../../utils/money');
const { User, Wallet, Card, CardTransaction, Transaction, Loan } = require('../../models');
const { parseQuery, INTENTS } = require('./query/intent');
const { buildDocuments } = require('./documents');
const { hybridSearch, filterRelevant, hasRelevant } = require('./retrieval/hybrid');
const { createFormatter } = require('./format');
const { composeAnswer, SUGGESTIONS } = require('./answers');
const { getEmbeddingService } = require('./embeddings');

/** Document types each intent searches (null = everything). */
const SCOPES = {
  [INTENTS.SPENDING_SUMMARY]: ['card_transaction'],
  [INTENTS.CARD_TRANSACTIONS]: ['card_transaction'],
  [INTENTS.FRAUD_ALERTS]: ['card_transaction'],
  [INTENTS.WALLET_ACTIVITY]: ['wallet_transaction'],
  [INTENTS.WALLET_BALANCE]: ['wallet', 'wallet_transaction'],
  [INTENTS.CARD_INFO]: ['card'],
  [INTENTS.LOAN_INFO]: ['loan'],
  [INTENTS.CREDIT_SCORE]: ['account'],
  [INTENTS.HELP]: [],
  [INTENTS.GENERAL]: null,
};

/** Extra keyword-side terms per intent (BM25 only). */
const INTENT_EXPANSIONS = {
  [INTENTS.CARD_INFO]: ['credit', 'limit', 'available', 'outstanding', 'minimum', 'due'],
  [INTENTS.LOAN_INFO]: ['loan', 'emi', 'instalment', 'interest', 'remaining'],
  [INTENTS.WALLET_BALANCE]: ['wallet', 'balance'],
  [INTENTS.WALLET_ACTIVITY]: ['wallet', 'transfer', 'sent', 'received', 'deposit'],
  [INTENTS.FRAUD_ALERTS]: ['fraud', 'suspicious', 'declined', 'flagged'],
  [INTENTS.CREDIT_SCORE]: ['credit', 'score'],
};

const TRANSACTION_TYPES = new Set(['card_transaction', 'wallet_transaction']);
const RECENCY_INTENTS = new Set([INTENTS.CARD_TRANSACTIONS, INTENTS.WALLET_ACTIVITY, INTENTS.FRAUD_ALERTS, INTENTS.WALLET_BALANCE]);

const plain = (instance) => (instance ? instance.toJSON() : null);
const dateDesc = (a, b) => new Date(b.doc.date || 0) - new Date(a.doc.date || 0);
const amountDesc = (a, b) => (b.doc.amount || 0) - (a.doc.amount || 0) || dateDesc(a, b);

function inRange(date, range) {
  if (!range) return true;
  const t = new Date(date).getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

function cardMatches(card, filter) {
  if (!filter) return true;
  if (filter.type && card.cardType !== filter.type) return false;
  if (filter.brand && card.brand !== filter.brand) return false;
  if (filter.last4 && card.last4 !== filter.last4) return false;
  return true;
}

/** Sub-filters for wallet questions ("sent", "received", "top-ups"). */
function walletFilter(q) {
  if (/\b(sent|send|paid to|transferred to|outgoing|money out)\b/.test(q)) return { direction: 'debit' };
  if (/\b(received|receive|got|incoming|money in)\b/.test(q)) return { direction: 'credit' };
  if (/\b(deposits?|deposited|top ?ups?|topped up|added money|add money)\b/.test(q)) return { ledgerType: 'deposit' };
  if (/\bdisburse\w*\b/.test(q)) return { ledgerType: 'loan_disbursement' };
  if (/\b(transfers?|transferred)\b/.test(q)) return { ledgerType: 'transfer' };
  return null;
}

// ---------------------------------------------------------------- data access

async function loadContext(userId) {
  const [user, wallet, cards, loans] = await Promise.all([
    User.findByPk(userId),
    Wallet.findOne({ where: { userId } }),
    Card.findAll({ where: { userId }, order: [['createdAt', 'ASC']] }),
    Loan.findAll({ where: { userId }, order: [['createdAt', 'DESC']] }),
  ]);
  const cardIds = cards.map((c) => c.id);
  const merchantRows = cardIds.length
    ? await CardTransaction.findAll({
      attributes: [[fn('DISTINCT', col('merchant')), 'merchant']],
      where: { cardId: cardIds },
      raw: true,
    })
    : [];
  return {
    user: plain(user),
    wallet: plain(wallet),
    cards: cards.map(plain),
    loans: loans.map(plain),
    cardIds,
    merchants: merchantRows.map((r) => r.merchant).filter(Boolean),
  };
}

async function loadActivity(userId, cardIds, timeRange, maxRecords) {
  const createdAt = timeRange ? { [Op.gte]: timeRange.start, [Op.lt]: timeRange.end } : undefined;
  const [cardTransactions, ledger] = await Promise.all([
    cardIds.length
      ? CardTransaction.findAll({
        where: { cardId: cardIds, ...(createdAt && { createdAt }) },
        order: [['createdAt', 'DESC']],
        limit: maxRecords,
      })
      : [],
    Transaction.findAll({
      where: { [Op.or]: [{ senderId: userId }, { receiverId: userId }], ...(createdAt && { createdAt }) },
      include: [
        { model: User, as: 'sender', attributes: ['id', 'name', 'email'] },
        { model: User, as: 'receiver', attributes: ['id', 'name', 'email'] },
      ],
      order: [['createdAt', 'DESC']],
      limit: maxRecords,
    }),
  ]);
  return { cardTransactions: cardTransactions.map(plain), ledger: ledger.map(plain) };
}

/** Exact spending totals in SQL (approved purchases, wallet top-ups excluded). */
async function spendingAggregate(cardIds, parsed) {
  const empty = { total: 0, count: 0, byCategory: [], byMerchant: [] };
  if (!cardIds.length) return empty;

  const where = { cardId: cardIds, status: 'approved' };
  where.category = parsed.categories.length
    ? { [Op.in]: parsed.categories }
    : { [Op.or]: [{ [Op.ne]: 'wallet_topup' }, { [Op.is]: null }] };
  if (parsed.merchants.length) where.merchant = { [Op.in]: parsed.merchants };
  if (parsed.timeRange) where.createdAt = { [Op.gte]: parsed.timeRange.start, [Op.lt]: parsed.timeRange.end };
  const amount = {};
  if (parsed.minAmount !== undefined) amount[Op.gte] = parsed.minAmount;
  if (parsed.maxAmount !== undefined) amount[Op.lte] = parsed.maxAmount;
  if (Object.getOwnPropertySymbols(amount).length) where.amount = amount;

  const rows = await CardTransaction.findAll({
    attributes: ['category', 'merchant', [fn('SUM', col('amount')), 'total'], [fn('COUNT', col('id')), 'count']],
    where,
    group: ['category', 'merchant'],
    raw: true,
  });
  return summarize(rows.map((r) => ({ category: r.category || 'other', merchant: r.merchant, total: toNumber(r.total), count: toNumber(r.count) })));
}

/** Same shape as spendingAggregate, computed from retrieved documents. */
function aggregateDocs(docs) {
  return summarize(docs.map((d) => ({ category: d.meta.category, merchant: d.meta.merchant, total: d.amount, count: 1 })));
}

function summarize(rows) {
  const byCategory = new Map();
  const byMerchant = new Map();
  let total = 0;
  let count = 0;
  for (const row of rows) {
    total += row.total;
    count += row.count;
    const c = byCategory.get(row.category) || { category: row.category, total: 0, count: 0 };
    c.total += row.total;
    c.count += row.count;
    byCategory.set(row.category, c);
    const key = row.merchant || 'Unknown merchant';
    const m = byMerchant.get(key) || { merchant: key, total: 0, count: 0 };
    m.total += row.total;
    m.count += row.count;
    byMerchant.set(key, m);
  }
  const sorted = (map) => [...map.values()].map((v) => ({ ...v, total: round2(v.total) })).sort((a, b) => b.total - a.total);
  return { total: round2(total), count, byCategory: sorted(byCategory), byMerchant: sorted(byMerchant) };
}

// ------------------------------------------------------------- candidate set

function selectCandidates(documents, parsed, context) {
  const scope = SCOPES[parsed.intent];
  const allowedCardIds = new Set(context.cards.filter((c) => cardMatches(c, parsed.card)).map((c) => c.id));
  const ledgerFilter = parsed.intent === INTENTS.WALLET_ACTIVITY ? walletFilter(parsed.normalized) : null;

  return documents.filter((doc) => {
    if (scope && !scope.includes(doc.type)) return false;
    if (TRANSACTION_TYPES.has(doc.type) && !inRange(doc.date, parsed.timeRange)) return false;

    if (doc.type === 'card_transaction') {
      if (parsed.card && !allowedCardIds.has(doc.meta.cardId)) return false;
      if (parsed.categories.length && !parsed.categories.includes(doc.meta.category)) return false;
      if (parsed.merchants.length && !parsed.merchants.includes(doc.meta.merchant)) return false;
      if (parsed.minAmount !== undefined && doc.amount < parsed.minAmount) return false;
      if (parsed.maxAmount !== undefined && doc.amount > parsed.maxAmount) return false;
      if (parsed.intent === INTENTS.SPENDING_SUMMARY && (doc.meta.status !== 'approved' || doc.meta.category === 'wallet_topup')) return false;
      if (parsed.intent === INTENTS.FRAUD_ALERTS && !(doc.meta.isFraud || doc.meta.status === 'declined')) return false;
    }
    if (doc.type === 'card' && parsed.card && !cardMatches(doc.meta, parsed.card)) return false;
    if (doc.type === 'wallet_transaction' && ledgerFilter) {
      if (ledgerFilter.direction && doc.meta.direction !== ledgerFilter.direction) return false;
      if (ledgerFilter.ledgerType && doc.meta.ledgerType !== ledgerFilter.ledgerType) return false;
    }
    return true;
  });
}

function toCitation({ doc, score, keywordScore, vectorScore }) {
  const r4 = (n) => Math.round(n * 10000) / 10000;
  return {
    id: doc.id,
    type: doc.type,
    title: doc.title,
    snippet: doc.snippet,
    date: doc.date,
    amount: doc.amount,
    meta: doc.meta,
    score: r4(score),
    scores: { keyword: r4(keywordScore), vector: r4(vectorScore), fused: r4(score) },
  };
}

// --------------------------------------------------------------------- main

/**
 * @param {object} params
 * @param {string} params.userId authenticated user (all data access is scoped to it)
 * @param {string} params.query
 * @param {number} [params.topK]
 * @param {number} [params.utcOffsetMinutes] client's local time minus UTC
 * @param {Date} [params.now]
 * @param {object} [params.embeddings] embedding service (tests inject one)
 */
async function answerQuery({ userId, query, topK, utcOffsetMinutes = 0, now = new Date(), embeddings = getEmbeddingService() }) {
  const started = Date.now();
  const settings = config.assistant;
  const fmt = createFormatter({ currency: settings.currency, locale: settings.locale, utcOffsetMinutes });

  const context = await loadContext(userId);
  const parsed = parseQuery(query, { now, utcOffsetMinutes, merchants: context.merchants });
  const limit = Math.min(parsed.limit || topK || settings.topK, 20);

  if (parsed.intent === INTENTS.HELP) {
    const { answer, facts } = composeAnswer({ parsed, fmt, records: context });
    return { ...describeRequest(query, parsed), answer, facts, citations: [], suggestions: SUGGESTIONS, retrieval: null };
  }

  const activity = await loadActivity(userId, context.cardIds, parsed.timeRange, settings.maxRecords);
  const records = { ...context, ...activity };
  const documents = buildDocuments(records, fmt);
  const relevance = { relativeCutoff: settings.relativeCutoff };
  const search = (docs, searchQuery, expansions = []) => hybridSearch({
    query: searchQuery,
    documents: docs,
    embeddings,
    expansions,
    fusion: settings.fusion,
    keywordWeight: settings.keywordWeight,
    rrfK: settings.rrfK,
  });

  // A bare topic ("coffee", "gym") is first tried as a spending question:
  // if retrieval finds matching purchases, the answer sums those.
  if (parsed.intent === INTENTS.GENERAL && parsed.topicTerms.length) {
    const purchases = selectCandidates(documents, { ...parsed, intent: INTENTS.SPENDING_SUMMARY }, context);
    const probe = await search(purchases, parsed.topicTerms.join(' '));
    if (hasRelevant(probe.ranked, probe.embedder, relevance)) parsed.intent = INTENTS.SPENDING_SUMMARY;
  }

  const candidates = selectCandidates(documents, parsed, context);

  // Free-text topic not resolved to a category/merchant: retrieval decides relevance.
  const topicDriven = parsed.topicTerms.length > 0 && !parsed.categories.length && !parsed.merchants.length
    && [INTENTS.SPENDING_SUMMARY, INTENTS.CARD_TRANSACTIONS, INTENTS.WALLET_ACTIVITY].includes(parsed.intent);

  const { ranked, embedder } = topicDriven
    ? await search(candidates, parsed.topicTerms.join(' '))
    : await search(candidates, query, [...(INTENT_EXPANSIONS[parsed.intent] || []), ...parsed.categories, ...parsed.merchants]);

  let results = ranked;
  let topic = null;
  if (topicDriven || parsed.intent === INTENTS.GENERAL) {
    results = filterRelevant(ranked, embedder, relevance);
    if (topicDriven) topic = { terms: parsed.topicTerms, matched: results.length > 0 };
  }

  // Presentation order: recency for list-style questions, largest amounts
  // for structured spending questions, otherwise the fused relevance score.
  const orderedByRecency = !topicDriven && (parsed.wantsRecent || RECENCY_INTENTS.has(parsed.intent));
  if (parsed.intent === INTENTS.WALLET_BALANCE) {
    results = [...results].sort((a, b) => (a.doc.type === 'wallet' ? -1 : 0) - (b.doc.type === 'wallet' ? -1 : 0) || dateDesc(a, b));
  } else if (orderedByRecency) {
    results = [...results].sort(dateDesc);
  } else if (parsed.intent === INTENTS.SPENDING_SUMMARY && !topicDriven) {
    results = [...results].sort(amountDesc);
  }

  let aggregate = null;
  if (parsed.intent === INTENTS.SPENDING_SUMMARY) {
    aggregate = topicDriven
      ? aggregateDocs(results.map((r) => r.doc))
      : await spendingAggregate(context.cards.filter((c) => cardMatches(c, parsed.card)).map((c) => c.id), parsed);
  }

  const extras = {};
  if (parsed.intent === INTENTS.CARD_INFO) {
    const last = records.ledger.find((t) => t.type === 'card_payment' && t.senderId === userId)
      || plain(await Transaction.findOne({ where: { senderId: userId, type: 'card_payment' }, order: [['createdAt', 'DESC']] }));
    if (last) extras.lastBillPayment = { amount: last.amount, date: last.createdAt };
  }

  const top = results.slice(0, limit);
  const { answer, facts } = composeAnswer({
    parsed,
    fmt,
    records,
    results: top,
    candidates: (topicDriven ? results : ranked).map((r) => r.doc),
    candidateCount: topicDriven ? results.length : candidates.length,
    aggregate,
    topic,
    extras,
    orderedByRecency,
  });

  const tookMs = Date.now() - started;
  // Metadata only: the question text and the user's data are never logged.
  logger.info('Assistant query answered', {
    intent: parsed.intent,
    candidates: candidates.length,
    citations: top.length,
    embedder: embedder ? embedder.id : null,
    tookMs,
  });

  return {
    ...describeRequest(query, parsed),
    answer,
    facts,
    citations: top.map(toCitation),
    retrieval: {
      embedder: embedder ? { id: embedder.id, kind: embedder.kind } : null,
      fusion: { method: settings.fusion, keywordWeight: settings.keywordWeight, vectorWeight: round2(1 - settings.keywordWeight) },
      documents: documents.length,
      candidates: candidates.length,
      relevant: results.length,
      tookMs,
    },
  };
}

function describeRequest(query, parsed) {
  return {
    query,
    intent: parsed.intent,
    filters: {
      timeRange: parsed.timeRange
        ? { label: parsed.timeRange.label, start: parsed.timeRange.start.toISOString(), end: parsed.timeRange.end.toISOString() }
        : null,
      categories: parsed.categories,
      merchants: parsed.merchants,
      card: parsed.card,
      minAmount: parsed.minAmount ?? null,
      maxAmount: parsed.maxAmount ?? null,
      topicTerms: parsed.topicTerms,
    },
  };
}

module.exports = { answerQuery, selectCandidates, spendingAggregate, walletFilter, SUGGESTIONS };
