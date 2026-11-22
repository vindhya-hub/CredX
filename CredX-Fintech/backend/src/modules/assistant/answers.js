/**
 * Templated answers. Every number in an answer comes from the user's records
 * (exact SQL aggregates or the retrieved documents) - nothing is generated
 * by a language model, so answers cannot invent amounts.
 */
const { INTENTS } = require('./query/intent');
const { round2 } = require('../../utils/money');
const { loanPricingFor } = require('../../utils/creditPolicy');

const plural = (n, word, pluralWord = `${word}s`) => `${n} ${n === 1 ? word : pluralWord}`;
const joinAnd = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const SUGGESTIONS = [
  'How much did I spend on food last month?',
  'Show my recent card transactions',
  "What's my loan EMI?",
  "What's my credit limit?",
  "What's my wallet balance?",
  'How much did I spend this month?',
  'Any suspicious transactions?',
  'Show my transfers from the last 30 days',
  "What's my credit score?",
];

/** " on food & dining", " at Swiggy", ' matching "yoga"', or "". */
function scopePhrase(ctx) {
  const { parsed, fmt, topic } = ctx;
  if (parsed.merchants.length) return ` at ${joinAnd(parsed.merchants)}`;
  if (parsed.categories.length) return ` on ${joinAnd(parsed.categories.map((c) => fmt.category(c)))}`;
  if (topic && topic.terms.length) return ` matching "${topic.terms.join(' ')}"`;
  return '';
}

function cardPhrase(parsed) {
  const { card } = parsed;
  if (!card) return '';
  const parts = [card.brand, card.type, 'card'].filter(Boolean).join(' ');
  return ` with your ${parts}${card.last4 ? ` ending ${card.last4}` : ''}`;
}

const timePhrase = (parsed, fallback = '') => (parsed.timeRange ? ` ${parsed.timeRange.label}` : fallback);

function amountPhrase(parsed, fmt) {
  const parts = [];
  if (parsed.minAmount !== undefined) parts.push(`over ${fmt.money(parsed.minAmount)}`);
  if (parsed.maxAmount !== undefined) parts.push(`under ${fmt.money(parsed.maxAmount)}`);
  return parts.length ? ` ${parts.join(' and ')}` : '';
}

const shortDate = (fmt, value) => fmt.date(value).replace(/ \d{4}$/, '');

function listItems(results, fmt, max = 5) {
  return results.slice(0, max).map(({ doc }) => {
    if (doc.type === 'card_transaction') return `${fmt.money(doc.amount)} at ${doc.title} (${shortDate(fmt, doc.date)})`;
    if (doc.type === 'wallet_transaction') {
      const sign = doc.meta.direction === 'debit' ? '−' : '+';
      return `${sign}${fmt.money(doc.amount)} ${doc.title.toLowerCase()} (${shortDate(fmt, doc.date)})`;
    }
    return doc.snippet;
  });
}

// ---------------------------------------------------------------------------

function helpAnswer() {
  return {
    answer:
      'I can answer questions about your own CredX data: card spending by category, merchant or period, ' +
      'recent card transactions, your cards and credit limits, loans and EMIs, your wallet balance and transfers, ' +
      'fraud alerts and your credit score. Try one of the suggestions.',
    facts: { suggestions: SUGGESTIONS },
  };
}

