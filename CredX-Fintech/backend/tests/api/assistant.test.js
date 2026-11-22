const { request, createApp, resetDatabase, closeDatabase, signUp, addCard, TEST_CARDS } = require('../helpers/setup');
const { Card, CardTransaction, Loan, Transaction, Wallet } = require('../../src/models');
const { createFormatter } = require('../../src/modules/assistant/format');

const fmt = createFormatter({ currency: 'INR', locale: 'en-IN', utcOffsetMinutes: 0 });

// Dates relative to "now" so calendar questions ("last month") stay deterministic.
const now = new Date();
const lastMonth = (day, hour = 12) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, day, hour));
const thisMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 30));
const daysAgo = (n) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

let app;
let alice;
let bob;
let aliceCredit;

async function seedCardTransactions(cardId, rows) {
  return CardTransaction.bulkCreate(rows.map((r) => ({
    cardId, status: 'approved', fraudScore: 0, isFraud: false, ...r, updatedAt: r.createdAt,
  })));
}

const ask = (session, query, extra = {}) =>
  request(app).post('/api/assistant/query').set(session.auth).send({ query, utcOffsetMinutes: 0, ...extra });

beforeAll(async () => {
  await resetDatabase();
  app = createApp();

  alice = await signUp(app, { name: 'Alice Example' });
  bob = await signUp(app, { name: 'Bob Example' });

  aliceCredit = await addCard(app, alice.auth, { type: 'credit', number: TEST_CARDS.visa });
  const aliceDebit = await addCard(app, alice.auth, { type: 'debit', number: TEST_CARDS.mastercard });
  await Card.update({ outstandingBalance: 5000, availableCredit: 20000, minimumDue: 250 }, { where: { id: aliceCredit.id } });

  await seedCardTransactions(aliceCredit.id, [
    // last month: food 450 + 300.50 counts; the declined one and the top-up do not
    { merchant: 'Swiggy', category: 'food', amount: 450, createdAt: lastMonth(3) },
    { merchant: 'Zomato', category: 'food', amount: 300.5, createdAt: lastMonth(10) },
    { merchant: 'Swiggy', category: 'food', amount: 999, status: 'declined', isFraud: true, fraudScore: 0.7, createdAt: lastMonth(11) },
    { merchant: 'Uber', category: 'transport', amount: 220, createdAt: lastMonth(12) },
    { merchant: 'Starbucks', category: 'food', amount: 0.5, createdAt: thisMonthStart }, // this month: excluded from "last month"
    { merchant: 'CredX Wallet top-up', category: 'wallet_topup', amount: 2000, createdAt: lastMonth(15) },
  ]);
  await seedCardTransactions(aliceDebit.id, [
    { merchant: 'Netflix', category: 'entertainment', amount: 649, createdAt: daysAgo(1) },
    { merchant: 'Amazon', category: 'shopping', amount: 1299, createdAt: daysAgo(2) },
  ]);

  await Loan.create({
    userId: alice.user.id, amount: 50000, interestRate: 12, tenureMonths: 12, emi: 4442.44,
    status: 'approved', remainingBalance: 44424.4, paidAmount: 8884.88,
  });
  await Wallet.update({ balance: 12345.67 }, { where: { userId: alice.user.id } });
  await Transaction.create({ senderId: alice.user.id, receiverId: bob.user.id, amount: 500, type: 'transfer', status: 'completed', description: 'Dinner split' });

  // Bob's data must never show up in Alice's answers.
  const bobCard = await addCard(app, bob.auth, { type: 'credit', number: TEST_CARDS.amex });
  await seedCardTransactions(bobCard.id, [
    { merchant: 'Swiggy', category: 'food', amount: 99999, createdAt: lastMonth(5) },
    { merchant: 'Zomato', category: 'food', amount: 88888, createdAt: daysAgo(1) },
  ]);
  await Loan.create({
    userId: bob.user.id, amount: 900000, interestRate: 8, tenureMonths: 24, emi: 40704.5,
    status: 'approved', remainingBalance: 976908, paidAmount: 0,
  });
});

afterAll(closeDatabase);

