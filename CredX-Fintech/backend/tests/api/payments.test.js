const { request, createApp, resetDatabase, closeDatabase, signUp, addCard, TEST_CARDS } = require('../helpers/setup');
const { sequelize, User, Wallet, Card, Transaction, CardTransaction } = require('../../src/models');

let app;

beforeAll(async () => {
  await resetDatabase();
  app = createApp();
});

afterAll(closeDatabase);

const walletBalance = async (userId) => (await Wallet.findOne({ where: { userId } })).balance;

/** User with a credit card that has `spent` outstanding and `funded` in the wallet. */
async function cardholder({ spent = 1000, funded = 1500 } = {}) {
  const session = await signUp(app);
  const card = await addCard(app, session.auth, { type: 'credit' });
  if (spent) {
    const spend = await request(app).post('/api/cards/spend').set(session.auth).send({ cardId: card.id, amount: spent, merchant: 'Amazon' });
    expect(spend.status).toBe(200);
  }
  if (funded) {
    const top = await request(app).post('/api/wallet/add-money').set(session.auth).send({ amount: funded });
    expect(top.status).toBe(200);
  }
  return { session, card: (await Card.findByPk(card.id)).toJSON() };
}

describe('card data protection', () => {
  test('full card numbers and CVVs are never stored or returned', async () => {
    const session = await signUp(app);
    const created = await addCard(app, session.auth, { type: 'debit', number: TEST_CARDS.mastercard });
    expect(created.maskedNumber).toBe('**** **** **** 4444');
    expect(created).toEqual(expect.objectContaining({ last4: '4444', brand: 'MASTERCARD' }));

    for (const res of [
      await request(app).get('/api/cards').set(session.auth),
      await request(app).get(`/api/cards/${created.id}`).set(session.auth),
    ]) {
      const body = JSON.stringify(res.body);
      expect(res.status).toBe(200);
      expect(body).not.toContain(TEST_CARDS.mastercard);
      expect(body).not.toMatch(/cvv|cardNumber|fingerprint/i);
    }

    const columns = await sequelize.getQueryInterface().describeTable('Cards');
    expect(columns.cardNumber).toBeUndefined();
    expect(columns.cvv).toBeUndefined();
    const raw = await sequelize.query('SELECT * FROM "Cards"', { type: 'SELECT' });
    expect(JSON.stringify(raw)).not.toContain(TEST_CARDS.mastercard);
  });

  test('invalid card numbers, expired cards and duplicates are rejected', async () => {
    const session = await signUp(app);
    const bad = await request(app).post('/api/cards/create').set(session.auth)
      .send({ type: 'credit', name: 'Holder', cardNumber: '4242424242424241', expiryDate: '12/39', cvv: '123' });
    expect(bad.status).toBe(400);
    const expired = await request(app).post('/api/cards/create').set(session.auth)
      .send({ type: 'credit', name: 'Holder', cardNumber: TEST_CARDS.visa, expiryDate: '01/20', cvv: '123' });
    expect(expired.status).toBe(400);
    await addCard(app, session.auth);
    const duplicate = await request(app).post('/api/cards/create').set(session.auth)
      .send({ type: 'credit', name: 'Holder', cardNumber: TEST_CARDS.visa, expiryDate: '12/39', cvv: '123' });
    expect(duplicate.status).toBe(409);
  });

  test("other users' cards and card transactions are not accessible", async () => {
    const owner = await cardholder({ spent: 200, funded: 0 });
    const intruder = await signUp(app);
    const { id } = owner.card;
    expect((await request(app).get(`/api/cards/${id}`).set(intruder.auth)).status).toBe(404);
    expect((await request(app).get(`/api/cards/${id}/transactions`).set(intruder.auth)).status).toBe(404);
    expect((await request(app).post('/api/cards/simulate').set(intruder.auth).send({ cardId: id, count: 3 })).status).toBe(404);
    expect((await request(app).post('/api/cards/pay-bill').set(intruder.auth).send({ cardId: id, amount: 10 })).status).toBe(404);
  });
});

