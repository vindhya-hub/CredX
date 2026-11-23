#!/usr/bin/env node
/**
 * npm run seed        demo user with sample cards, purchases, a loan and
 *                     wallet activity, for trying the dashboard and assistant.
 *
 * Credentials are never hardcoded:
 *   SEED_DEMO_EMAIL     required (backend/.env.example has a placeholder address)
 *   SEED_DEMO_PASSWORD  optional; when empty a random password is generated and
 *                       printed once (development only)
 *   SEED_ADMIN_EMAIL    optional; creates or promotes that user to admin
 *   SEED_ADMIN_PASSWORD optional; random + printed once when empty (development only)
 *
 * Refuses to run with NODE_ENV=production. Re-running is safe: existing users
 * keep their password, and sample data is only added to a demo user that has
 * no cards yet.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../src/config/config');
const { sequelize, connectDB } = require('../src/config/db');
const { prepareDatabase } = require('../src/db/migrations');
const { User, Wallet, Card, CardTransaction } = require('../src/models');
const walletService = require('../src/modules/wallet/wallet.service');
const calculateEMI = require('../src/utils/emiCalculator');
const generateCardNumber = require('../src/utils/cardGenerator');
const { generateExpiry } = require('../src/utils/cardDetailsGenerator');
const { maskPan, lastFour, detectBrand, fingerprint } = require('../src/utils/cardUtils');
const { categorizeMerchant } = require('../src/utils/categorizer');
const { creditLimitFor, loanPricingFor } = require('../src/utils/creditPolicy');
const { round2 } = require('../src/utils/money');

const MERCHANTS = [
  ['Swiggy', 150, 900], ['Zomato', 150, 900], ['Starbucks', 200, 600], ["Domino's Pizza", 300, 900],
  ['BigBasket', 400, 2500], ['Amazon', 300, 5000], ['Flipkart', 300, 4000], ['Myntra', 500, 3000],
  ['Uber', 100, 700], ['Ola', 100, 600], ['Netflix', 199, 649], ['Spotify', 119, 119], ['BookMyShow', 200, 1200],
  ['Shell', 500, 3000], ['Airtel', 299, 999], ['Apollo Pharmacy', 100, 1500], ['IndiGo', 3000, 9000],
];

const randomPassword = () => `${crypto.randomBytes(9).toString('base64url')}-${crypto.randomInt(10, 99)}A`;
const randomInt = (min, max) => crypto.randomInt(min, max + 1);
const daysAgo = (n, hour = randomInt(8, 21)) => {
  const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
  d.setUTCHours(hour, randomInt(0, 59), 0, 0);
  return d;
};

/** Finds or creates a user. Returns the user and the plain password if one was set now. */
async function ensureUser({ email, name, password: wanted, role = 'user' }) {
  const existing = await User.findOne({ where: { email } });
  if (existing) {
    if (role === 'admin' && existing.role !== 'admin') {
      existing.role = 'admin';
      await existing.save();
    }
    return { user: existing, created: false };
  }
  const password = wanted || randomPassword();
  const user = await sequelize.transaction(async (transaction) => {
    const created = await User.create({
      name, email, role, password: await bcrypt.hash(password, config.bcryptRounds), credit_score: 720,
    }, { transaction });
    await Wallet.create({ userId: created.id }, { transaction });
    return created;
  });
  return { user, created: true, generatedPassword: wanted ? null : password };
}

function cardAttributes(userId, type, prefix, holder) {
  const number = generateCardNumber(prefix); // demo number, used only to derive masked fields
  const limit = type === 'credit' ? creditLimitFor(720) : 0;
  return {
    userId,
    maskedNumber: maskPan(number),
    last4: lastFour(number),
    brand: detectBrand(number),
    fingerprint: fingerprint(number),
    cardHolderName: holder,
    expiryDate: generateExpiry(),
    cardType: type,
    creditLimit: limit,
    availableCredit: limit,
    outstandingBalance: 0,
    minimumDue: 0,
    status: 'active',
  };
}

