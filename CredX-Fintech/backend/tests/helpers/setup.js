const crypto = require('crypto');
const request = require('supertest');
const { sequelize } = require('../../src/models');
const { createApp } = require('../../src/app');

/** Random password that satisfies the password policy (generated per run, never hardcoded). */
const randomPassword = () => `Aa1-${crypto.randomBytes(12).toString('hex')}`;
const VALID_PASSWORD = randomPassword();

/** Fresh schema for the current test file's in-memory database. */
async function resetDatabase() {
  await sequelize.sync({ force: true });
}

async function closeDatabase() {
  await sequelize.close();
}

let counter = 0;

/** Registers and logs in a user through the API. */
async function signUp(app, overrides = {}) {
  counter += 1;
  const credentials = {
    name: overrides.name || `Test User ${counter}`,
    email: overrides.email || `user${counter}.${Date.now()}@example.com`,
    password: overrides.password || VALID_PASSWORD,
  };
  const registered = await request(app).post('/api/auth/register').send(credentials);
  if (registered.status !== 201) throw new Error(`register failed: ${registered.status} ${JSON.stringify(registered.body)}`);
  const login = await request(app).post('/api/auth/login').send({ email: credentials.email, password: credentials.password });
  if (login.status !== 200) throw new Error(`login failed: ${login.status} ${JSON.stringify(login.body)}`);
  return {
    ...credentials,
    user: login.body.user,
    accessToken: login.body.accessToken,
    refreshToken: login.body.refreshToken,
    auth: { Authorization: `Bearer ${login.body.accessToken}` },
  };
}

// Luhn-valid test numbers (published test PANs, not real cards).
const TEST_CARDS = {
  visa: '4242424242424242',
  mastercard: '5555555555554444',
  amex: '378282246310005',
};

async function addCard(app, auth, { type = 'credit', number = TEST_CARDS.visa, name = 'Test Holder', expiryDate = '12/39' } = {}) {
  const res = await request(app).post('/api/cards/create').set(auth).send({ type, name, cardNumber: number, expiryDate, cvv: '123' });
  if (res.status !== 201) throw new Error(`card create failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.card;
}

module.exports = { request, createApp, sequelize, resetDatabase, closeDatabase, signUp, addCard, randomPassword, TEST_CARDS, VALID_PASSWORD };