describe('paying a credit card bill from the wallet', () => {
  test('moves money atomically and records a ledger entry', async () => {
    const { session, card } = await cardholder({ spent: 1000, funded: 1500 });
    expect(card.outstandingBalance).toBe(1000);

    const res = await request(app).post('/api/cards/pay-bill').set(session.auth).send({ cardId: card.id, amount: 600 });
    expect(res.status).toBe(200);
    expect(res.body.walletBalance).toBe(900);
    expect(res.body.card).toEqual(expect.objectContaining({
      outstandingBalance: 400,
      availableCredit: card.creditLimit - 400,
    }));

    expect(await walletBalance(session.user.id)).toBe(900);
    const ledger = await Transaction.findAll({ where: { senderId: session.user.id, type: 'card_payment' } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toEqual(expect.objectContaining({ amount: 600, referenceId: card.id, status: 'completed' }));

    const history = await request(app).get('/api/transactions/history?type=card_payment').set(session.auth);
    expect(history.body).toHaveLength(1);
    expect(history.body[0].direction).toBe('debit');
  });

  test('omitting the amount pays the full outstanding balance', async () => {
    const { session, card } = await cardholder({ spent: 750.25, funded: 1000 });
    const res = await request(app).post('/api/cards/pay-bill').set(session.auth).send({ cardId: card.id });
    expect(res.status).toBe(200);
    expect(res.body.card.outstandingBalance).toBe(0);
    expect(res.body.card.minimumDue).toBe(0);
    expect(res.body.walletBalance).toBe(249.75);
  });

  test('insufficient funds and overpayment change nothing', async () => {
    const { session, card } = await cardholder({ spent: 1000, funded: 100 });
    const poor = await request(app).post('/api/cards/pay-bill').set(session.auth).send({ cardId: card.id, amount: 500 });
    expect(poor.status).toBe(400);
    expect(poor.body.code).toBe('INSUFFICIENT_FUNDS');
    const over = await request(app).post('/api/cards/pay-bill').set(session.auth).send({ cardId: card.id, amount: 5000 });
    expect(over.body.code).toBe('OVERPAYMENT');

    expect(await walletBalance(session.user.id)).toBe(100);
    expect((await Card.findByPk(card.id)).outstandingBalance).toBe(1000);
    expect(await Transaction.count({ where: { senderId: session.user.id, type: 'card_payment' } })).toBe(0);
  });

  test('a failure in the middle of the payment rolls everything back', async () => {
    const { session, card } = await cardholder({ spent: 1000, funded: 1500 });
    const spy = jest.spyOn(Transaction, 'create').mockRejectedValueOnce(new Error('simulated ledger failure'));

    const res = await request(app).post('/api/cards/pay-bill').set(session.auth).send({ cardId: card.id, amount: 600 });
    expect(res.status).toBe(500);
    expect(res.body).toEqual(expect.objectContaining({ code: 'INTERNAL_ERROR' }));
    expect(JSON.stringify(res.body)).not.toContain('simulated ledger failure');
    spy.mockRestore();

    expect(await walletBalance(session.user.id)).toBe(1500);
    expect((await Card.findByPk(card.id)).outstandingBalance).toBe(1000);
  });

  test('debit cards have no bill to pay and amounts are validated', async () => {
    const session = await signUp(app);
    const debit = await addCard(app, session.auth, { type: 'debit' });
    const res = await request(app).post('/api/cards/pay-bill').set(session.auth).send({ cardId: debit.id, amount: 10 });
    expect(res.body.code).toBe('NOT_A_CREDIT_CARD');
    for (const amount of [-5, 0, 'abc', 10.555]) {
      const invalid = await request(app).post('/api/cards/pay-bill').set(session.auth).send({ cardId: debit.id, amount });
      expect(invalid.status).toBe(400);
    }
  });
});

describe('card spending', () => {
  test('debit purchases draw from the wallet; credit purchases use available credit', async () => {
    const session = await signUp(app);
    const debit = await addCard(app, session.auth, { type: 'debit', number: TEST_CARDS.mastercard });
    await request(app).post('/api/wallet/add-money').set(session.auth).send({ amount: 300 });

    const ok = await request(app).post('/api/cards/spend').set(session.auth).send({ cardId: debit.id, amount: 120, merchant: 'Swiggy' });
    expect(ok.status).toBe(200);
    expect(ok.body.walletBalance).toBe(180);
    expect(ok.body.transaction.category).toBe('food');

    const tooMuch = await request(app).post('/api/cards/spend').set(session.auth).send({ cardId: debit.id, amount: 500 });
    expect(tooMuch.body.code).toBe('INSUFFICIENT_FUNDS');
    expect(await walletBalance(session.user.id)).toBe(180);
  });

  test('a purchase flagged by the fraud engine is declined before money moves and the card is frozen', async () => {
    const { session, card } = await cardholder({ spent: 100, funded: 0 });
    const before = (await Card.findByPk(card.id)).toJSON();
    const res = await request(app).post('/api/cards/spend').set(session.auth).send({ cardId: card.id, amount: 9000, merchant: 'Unknown' });
    expect(res.status).toBe(402);
    expect(res.body).toEqual(expect.objectContaining({ code: 'TRANSACTION_DECLINED', isFraud: true }));

    const after = (await Card.findByPk(card.id)).toJSON();
    expect(after.status).toBe('frozen');
    expect(after.outstandingBalance).toBe(before.outstandingBalance);
    const declined = await CardTransaction.findOne({ where: { cardId: card.id, status: 'declined' } });
    expect(declined.isFraud).toBe(true);

    const frozen = await request(app).post('/api/cards/spend').set(session.auth).send({ cardId: card.id, amount: 10 });
    expect(frozen.body.code).toBe('CARD_FROZEN');
  });
});

describe('wallet transfers and loans', () => {
  test('transfers move money between wallets in one transaction', async () => {
    const alice = await signUp(app);
    const bob = await signUp(app);
    await request(app).post('/api/wallet/add-money').set(alice.auth).send({ amount: 1000 });

    const res = await request(app).post('/api/transactions/transfer').set(alice.auth).send({ receiverEmail: bob.email.toUpperCase(), amount: 250.5 });
    expect(res.status).toBe(200);
    expect(res.body.balance).toBe(749.5);
    expect(await walletBalance(bob.user.id)).toBe(250.5);

    // the legacy wallet route accepts { email } as well
    const legacy = await request(app).post('/api/wallet/transfer').set(alice.auth).send({ email: bob.email, amount: 49.5 });
    expect(legacy.status).toBe(200);
    expect(await walletBalance(bob.user.id)).toBe(300);

    expect((await request(app).post('/api/transactions/transfer').set(alice.auth).send({ receiverEmail: alice.email, amount: 1 })).body.code).toBe('SELF_TRANSFER');
    expect((await request(app).post('/api/transactions/transfer').set(alice.auth).send({ receiverEmail: bob.email, amount: 99999 })).status).toBe(400);
  });

  test('loan disbursement and EMI payment go through the ledger', async () => {
    const session = await signUp(app);
    await User.update({ credit_score: 760 }, { where: { id: session.user.id } });

    const quote = await request(app).get('/api/loans/quote?amount=100000&tenureMonths=12').set(session.auth);
    expect(quote.body).toEqual(expect.objectContaining({ eligible: true, interestRate: 8, emi: 8698.84 }));

    const loan = await request(app).post('/api/loans/apply').set(session.auth).send({ amount: 100000, tenureMonths: 12 });
    expect(loan.status).toBe(201);
    expect(loan.body.walletBalance).toBe(100000);
    expect(loan.body.loan.remainingBalance).toBeCloseTo(8698.84 * 12, 2);

    const emi = await request(app).post('/api/loans/pay').set(session.auth).send({ loanId: loan.body.loan.id });
    expect(emi.status).toBe(200);
    expect(emi.body.walletBalance).toBe(91301.16);
    const types = (await Transaction.findAll({ where: { referenceId: loan.body.loan.id } })).map((t) => t.type).sort();
    expect(types).toEqual(['emi_payment', 'loan_disbursement']);
  });

  test('low credit scores are rejected', async () => {
    const session = await signUp(app);
    const res = await request(app).post('/api/loans/apply').set(session.auth).send({ amount: 1000, tenureMonths: 6 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LOAN_REJECTED');
  });
});