async function seedDemoData(user) {
  if (await Card.count({ where: { userId: user.id } })) {
    console.log('  sample data already present; skipped');
    return;
  }
  const credit = await Card.create(cardAttributes(user.id, 'credit', '4', user.name));
  const debit = await Card.create(cardAttributes(user.id, 'debit', '5', user.name));

  // ~90 days of purchases spread over both cards
  const rows = [];
  for (let i = 0; i < 70; i += 1) {
    const [merchant, min, max] = MERCHANTS[randomInt(0, MERCHANTS.length - 1)];
    const createdAt = daysAgo(randomInt(0, 90));
    rows.push({
      cardId: i % 3 === 0 ? debit.id : credit.id,
      merchant,
      category: categorizeMerchant(merchant),
      amount: randomInt(min, max),
      status: 'approved',
      fraudScore: 0,
      isFraud: false,
      createdAt,
      updatedAt: createdAt,
    });
  }
  const flagged = daysAgo(6);
  rows.push({
    cardId: credit.id, merchant: 'Unknown Online Store', category: 'shopping', amount: 18999,
    status: 'declined', fraudScore: 0.7, isFraud: true, createdAt: flagged, updatedAt: flagged,
  });
  await CardTransaction.bulkCreate(rows);

  // The current statement: last 30 days of approved credit card purchases.
  const cutoff = daysAgo(30, 0);
  const outstanding = round2(rows
    .filter((r) => r.cardId === credit.id && r.status === 'approved' && r.createdAt >= cutoff)
    .reduce((sum, r) => sum + r.amount, 0));
  await credit.update({
    outstandingBalance: outstanding,
    availableCredit: round2(credit.creditLimit - outstanding),
    minimumDue: walletService.minimumDueFor(outstanding),
  });

  // Wallet activity through the same ledger service the API uses.
  await walletService.topUp({ userId: user.id, amount: 30000 });
  const { interestRate } = loanPricingFor(720);
  const emi = calculateEMI(60000, interestRate, 12);
  const { loan } = await walletService.disburseLoan({
    userId: user.id,
    loanAttributes: { amount: 60000, interestRate, tenureMonths: 12, emi, status: 'approved', remainingBalance: round2(emi * 12), paidAmount: 0 },
  });
  await walletService.payLoanEmi({ userId: user.id, loanId: loan.id });
  await walletService.payLoanEmi({ userId: user.id, loanId: loan.id });
  if (outstanding >= 2000) await walletService.payCardBill({ userId: user.id, cardId: credit.id, amount: 2000 });

  console.log(`  added 2 cards, ${rows.length} card transactions, 1 loan and wallet activity`);
}

async function main() {
  if (config.isProd) throw new Error('Refusing to seed demo data with NODE_ENV=production.');
  for (const warning of config.assertConfig()) console.warn(warning);

  const demoEmail = (process.env.SEED_DEMO_EMAIL || '').trim().toLowerCase();
  if (!demoEmail) throw new Error('Set SEED_DEMO_EMAIL (see backend/.env.example).');

  await connectDB({ retries: 3, delayMs: 2000 });
  await prepareDatabase(sequelize, { mode: config.db.sync });

  const demo = await ensureUser({ email: demoEmail, name: 'Demo User', password: process.env.SEED_DEMO_PASSWORD });
  console.log(`Demo user ${demoEmail}: ${demo.created ? 'created' : 'already exists (password unchanged)'}`);
  if (demo.generatedPassword) console.log(`  generated password (shown once, store it now): ${demo.generatedPassword}`);
  await seedDemoData(demo.user);

  const adminEmail = (process.env.SEED_ADMIN_EMAIL || '').trim().toLowerCase();
  if (adminEmail) {
    const admin = await ensureUser({ email: adminEmail, name: 'Administrator', password: process.env.SEED_ADMIN_PASSWORD, role: 'admin' });
    console.log(`Admin ${adminEmail}: ${admin.created ? 'created' : 'promoted/kept as admin (password unchanged)'}`);
    if (admin.generatedPassword) console.log(`  generated password (shown once, store it now): ${admin.generatedPassword}`);
  }
}

main()
  .then(() => sequelize.close())
  .catch(async (error) => {
    console.error(error.code === 'INVALID_CONFIG' ? error.message : `Seeding failed: ${error.message}`);
    await sequelize.close().catch(() => {});
    process.exit(1);
  });