function spendingAnswer(ctx) {
  const { parsed, fmt, aggregate, topic } = ctx;
  const scope = scopePhrase(ctx);
  const when = timePhrase(parsed, ' in total');
  const card = cardPhrase(parsed);
  const amounts = amountPhrase(parsed, fmt);

  if (topic && topic.terms.length && !topic.matched) {
    return {
      answer: `I couldn't find any card purchases${scope}${timePhrase(parsed)}${card}. Try a category (food, travel, shopping...) or a merchant name.`,
      facts: { total: 0, count: 0 },
    };
  }
  if (!aggregate.count) {
    return {
      answer: `I couldn't find any approved card spending${scope}${amounts}${when}${card}.`,
      facts: { total: 0, count: 0, byCategory: [], byMerchant: [] },
    };
  }

  let answer = `You spent ${fmt.money(aggregate.total)}${scope}${amounts}${when}${card} across ${plural(aggregate.count, 'card purchase')}.`;
  if (topic && topic.terms.length) {
    answer = `I found ${plural(aggregate.count, 'card purchase')} that match "${topic.terms.join(' ')}"${timePhrase(parsed)}${card} ` +
      `(keyword or semantic match), totalling ${fmt.money(aggregate.total)}.`;
  }
  if (!parsed.categories.length && !parsed.merchants.length && aggregate.byCategory.length > 1) {
    const top = aggregate.byCategory.slice(0, 3).map((c) => `${fmt.category(c.category)} ${fmt.money(c.total)}`);
    answer += ` Top categories: ${top.join(', ')}.`;
  } else if (!parsed.merchants.length && aggregate.byMerchant.length > 1) {
    const top = aggregate.byMerchant.slice(0, 3).map((m) => `${m.merchant} ${fmt.money(m.total)}`);
    answer += ` Top merchants: ${top.join(', ')}.`;
  }
  return { answer, facts: aggregate };
}

function cardTransactionsAnswer(ctx) {
  const { parsed, fmt, results, candidateCount, topic } = ctx;
  const scope = scopePhrase(ctx);
  const when = timePhrase(parsed);
  const card = cardPhrase(parsed);
  const amounts = amountPhrase(parsed, fmt);

  if (!results.length) {
    const none = candidateCount === 0 && !scope && !when && !card && !amounts
      ? "You don't have any card transactions yet. Add a card and make a purchase, or use \"Simulate transactions\" on a card's page."
      : `I couldn't find any card transactions${scope}${amounts}${when}${card}.`;
    return { answer: none, facts: { count: 0 } };
  }

  const shown = results.length;
  const items = listItems(results, fmt);
  const total = round2(results.reduce((sum, r) => sum + (r.doc.amount || 0), 0));
  const order = ctx.orderedByRecency ? 'most recent' : 'most relevant';
  const heading = topic && topic.terms.length
    ? `Card transactions that best match "${topic.terms.join(' ')}"${when}${card}`
    : `Your ${shown === 1 ? order : `${shown} ${order}`} card transaction${shown === 1 ? '' : 's'}${scope}${amounts}${when}${card}`;
  return {
    answer: `${heading}: ${items.join('; ')}.${shown > 1 ? ` Together: ${fmt.money(total)}.` : ''}`,
    facts: { count: shown, matching: candidateCount, total },
  };
}

function walletActivityAnswer(ctx) {
  const { parsed, fmt, results, candidates } = ctx;
  const when = timePhrase(parsed);
  if (!candidates.length) {
    return { answer: `I couldn't find any wallet transactions${when}.`, facts: { count: 0 } };
  }
  const out = candidates.filter((d) => d.meta.direction === 'debit');
  const inc = candidates.filter((d) => d.meta.direction === 'credit');
  const sum = (docs) => round2(docs.reduce((s, d) => s + d.amount, 0));
  const parts = [];
  if (out.length) parts.push(`${fmt.money(sum(out))} went out in ${plural(out.length, 'transaction')}`);
  if (inc.length) parts.push(`${fmt.money(sum(inc))} came in across ${plural(inc.length, 'transaction')}`);
  const items = listItems(results, fmt, 4);
  return {
    answer: `${cap(when.trim()) || 'Overall'}, ${joinAnd(parts)}. ${ctx.orderedByRecency ? 'Most recent' : 'Best matches'}: ${items.join('; ')}.`,
    facts: { count: candidates.length, totalOut: sum(out), totalIn: sum(inc) },
  };
}

function walletBalanceAnswer(ctx) {
  const { records, fmt, candidates } = ctx;
  const balance = records.wallet ? records.wallet.balance : 0;
  const latest = candidates
    .filter((d) => d.type === 'wallet_transaction')
    .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
  let answer = `Your wallet balance is ${fmt.money(balance)}.`;
  if (latest) {
    const sign = latest.meta.direction === 'debit' ? '−' : '+';
    answer += ` Last movement: ${sign}${fmt.money(latest.amount)} (${latest.title.toLowerCase()}) on ${fmt.date(latest.date)}.`;
  }
  return { answer, facts: { balance } };
}

