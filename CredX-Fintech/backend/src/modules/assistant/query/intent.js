/**
 * Rule-based query understanding for the assistant.
 *
 * parseQuery() turns a natural-language question into a structured request:
 *   intent       what kind of answer is wanted (see INTENTS)
 *   timeRange    [start, end) from expressions like "last month" (timeRange.js)
 *   categories   spending categories mentioned directly or via synonyms
 *   merchants    merchant names from the user's own history found in the query
 *   card         card filter: type (credit/debit), brand, last 4 digits
 *   minAmount / maxAmount, limit, wantsRecent
 *   topicTerms   remaining content words; when nothing structured matched
 *                they drive retrieval-based filtering (see assistant.service)
 *
 * Intent detection is a weighted keyword/regex vote: every rule that
 * matches adds its weight to its intent and the highest total wins (ties go
 * to the earlier intent in INTENT_PRIORITY). It is deterministic and unit
 * tested; retrieval (BM25 + embeddings) then ranks the user's records within
 * the scope the intent selects.
 */
const { normalize, tokenize, stem } = require('../retrieval/tokenizer');
const { parseTimeRange } = require('./timeRange');

const INTENTS = Object.freeze({
  HELP: 'help',
  SPENDING_SUMMARY: 'spending_summary',
  CARD_TRANSACTIONS: 'card_transactions',
  WALLET_ACTIVITY: 'wallet_activity',
  WALLET_BALANCE: 'wallet_balance',
  CARD_INFO: 'card_info',
  LOAN_INFO: 'loan_info',
  FRAUD_ALERTS: 'fraud_alerts',
  CREDIT_SCORE: 'credit_score',
  GENERAL: 'general',
});

// Used to break ties between equally scored intents.
const INTENT_PRIORITY = [
  INTENTS.FRAUD_ALERTS,
  INTENTS.LOAN_INFO,
  INTENTS.CREDIT_SCORE,
  INTENTS.SPENDING_SUMMARY,
  INTENTS.WALLET_ACTIVITY,
  INTENTS.CARD_INFO,
  INTENTS.WALLET_BALANCE,
  INTENTS.CARD_TRANSACTIONS,
  INTENTS.HELP,
];

/** [intent, pattern, weight] - patterns run against the normalised query. */
const INTENT_RULES = [
  [INTENTS.FRAUD_ALERTS, /\b(fraud\w*|suspicious|flagged|declined|unusual|scam\w*|unauthori[sz]ed|blocked transactions?)\b/, 4],

  [INTENTS.LOAN_INFO, /\b(loans?|emis?|instal+ments?|borrow\w*|repay\w*|tenure|interest rate|principal)\b/, 4],

  [INTENTS.CREDIT_SCORE, /\bcredit score\b/, 5],
  [INTENTS.CREDIT_SCORE, /\b(cibil|credit rating|score)\b/, 2],

  [INTENTS.CARD_INFO, /\b(credit )?limits?\b/, 3],
  [INTENTS.CARD_INFO, /\bavailable credit\b/, 4],
  [INTENTS.CARD_INFO, /\boutstanding\b/, 3],
  [INTENTS.CARD_INFO, /\b(minimum|min) (amount )?due\b/, 4],
  [INTENTS.CARD_INFO, /\bcard balance\b/, 4],
  [INTENTS.CARD_INFO, /\b(card )?bills?\b/, 2],
  [INTENTS.CARD_INFO, /\b(due|owe)\b/, 2],
  // "what cards do I have", "list my cards" - unless the question is about their transactions.
  [INTENTS.CARD_INFO, /^(?!.*\b(transactions?|purchases?|spen[dt]|spending|charges?)\b).*(\b(my|all|which|what) cards\b|\bcards? (status|details)\b|\bhow many cards\b|\bcards do i have\b)/, 3],
  [INTENTS.CARD_INFO, /\b(frozen|freeze|expir\w*)\b/, 2],
  [INTENTS.CARD_INFO, /\b(credit|debit) cards?\b/, 1],

  [INTENTS.WALLET_BALANCE, /\bwallet balance\b/, 5],
  [INTENTS.WALLET_BALANCE, /\bbalance\b/, 2],
  [INTENTS.WALLET_BALANCE, /\bhow much (money )?(do i have|is in my wallet|is left)\b/, 3],
  [INTENTS.WALLET_BALANCE, /\bwallet\b/, 1],

  [INTENTS.WALLET_ACTIVITY, /\b(transfers?|transferred)\b/, 3],
  [INTENTS.WALLET_ACTIVITY, /\b(sent|send|received|receive)\b/, 3],
  [INTENTS.WALLET_ACTIVITY, /\b(deposits?|deposited|top ?ups?|topped up|added money|add money)\b/, 3],
  [INTENTS.WALLET_ACTIVITY, /\bwallet (transactions?|activity|history|movements?)\b/, 4],
  [INTENTS.WALLET_ACTIVITY, /\b(ledger|disburse\w*)\b/, 3],

  [INTENTS.SPENDING_SUMMARY, /\bhow much\b.*\b(spen[dt]|spending|pa(y|id)|cost)\b/, 4],
  [INTENTS.SPENDING_SUMMARY, /\b(spen[dt]|spending|expenses?|expenditure)\b/, 3],
  [INTENTS.SPENDING_SUMMARY, /\b(total|sum|breakdown)\b/, 1],
  [INTENTS.SPENDING_SUMMARY, /\b(top|biggest|largest|most) (categor\w*|merchants?)\b|\bwhere did (i|my money)\b/, 3],

  [INTENTS.CARD_TRANSACTIONS, /\b(card )?transactions?\b/, 2],
  [INTENTS.CARD_TRANSACTIONS, /\b(purchases?|purchased|charges?|charged|buy|bought|orders?)\b/, 2],
  [INTENTS.CARD_TRANSACTIONS, /\b(recent|latest|last|newest)\b/, 1],
  [INTENTS.CARD_TRANSACTIONS, /\b(history|activity)\b/, 1],

  [INTENTS.HELP, /^(hi|hello|hey|help|thanks|thank you)\b/, 3],
  [INTENTS.HELP, /\bwhat (can|do) (you|i) (do|ask)\b|\bhow (do|does) (this|you) work\b/, 5],
];

