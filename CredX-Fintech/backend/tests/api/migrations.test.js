/**
 * Boot-time schema upgrade against a database created by the original
 * version of CredX (full card numbers + CVVs stored, NOT NULL ledger
 * columns, no categories, FLOAT money columns).
 */
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { request, createApp, closeDatabase, randomPassword, TEST_CARDS } = require('../helpers/setup');
const { sequelize } = require('../../src/models');
const { prepareDatabase } = require('../../src/db/migrations');

const ids = {
  user: crypto.randomUUID(),
  other: crypto.randomUUID(),
  wallet: crypto.randomUUID(),
  card: crypto.randomUUID(),
  txA: crypto.randomUUID(),
  txB: crypto.randomUUID(),
  transfer: crypto.randomUUID(),
};
const password = randomPassword();
const qi = () => sequelize.getQueryInterface();

async function createLegacySchema() {
  await sequelize.getQueryInterface().dropAllTables();
  const now = new Date().toISOString();
  const statements = [
    `CREATE TABLE "Users" ("id" UUID PRIMARY KEY, "name" VARCHAR(255) NOT NULL, "email" VARCHAR(255) NOT NULL UNIQUE,
      "password" VARCHAR(255) NOT NULL, "role" TEXT DEFAULT 'user', "credit_score" INTEGER DEFAULT 600,
      "kyc_status" TEXT DEFAULT 'pending', "risk_rating" FLOAT DEFAULT 0, "account_status" TEXT DEFAULT 'active',
      "createdAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL)`,
    `CREATE TABLE "Wallets" ("id" UUID PRIMARY KEY, "balance" FLOAT DEFAULT 0, "currency" VARCHAR(255) DEFAULT 'USD',
      "createdAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL, "userId" UUID REFERENCES "Users" ("id"))`,
    `CREATE TABLE "Cards" ("id" UUID PRIMARY KEY, "userId" UUID NOT NULL, "cardNumber" VARCHAR(255) NOT NULL,
      "maskedNumber" VARCHAR(255), "cvv" VARCHAR(255), "expiryDate" VARCHAR(255), "cardType" VARCHAR(255) NOT NULL,
      "creditLimit" FLOAT DEFAULT 0, "availableCredit" FLOAT DEFAULT 0, "outstandingBalance" FLOAT DEFAULT 0,
      "minimumDue" FLOAT DEFAULT 0, "billingDate" DATETIME, "status" VARCHAR(255) DEFAULT 'active',
      "createdAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL)`,
    `CREATE TABLE "CardTransactions" ("id" UUID PRIMARY KEY, "cardId" UUID NOT NULL, "amount" FLOAT NOT NULL,
      "merchant" VARCHAR(255), "fraudScore" FLOAT DEFAULT 0, "isFraud" TINYINT(1) DEFAULT 0,
      "createdAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL)`,
    `CREATE TABLE "Transactions" ("id" UUID PRIMARY KEY, "senderId" UUID NOT NULL, "receiverId" UUID NOT NULL,
      "amount" FLOAT NOT NULL, "type" VARCHAR(255) DEFAULT 'transfer', "status" VARCHAR(255) DEFAULT 'completed',
      "fraud_score" FLOAT DEFAULT 0, "createdAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL)`,
    `CREATE TABLE "Loans" ("id" UUID PRIMARY KEY, "userId" UUID NOT NULL, "amount" FLOAT NOT NULL, "interestRate" FLOAT NOT NULL,
      "tenureMonths" INTEGER NOT NULL, "emi" FLOAT NOT NULL, "status" VARCHAR(255) DEFAULT 'pending',
      "remainingBalance" FLOAT NOT NULL, "paidAmount" FLOAT DEFAULT 0, "createdAt" DATETIME NOT NULL, "updatedAt" DATETIME NOT NULL)`,
  ];
  for (const sql of statements) await sequelize.query(sql);

  const hash = await bcrypt.hash(password, 4);
  const insert = (sql, replacements) => sequelize.query(sql, { replacements });
  await insert(`INSERT INTO "Users" VALUES (:id, 'Legacy User', 'legacy@example.com', :hash, 'user', 700, 'pending', 0, 'active', :now, :now)`, { id: ids.user, hash, now });
  await insert(`INSERT INTO "Users" VALUES (:id, 'Other User', 'other@example.com', :hash, 'user', 600, 'pending', 0, 'active', :now, :now)`, { id: ids.other, hash, now });
  await insert(`INSERT INTO "Wallets" VALUES (:id, 1000, 'USD', :now, :now, :userId)`, { id: ids.wallet, userId: ids.user, now });
  await insert(`INSERT INTO "Cards" VALUES (:id, :userId, :pan, '4242 **** **** 4242', '123', '12/39', 'credit', 100000, 100000, 0, 0, NULL, 'active', :now, :now)`,
    { id: ids.card, userId: ids.user, pan: TEST_CARDS.visa, now });
  await insert(`INSERT INTO "CardTransactions" VALUES (:id, :cardId, 450, 'Amazon', 0, 0, :now, :now)`, { id: ids.txA, cardId: ids.card, now });
  await insert(`INSERT INTO "CardTransactions" VALUES (:id, :cardId, 220, 'Uber', 0, 0, :now, :now)`, { id: ids.txB, cardId: ids.card, now });
  await insert(`INSERT INTO "Transactions" VALUES (:id, :s, :r, 100, 'transfer', 'completed', 0.1, :now, :now)`, { id: ids.transfer, s: ids.user, r: ids.other, now });
}

