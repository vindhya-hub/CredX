const { parseQuery, INTENTS, detectAmounts, detectLimit, detectCard, detectMerchants } = require('../../src/modules/assistant/query/intent');
const { parseTimeRange } = require('../../src/modules/assistant/query/timeRange');

const NOW = new Date('2026-11-22T10:00:00Z');
const MERCHANTS = ['Swiggy', 'Zomato', 'Amazon', 'Uber', 'Uber Eats', "Domino's Pizza", 'Netflix'];
const parse = (q, options = {}) => parseQuery(q, { now: NOW, utcOffsetMinutes: 0, merchants: MERCHANTS, ...options });

describe('intent detection', () => {
  test.each([
    ['How much did I spend on food last month?', INTENTS.SPENDING_SUMMARY],
    ['Show my recent card transactions', INTENTS.CARD_TRANSACTIONS],
    ["What's my loan EMI?", INTENTS.LOAN_INFO],
    ["What's my credit limit?", INTENTS.CARD_INFO],
    ['How much do I owe on my credit card', INTENTS.CARD_INFO],
    ['credit card balance', INTENTS.CARD_INFO],
    ["what's my wallet balance", INTENTS.WALLET_BALANCE],
    ['show my transfers', INTENTS.WALLET_ACTIVITY],
    ['recent wallet transactions', INTENTS.WALLET_ACTIVITY],
    ['any suspicious transactions?', INTENTS.FRAUD_ALERTS],
    ["what's my credit score", INTENTS.CREDIT_SCORE],
    ['hi', INTENTS.HELP],
    ['what can you do', INTENTS.HELP],
    ['netflix', INTENTS.SPENDING_SUMMARY], // bare known merchant
    ['tell me something interesting', INTENTS.GENERAL],
  ])('%s -> %s', (query, intent) => {
    expect(parse(query).intent).toBe(intent);
  });
});

describe('filters', () => {
  test('category and calendar month from "food last month"', () => {
    const p = parse('How much did I spend on food last month?');
    expect(p.categories).toEqual(['food']);
    expect(p.timeRange.start.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(p.timeRange.end.toISOString()).toBe('2026-11-01T00:00:00.000Z');
    expect(p.timeRange.label).toBe('last month (October 2026)');
    expect(p.topicTerms).toEqual([]);
  });

  test('category synonyms map to categories', () => {
    expect(parse('how much on restaurants this week').categories).toEqual(['food']);
    expect(parse('spending on cabs').categories).toEqual(['transport']);
    expect(parse('groceries and fuel').categories).toEqual(['groceries', 'fuel']);
  });

  test('merchants come from the user history, full names before first-word matches', () => {
    expect(parse('how much did I spend at amazon').merchants).toEqual(['Amazon']);
    expect(parse('uber eats orders').merchants).toEqual(['Uber Eats']);
    expect(parse('uber rides').merchants).toEqual(['Uber']);
    expect(parse('show uber').merchants).toEqual(['Uber']);
    expect(parse('what did I buy at dominos').merchants).toEqual(["Domino's Pizza"]);
    expect(detectMerchants('starbucks', [])).toEqual([]);
  });

  test('unknown topics are kept (unstemmed) for retrieval', () => {
    const p = parse('how much did I spend on yoga classes this year');
    expect(p.intent).toBe(INTENTS.SPENDING_SUMMARY);
    expect(p.topicTerms).toEqual(['yoga', 'classes']);
    expect(p.timeRange.label).toBe('this year');
  });

  test('card filters: type, brand and last four digits', () => {
    expect(detectCard('transactions on my visa')).toEqual({ brand: 'VISA' });
    expect(detectCard('card ending in 4242')).toEqual({ last4: '4242' });
    expect(detectCard('my debit card')).toEqual({ type: 'debit' });
    expect(detectCard('spent on food')).toBeNull();
  });

  test('amount bounds and result limits', () => {
    expect(detectAmounts('transactions over 500')).toEqual({ minAmount: 500 });
    expect(detectAmounts('purchases under rs 1,200.50')).toEqual({ maxAmount: 1200.5 });
    expect(detectLimit('show my last 3 transactions')).toBe(3);
    expect(detectLimit('10 most recent purchases')).toBe(10);
    expect(detectLimit('spending in the last 3 months')).toBeNull();
  });

  test('"recent" without a date asks for recency ordering', () => {
    expect(parse('show my recent card transactions').wantsRecent).toBe(true);
    expect(parse('show card transactions last week').wantsRecent).toBe(false);
  });
});

describe('time ranges', () => {
  const range = (text, options = {}) => parseTimeRange(text, { now: NOW, ...options });
  const iso = (r) => [r.start.toISOString(), r.end.toISOString()];

  test('today, yesterday and rolling windows', () => {
    expect(iso(range('today'))).toEqual(['2026-11-22T00:00:00.000Z', NOW.toISOString()]);
    expect(iso(range('yesterday'))).toEqual(['2026-11-21T00:00:00.000Z', '2026-11-22T00:00:00.000Z']);
    expect(iso(range('in the last 7 days'))).toEqual(['2026-11-15T10:00:00.000Z', NOW.toISOString()]);
    expect(range('past three months').start.toISOString()).toBe('2026-08-22T10:00:00.000Z');
  });

  test('calendar weeks start on Monday', () => {
    // 2026-11-22 is a Sunday
    expect(iso(range('this week'))).toEqual(['2026-11-16T00:00:00.000Z', NOW.toISOString()]);
    expect(iso(range('last week'))).toEqual(['2026-11-09T00:00:00.000Z', '2026-11-16T00:00:00.000Z']);
  });

  test('months and years', () => {
    expect(iso(range('this month'))).toEqual(['2026-11-01T00:00:00.000Z', NOW.toISOString()]);
    expect(iso(range('last year'))).toEqual(['2025-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']);
    expect(iso(range('spent in october'))).toEqual(['2026-10-01T00:00:00.000Z', '2026-11-01T00:00:00.000Z']);
    expect(iso(range('in december'))).toEqual(['2025-12-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z']); // future month -> last year
    expect(iso(range('march 2025'))).toEqual(['2025-03-01T00:00:00.000Z', '2025-04-01T00:00:00.000Z']);
  });

  test('"may" is only a month in date context', () => {
    expect(range('may I see my spending')).toBeNull();
    expect(range('spending in may').label).toBe('in May 2026');
  });

  test('boundaries follow the user time zone', () => {
    // 02:00 UTC on 1 Nov is already 07:30 on 1 Nov in India (+05:30)...
    const early = new Date('2026-11-01T02:00:00Z');
    const india = parseTimeRange('last month', { now: early, utcOffsetMinutes: 330 });
    expect(iso(india)).toEqual(['2026-09-30T18:30:00.000Z', '2026-10-31T18:30:00.000Z']);
    // ...but still 31 Oct in New York (-05:00), so "last month" is September there.
    const ny = parseTimeRange('last month', { now: early, utcOffsetMinutes: -300 });
    expect(iso(ny)).toEqual(['2026-09-01T05:00:00.000Z', '2026-10-01T05:00:00.000Z']);
  });

  test('returns null without a time expression', () => {
    expect(range('show my transactions')).toBeNull();
  });
});