function cardInfoAnswer(ctx) {
  const { parsed, fmt, records, candidates } = ctx;
  const cards = candidates.filter((d) => d.type === 'card');
  if (!records.cards.length) {
    return { answer: "You don't have any cards yet. You can add a debit or credit card on the Cards page.", facts: { cards: 0 } };
  }
  if (!cards.length) return { answer: "I couldn't find a card matching that.", facts: { cards: 0 } };

  const q = parsed.normalized;
  const credit = cards.filter((d) => d.meta.cardType === 'credit');
  const wantsDue = /\b(due|owe|outstanding|bill|bills|pay off|payable)\b/.test(q);
  const wantsList = /\b(frozen|freeze|status|expir\w*|how many|which|my cards|all cards|list)\b/.test(q) && !wantsDue;
  const facts = {
    cards: cards.length,
    creditCards: credit.length,
    totalCreditLimit: round2(credit.reduce((s, d) => s + d.meta.creditLimit, 0)),
    totalAvailableCredit: round2(credit.reduce((s, d) => s + d.meta.availableCredit, 0)),
    totalOutstanding: round2(credit.reduce((s, d) => s + d.meta.outstandingBalance, 0)),
    totalMinimumDue: round2(credit.reduce((s, d) => s + d.meta.minimumDue, 0)),
  };

  if (wantsList || !credit.length) {
    const lines = cards.map((d) => `${d.title} (${d.meta.status})`);
    let answer = `You have ${plural(cards.length, 'card')}: ${lines.join('; ')}.`;
    if (!credit.length) answer += ' Debit cards draw from your wallet, so they have no credit limit.';
    const frozen = cards.filter((d) => d.meta.status !== 'active');
    if (frozen.length) answer += ` ${frozen.length === 1 ? 'One card is' : `${frozen.length} cards are`} frozen; you can unfreeze from the Cards page.`;
    return { answer, facts };
  }

  if (wantsDue) {
    if (!facts.totalOutstanding) {
      return { answer: `You have nothing outstanding on your ${plural(credit.length, 'credit card')}.`, facts };
    }
    const lines = credit
      .filter((d) => d.meta.outstandingBalance > 0)
      .map((d) => `${fmt.money(d.meta.outstandingBalance)} on your ${d.title} (minimum due ${fmt.money(d.meta.minimumDue)})`);
    let answer = `You owe ${joinAnd(lines)}.`;
    if (lines.length > 1) answer += ` Total outstanding: ${fmt.money(facts.totalOutstanding)}.`;
    const lastPayment = ctx.extras.lastBillPayment;
    if (lastPayment) answer += ` Your last bill payment was ${fmt.money(lastPayment.amount)} on ${fmt.date(lastPayment.date)}.`;
    return { answer, facts };
  }

  const lines = credit.map((d) =>
    `${d.title}: limit ${fmt.money(d.meta.creditLimit)}, available ${fmt.money(d.meta.availableCredit)}, outstanding ${fmt.money(d.meta.outstandingBalance)}`);
  const answer = credit.length === 1
    ? `Your ${credit[0].title} has a credit limit of ${fmt.money(facts.totalCreditLimit)} with ${fmt.money(facts.totalAvailableCredit)} available (outstanding ${fmt.money(facts.totalOutstanding)}, minimum due ${fmt.money(facts.totalMinimumDue)}).`
    : `Across your ${plural(credit.length, 'credit card')} your total credit limit is ${fmt.money(facts.totalCreditLimit)} with ${fmt.money(facts.totalAvailableCredit)} available. ${lines.join('; ')}.`;
  return { answer, facts };
}