beforeAll(async () => {
  await createLegacySchema();
});

afterAll(closeDatabase);

describe('prepareDatabase on a legacy schema (safe mode)', () => {
  beforeAll(async () => {
    await prepareDatabase(sequelize, { mode: 'safe' });
  });

  test('removes stored card numbers and CVVs, keeping masked data', async () => {
    const columns = await qi().describeTable('Cards');
    expect(columns.cardNumber).toBeUndefined();
    expect(columns.cvv).toBeUndefined();
    const [card] = await sequelize.query('SELECT * FROM "Cards"', { type: 'SELECT' });
    expect(card).toEqual(expect.objectContaining({ maskedNumber: '**** **** **** 4242', last4: '4242', brand: 'VISA' }));
    expect(card.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(card)).not.toContain(TEST_CARDS.visa);
  });

  test('adds new columns, relaxes ledger NOT NULLs and categorises old purchases', async () => {
    const users = await qi().describeTable('Users');
    expect(users.tokenVersion).toBeDefined();
    const ledger = await qi().describeTable('Transactions');
    expect(ledger.senderId.allowNull).toBe(true);
    expect(ledger.receiverId.allowNull).toBe(true);
    const rows = await sequelize.query('SELECT "merchant", "category", "status" FROM "CardTransactions" ORDER BY "merchant"', { type: 'SELECT' });
    expect(rows).toEqual([
      { merchant: 'Amazon', category: 'shopping', status: 'approved' },
      { merchant: 'Uber', category: 'transport', status: 'approved' },
    ]);
    expect(await qi().describeTable('RefreshTokens')).toBeDefined();
  });

  test('is idempotent', async () => {
    await expect(prepareDatabase(sequelize, { mode: 'safe' })).resolves.toBeUndefined();
  });

  test('legacy users can log in and use the upgraded data', async () => {
    const app = createApp();
    const login = await request(app).post('/api/auth/login').send({ email: 'legacy@example.com', password });
    expect(login.status).toBe(200);
    const auth = { Authorization: `Bearer ${login.body.accessToken}` };

    const cards = await request(app).get('/api/cards').set(auth);
    expect(cards.body[0].maskedNumber).toBe('**** **** **** 4242');

    const deposit = await request(app).post('/api/wallet/add-money').set(auth).send({ amount: 50 });
    expect(deposit.status).toBe(200); // ledger row with no sender (was NOT NULL)

    const answer = await request(app).post('/api/assistant/query').set(auth).send({ query: 'how much did I spend at amazon' });
    expect(answer.body.facts.total).toBe(450);
  });
});

describe('prepareDatabase modes', () => {
  test('"none" leaves the schema alone', async () => {
    await createLegacySchema();
    await prepareDatabase(sequelize, { mode: 'none' });
    expect((await qi().describeTable('Cards')).cardNumber).toBeDefined();
  });

  test('"alter" upgrades the legacy schema without losing rows (SQLite runs it additively)', async () => {
    await createLegacySchema();
    // Sequelize's SQLite alter rebuilds tables; dropping "Users" would cascade-delete
    // the cards. prepareDatabase therefore never runs a destructive alter on SQLite.
    await prepareDatabase(sequelize, { mode: 'alter' });
    await prepareDatabase(sequelize, { mode: 'alter' }); // e.g. the next boot
    const columns = await qi().describeTable('Cards');
    expect(columns.cardNumber).toBeUndefined();
    expect(columns.cvv).toBeUndefined();
    expect(columns.last4).toBeDefined();
    const cards = await sequelize.query('SELECT "userId", "last4", "brand" FROM "Cards"', { type: 'SELECT' });
    expect(cards).toEqual([{ userId: ids.user, last4: '4242', brand: 'VISA' }]);
    expect(await sequelize.query('SELECT "id" FROM "CardTransactions"', { type: 'SELECT' })).toHaveLength(2);
  });
});