describe('POST /api/assistant/query', () => {
  test('"how much did I spend on food last month" sums only approved food purchases in that month', async () => {
    const res = await ask(alice, 'How much did I spend on food last month?');
    expect(res.status).toBe(200);
    expect(res.body.intent).toBe('spending_summary');
    expect(res.body.filters.categories).toEqual(['food']);
    expect(res.body.facts.total).toBe(750.5);
    expect(res.body.facts.count).toBe(2);
    expect(res.body.answer).toContain(fmt.money(750.5));
    expect(res.body.answer).toMatch(/last month/);
    expect(res.body.citations.map((c) => c.title).sort()).toEqual(['Swiggy', 'Zomato']);
    for (const citation of res.body.citations) {
      expect(citation).toEqual(expect.objectContaining({
        type: 'card_transaction',
        snippet: expect.any(String),
        scores: { keyword: expect.any(Number), vector: expect.any(Number), fused: expect.any(Number) },
      }));
    }
    expect(res.body.retrieval).toEqual(expect.objectContaining({
      embedder: { id: expect.stringMatching(/^hashing/), kind: 'hashing' },
      fusion: { method: 'weighted', keywordWeight: 0.4, vectorWeight: 0.6 },
    }));
  });

  test('"show my recent card transactions" lists the newest first', async () => {
    const res = await ask(alice, 'Show my recent card transactions');
    expect(res.body.intent).toBe('card_transactions');
    const dates = res.body.citations.map((c) => new Date(c.date).getTime());
    expect(dates).toEqual([...dates].sort((a, b) => b - a));
    expect(res.body.citations[0].title).toBe('Netflix');
    expect(res.body.citations).toHaveLength(5);
    expect(res.body.answer).toContain('Netflix');
  });

  test('"what\'s my loan EMI" quotes the EMI of the active loan', async () => {
    const res = await ask(alice, "What's my loan EMI?");
    expect(res.body.intent).toBe('loan_info');
    expect(res.body.answer).toContain(fmt.money(4442.44));
    expect(res.body.facts).toEqual(expect.objectContaining({ activeLoans: 1, totalEmi: 4442.44 }));
    expect(res.body.citations[0].type).toBe('loan');
  });

  test('"what\'s my credit limit" reports limit, available credit and dues', async () => {
    const res = await ask(alice, "What's my credit limit?");
    expect(res.body.intent).toBe('card_info');
    expect(res.body.facts).toEqual(expect.objectContaining({ creditCards: 1, totalAvailableCredit: 20000, totalOutstanding: 5000 }));
    expect(res.body.answer).toContain(fmt.money(aliceCredit.creditLimit));
    expect(res.body.answer).toContain('ending 4242');
  });

  test('dues, wallet balance, transfers and fraud questions', async () => {
    const due = await ask(alice, 'how much do I owe on my credit card');
    expect(due.body.answer).toContain(fmt.money(5000));
    expect(due.body.answer).toContain(fmt.money(250));

    const wallet = await ask(alice, "what's my wallet balance");
    expect(wallet.body.facts.balance).toBe(12345.67);

    const sent = await ask(alice, 'show the transfers I sent');
    expect(sent.body.intent).toBe('wallet_activity');
    expect(sent.body.facts.totalOut).toBe(500);

    const fraud = await ask(alice, 'any suspicious transactions?');
    expect(fraud.body.intent).toBe('fraud_alerts');
    expect(fraud.body.facts.flagged).toBe(1);
    expect(fraud.body.citations[0].meta.status).toBe('declined');
  });

  test('merchant questions and bare topics', async () => {
    const res = await ask(alice, 'how much did I spend at Amazon');
    expect(res.body.filters.merchants).toEqual(['Amazon']);
    expect(res.body.facts.total).toBe(1299);

    const unknown = await ask(alice, 'how much did I spend on yoga');
    expect(unknown.body.facts.total).toBe(0);
    expect(unknown.body.answer).toMatch(/couldn't find/i);
    expect(unknown.body.citations).toHaveLength(0);
  });

  test("never returns another user's records", async () => {
    const aliceIds = new Set((await CardTransaction.findAll()).filter((t) => [aliceCredit.id].includes(t.cardId)).map((t) => t.id));
    for (const query of ['How much did I spend on food last month?', 'Show my recent card transactions', 'Zomato', "What's my loan EMI?", 'swiggy']) {
      const res = await ask(alice, query);
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('99999');
      expect(body).not.toContain('88888');
      expect(body).not.toContain(fmt.money(40704.5));
      for (const citation of res.body.citations.filter((c) => c.type === 'card_transaction')) {
        const id = citation.id.split(':')[1];
        const row = await CardTransaction.findByPk(id);
        const card = await Card.findByPk(row.cardId);
        expect(card.userId).toBe(alice.user.id);
        if (row.cardId === aliceCredit.id) expect(aliceIds.has(id)).toBe(true);
      }
    }
    const bobView = await ask(bob, 'How much did I spend on food last month?');
    expect(bobView.body.facts.total).toBe(99999);
  });

  test('card numbers in citations are masked', async () => {
    const res = await ask(alice, 'what cards do I have');
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(TEST_CARDS.visa);
    expect(body).not.toContain(TEST_CARDS.mastercard);
    expect(res.body.citations.every((c) => c.type === 'card')).toBe(true);
  });

  test('greetings get help and suggestions', async () => {
    const res = await ask(alice, 'hello');
    expect(res.body.intent).toBe('help');
    expect(res.body.suggestions.length).toBeGreaterThan(3);
  });

  test('topK limits the number of citations', async () => {
    const res = await ask(alice, 'Show my recent card transactions', { topK: 2 });
    expect(res.body.citations).toHaveLength(2);
  });

  test('requires authentication and validates the body', async () => {
    expect((await request(app).post('/api/assistant/query').send({ query: 'hi' })).status).toBe(401);
    expect((await ask(alice, '')).status).toBe(400);
    expect((await ask(alice, 'x'.repeat(501))).status).toBe(400);
    expect((await ask(alice, 'hi', { utcOffsetMinutes: 5000 })).status).toBe(400);
  });

  test('is rate limited per user', async () => {
    const limited = createApp({ rateLimit: { assistantMax: 2 } });
    const send = (session) => request(limited).post('/api/assistant/query').set(session.auth).send({ query: 'hi' });
    expect((await send(alice)).status).toBe(200);
    expect((await send(alice)).status).toBe(200);
    expect((await send(alice)).status).toBe(429);
    expect((await send(bob)).status).toBe(200); // separate budget per user
  });
});

describe('assistant metadata routes', () => {
  test('suggestions and status', async () => {
    const suggestions = await request(app).get('/api/assistant/suggestions').set(alice.auth);
    expect(suggestions.body.suggestions).toContain('How much did I spend on food last month?');
    const status = await request(app).get('/api/assistant/status').set(alice.auth);
    expect(status.body).toEqual({ provider: 'hashing', model: null, state: 'disabled', active: expect.stringMatching(/^hashing/) });
  });
});