function loanAnswer(ctx) {
  const { fmt, records } = ctx;
  const active = records.loans.filter((l) => l.status !== 'closed' && l.remainingBalance > 0);
  const closed = records.loans.length - active.length;
  const pricing = records.user ? loanPricingFor(records.user.credit_score) : null;

  if (!records.loans.length) {
    const eligibility = pricing
      ? ` With your credit score of ${records.user.credit_score} you're eligible at ${pricing.interestRate}% interest.`
      : records.user ? ` A credit score of at least 650 is needed to apply (yours is ${records.user.credit_score}).` : '';
    return { answer: `You don't have any loans.${eligibility}`, facts: { activeLoans: 0 } };
  }
  if (!active.length) {
    return { answer: `You have no active loans; your ${plural(closed, 'previous loan')} ${closed === 1 ? 'is' : 'are'} fully repaid.`, facts: { activeLoans: 0, closedLoans: closed } };
  }

  const describe = (l) =>
    `${fmt.money(l.amount)} at ${l.interestRate}% for ${l.tenureMonths} months: EMI ${fmt.money(l.emi)}, remaining ${fmt.money(l.remainingBalance)} (paid ${fmt.money(l.paidAmount)})`;
  const totalEmi = round2(active.reduce((s, l) => s + l.emi, 0));
  const totalRemaining = round2(active.reduce((s, l) => s + l.remainingBalance, 0));
  const answer = active.length === 1
    ? `Your loan EMI is ${fmt.money(active[0].emi)} per month. Loan: ${describe(active[0])}.`
    : `You have ${active.length} active loans with a combined EMI of ${fmt.money(totalEmi)} per month and ${fmt.money(totalRemaining)} remaining. ${active.map(describe).join('; ')}.`;
  return { answer, facts: { activeLoans: active.length, closedLoans: closed, totalEmi, totalRemaining } };
}

function fraudAnswer(ctx) {
  const { parsed, fmt, results, candidates, records } = ctx;
  const when = timePhrase(parsed);
  const frozen = records.cards.filter((c) => c.status !== 'active');
  const frozenText = frozen.length
    ? ` ${frozen.length === 1 ? 'One of your cards is' : `${frozen.length} of your cards are`} frozen; you can review and unfreeze from the Cards page.`
    : '';
  if (!candidates.length) {
    return { answer: `No card transactions have been flagged as potential fraud${when}.${frozenText}`, facts: { flagged: 0, frozenCards: frozen.length } };
  }
  const items = listItems(results, fmt, 4);
  return {
    answer: `${plural(candidates.length, 'card transaction')} ${candidates.length === 1 ? 'was' : 'were'} flagged as potential fraud and declined${when}: ${items.join('; ')}.${frozenText}`,
    facts: { flagged: candidates.length, frozenCards: frozen.length },
  };
}

function creditScoreAnswer(ctx) {
  const { records } = ctx;
  if (!records.user) return { answer: "I couldn't load your profile.", facts: {} };
  const score = records.user.credit_score;
  const pricing = loanPricingFor(score);
  const loanText = pricing
    ? `it qualifies you for loans at ${pricing.interestRate}% interest${pricing.interestRate > 8 ? ' (750+ gets 8%)' : ''}`
    : 'loans need a score of at least 650';
  return { answer: `Your credit score is ${score}; ${loanText}.`, facts: { creditScore: score } };
}

function generalAnswer(ctx) {
  const { results } = ctx;
  if (!results.length) {
    return {
      answer: "I couldn't find anything in your account related to that. Try asking about your spending, card transactions, cards, loans or wallet.",
      facts: { matches: 0 },
    };
  }
  const lines = results.slice(0, 3).map(({ doc }) => doc.snippet);
  return { answer: `Here's what best matches your question: ${lines.join(' | ')}.`, facts: { matches: results.length } };
}

const COMPOSERS = {
  [INTENTS.HELP]: helpAnswer,
  [INTENTS.SPENDING_SUMMARY]: spendingAnswer,
  [INTENTS.CARD_TRANSACTIONS]: cardTransactionsAnswer,
  [INTENTS.WALLET_ACTIVITY]: walletActivityAnswer,
  [INTENTS.WALLET_BALANCE]: walletBalanceAnswer,
  [INTENTS.CARD_INFO]: cardInfoAnswer,
  [INTENTS.LOAN_INFO]: loanAnswer,
  [INTENTS.FRAUD_ALERTS]: fraudAnswer,
  [INTENTS.CREDIT_SCORE]: creditScoreAnswer,
  [INTENTS.GENERAL]: generalAnswer,
};

function composeAnswer(ctx) {
  const composer = COMPOSERS[ctx.parsed.intent] || generalAnswer;
  return composer(ctx);
}

module.exports = { composeAnswer, SUGGESTIONS };