/** Category synonyms (phrases matched on word boundaries). */
const CATEGORY_SYNONYMS = {
  // Only words that mean the whole category. Narrower words ("coffee",
  // "pizza") are left as topic terms so retrieval finds the matching
  // records instead of summing every food purchase.
  food: ['food', 'foods', 'dining', 'dine', 'dined', 'restaurant', 'restaurants', 'eating out', 'eat out', 'meal', 'meals', 'takeout', 'takeaway', 'food delivery'],
  groceries: ['grocery', 'groceries', 'supermarket', 'supermarkets', 'vegetables'],
  shopping: ['shopping', 'shop', 'clothes', 'clothing', 'apparel', 'fashion', 'online shopping'],
  transport: ['transport', 'transportation', 'commute', 'commuting', 'cab', 'cabs', 'taxi', 'taxis', 'ride', 'rides'],
  travel: ['travel', 'trip', 'trips', 'flight', 'flights', 'hotel', 'hotels', 'vacation', 'holiday', 'holidays'],
  entertainment: ['entertainment', 'movie', 'movies', 'streaming', 'subscription', 'subscriptions', 'music', 'games', 'gaming'],
  utilities: ['utilities', 'utility', 'utility bills', 'electricity', 'internet', 'broadband', 'phone bill', 'mobile recharge', 'recharge'],
  health: ['health', 'healthcare', 'medical', 'medicine', 'medicines', 'pharmacy', 'doctor', 'hospital'],
  electronics: ['electronics', 'gadget', 'gadgets', 'laptop', 'laptops'],
  fuel: ['fuel', 'petrol', 'gas station', 'diesel'],
  education: ['education', 'course', 'courses', 'tuition', 'books'],
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const CATEGORY_PATTERNS = Object.entries(CATEGORY_SYNONYMS).map(([category, words]) => [
  category,
  new RegExp(`\\b(${words.map(escapeRegExp).join('|')})\\b`),
]);

const BRANDS = { visa: 'VISA', mastercard: 'MASTERCARD', 'master card': 'MASTERCARD', amex: 'AMEX', 'american express': 'AMEX', rupay: 'RUPAY', discover: 'DISCOVER' };

/**
 * Words that describe the question rather than its topic (stemmed). Whatever
 * is left after removing these, stop words, dates, categories and merchants
 * is the "topic" of the query.
 */
const NON_TOPIC = new Set([
  'spend', 'spent', 'spending', 'expens', 'expense', 'expenditure', 'total', 'sum', 'breakdown', 'cost', 'pay', 'paid', 'payment',
  'transaction', 'purchas', 'purchase', 'charg', 'charge', 'buy', 'bought', 'order', 'card', 'credit', 'debit', 'wallet', 'money',
  'amount', 'recent', 'latest', 'last', 'newest', 'history', 'activity', 'today', 'yesterday', 'week', 'month', 'year', 'day',
  'past', 'previous', 'current', 'far', 'date', 'ytd', 'top', 'biggest', 'largest', 'most', 'categor', 'category', 'merchant',
  'over', 'above', 'under', 'below', 'more', 'less', 'greater', 'least', 'rs', 'inr', 'rupee', 'dollar', 'usd', 'ending', 'end',
  'visa', 'mastercard', 'master', 'amex', 'american', 'express', 'rupay', 'discover', 'need', 'want', 'know', 'tell', 'find',
  'only', 'every', 'each', 'ever', 'time', 'times', 'there', 'anything', 'something', 'thing', 'stuff', 'also', 'again', 'now',
  'did', 'done', 'make', 'made', 'go', 'went', 'use', 'used', 'using', 'fun', 'way', 'lot', 'much', 'many', 'number', 'count',
  'ago', 'since', 'per', 'via', 'month', 'months', 'weeks', 'days', 'years', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'twelve', 'thirty', 'first', 'second', 'third', 'off', 'out', 'up', 'down', 'cash', 'deal', 'jan',
  'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec', 'january', 'february', 'march', 'april', 'may',
  'june', 'july', 'august', 'september', 'october', 'november', 'december',
  // vocabulary of the other intents
  'send', 'sent', 'receive', 'received', 'transfer', 'transferred', 'deposit', 'deposited', 'topup', 'topped', 'added', 'add',
  'balance', 'left', 'loan', 'emi', 'instalment', 'installment', 'interest', 'tenure', 'borrow', 'borrowed', 'repay', 'owe',
  'score', 'limit', 'available', 'outstanding', 'due', 'minimum', 'min', 'bill', 'fraud', 'fraudulent', 'suspicious', 'flagged',
  'declined', 'unusual', 'blocked', 'frozen', 'freeze', 'status', 'detail', 'details', 'show', 'list', 'help', 'hi', 'hello',
  'hey', 'thanks', 'thank', 'account', 'profile', 'ledger', 'movement', 'movements', 'record', 'records', 'entry', 'entries',
].map((w) => stem(w)));

function scoreIntents(q) {
  const scores = {};
  for (const [intent, pattern, weight] of INTENT_RULES) {
    if (pattern.test(q)) scores[intent] = (scores[intent] || 0) + weight;
  }
  return scores;
}

function pickIntent(scores) {
  let best = INTENTS.GENERAL;
  let bestScore = 0;
  for (const intent of INTENT_PRIORITY) {
    const score = scores[intent] || 0;
    if (score > bestScore) {
      best = intent;
      bestScore = score;
    }
  }
  return best;
}

function detectCategories(q) {
  return CATEGORY_PATTERNS.filter(([, pattern]) => pattern.test(q)).map(([category]) => category);
}

/**
 * Finds merchants from the user's own history that the query mentions:
 * the full name ("domino's pizza"), or its first distinctive word ("uber").
 * Longer full-name matches win over first-word matches.
 */
function detectMerchants(q, merchants = []) {
  const queryTokens = new Set(tokenize(q));
  const full = [];
  const partial = [];
  for (const merchant of new Set(merchants.filter(Boolean))) {
    const name = normalize(merchant).replace(/[^a-z0-9]+/g, ' ').trim();
    if (!name) continue;
    if (new RegExp(`\\b${escapeRegExp(name)}\\b`).test(q.replace(/[^a-z0-9]+/g, ' '))) {
      full.push(merchant);
      continue;
    }
    const [first] = tokenize(name);
    if (first && first.length >= 3 && queryTokens.has(first)) partial.push(merchant);
  }
  if (!full.length) return partial;
  // "uber eats" names Uber Eats, not also Uber: drop names contained in a longer match.
  const key = (m) => ` ${normalize(m).replace(/[^a-z0-9]+/g, ' ').trim()} `;
  return full.filter((m) => !full.some((other) => key(other).length > key(m).length && key(other).includes(key(m))));
}

function detectCard(q) {
  const card = {};
  const last4 = q.match(/\b(?:ending(?: in| with)?|last 4(?: digits)?|card|xx+|\*+)\s*(\d{4})\b/);
  if (last4) card.last4 = last4[1];
  for (const [word, brand] of Object.entries(BRANDS)) {
    if (new RegExp(`\\b${word}\\b`).test(q)) card.brand = brand;
  }
  if (/\bcredit cards?\b/.test(q)) card.type = 'credit';
  else if (/\bdebit cards?\b/.test(q)) card.type = 'debit';
  return Object.keys(card).length ? card : null;
}

function detectAmounts(q) {
  const amountRe = '(?:rs\\.?|inr|usd|\\$|₹)?\\s*(\\d[\\d,]*(?:\\.\\d+)?)';
  const toNum = (s) => Number(s.replace(/,/g, ''));
  const result = {};
  const min = q.match(new RegExp(`\\b(?:over|above|more than|greater than|at least|exceeding|bigger than|larger than)\\s*${amountRe}`));
  if (min) result.minAmount = toNum(min[1]);
  const max = q.match(new RegExp(`\\b(?:under|below|less than|at most|smaller than|cheaper than)\\s*${amountRe}`));
  if (max) result.maxAmount = toNum(max[1]);
  return result;
}

function detectLimit(q) {
  const nouns = '(?:card )?(?:transactions?|purchases?|payments?|transfers?|charges?|records?|items?|entries)';
  const m =
    // "last 3 transactions" / "top 5", but not "last 3 months" (a time range).
    q.match(/\b(?:last|latest|recent|top|first|newest|previous)\s+(\d{1,2})\b(?!\s+(?:days?|weeks?|months?|years?)\b)/) ||
    q.match(new RegExp(`\\b(\\d{1,2})\\s+(?:most recent|latest|recent|last|newest)?\\s*${nouns}`));
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 50 ? n : null;
}

/**
 * @param {string} query raw user question
 * @param {{ now?: Date, utcOffsetMinutes?: number, merchants?: string[] }} [context]
 */
function parseQuery(query, { now = new Date(), utcOffsetMinutes = 0, merchants = [] } = {}) {
  const q = normalize(query).replace(/\s+/g, ' ').trim();
  const scores = scoreIntents(q);
  let intent = pickIntent(scores);

  const timeRange = parseTimeRange(q, { now, utcOffsetMinutes });
  const categories = detectCategories(q);
  const detectedMerchants = detectMerchants(q, merchants);
  const card = detectCard(q);
  const { minAmount, maxAmount } = detectAmounts(q);
  const limit = detectLimit(q);
  const wantsRecent = /\b(recent|recently|latest|last|newest|lately)\b/.test(q) && !timeRange;

  // A bare topic ("netflix", "coffee last week") is a request about spending on it.
  if (intent === INTENTS.GENERAL && (categories.length || detectedMerchants.length)) {
    intent = INTENTS.SPENDING_SUMMARY;
  }
  // "show my recent purchases at amazon" lists; "how much ... amazon" sums.
  if (intent === INTENTS.CARD_INFO && (categories.length || detectedMerchants.length) && scores[INTENTS.SPENDING_SUMMARY]) {
    intent = INTENTS.SPENDING_SUMMARY;
  }

  const excluded = new Set([
    ...NON_TOPIC,
    ...tokenize(timeRange ? timeRange.phrase : ''),
    ...categories.flatMap((c) => CATEGORY_SYNONYMS[c].flatMap((w) => tokenize(w))),
    ...detectedMerchants.flatMap((m) => tokenize(m)),
  ]);
  // Original words (not stems) so answers can quote them back to the user.
  const topicTerms = [...new Set(
    tokenize(q, { stem: false }).filter((t) => !excluded.has(stem(t)) && !excluded.has(t) && !/^\d+$/.test(t)),
  )];

  return {
    query: String(query),
    normalized: q,
    intent,
    intentScores: scores,
    timeRange,
    categories,
    merchants: detectedMerchants,
    card,
    minAmount,
    maxAmount,
    limit,
    wantsRecent,
    topicTerms,
  };
}

module.exports = {
  parseQuery,
  INTENTS,
  CATEGORY_SYNONYMS,
  detectCategories,
  detectMerchants,
  detectCard,
  detectAmounts,
  detectLimit,
  scoreIntents,
  pickIntent,
};
