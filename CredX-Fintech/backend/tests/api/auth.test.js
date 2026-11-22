const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { request, createApp, resetDatabase, closeDatabase, signUp, randomPassword } = require('../helpers/setup');
const { User, RefreshToken } = require('../../src/models');
const config = require('../../src/config/config');

let app;

beforeAll(async () => {
  await resetDatabase();
  app = createApp();
});

afterAll(closeDatabase);

describe('registration and login', () => {
  test('registers a user with a bcrypt-hashed password and never returns the hash', async () => {
    const password = randomPassword();
    const res = await request(app).post('/api/auth/register').send({ name: 'Asha Rao', email: 'Asha@Example.com', password });

    expect(res.status).toBe(201);
    expect(res.body.user).toEqual(expect.objectContaining({ name: 'Asha Rao', email: 'asha@example.com', role: 'user' }));
    expect(res.body.user.password).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('$2');

    const stored = await User.findOne({ where: { email: 'asha@example.com' } });
    expect(stored.password).toMatch(/^\$2[aby]\$/);
    expect(stored.password).not.toContain(password);
    expect(bcrypt.getRounds(stored.password)).toBe(config.bcryptRounds);
    expect(await bcrypt.compare(password, stored.password)).toBe(true);
  });

  test('rejects duplicate emails case-insensitively', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'Dup', email: 'ASHA@example.com', password: randomPassword() });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('EMAIL_TAKEN');
  });

  test('validates input', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'X', email: 'not-an-email', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(res.body.details.map((d) => d.path)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  test('wrong password and unknown email get the same 401', async () => {
    const session = await signUp(app);
    const wrong = await request(app).post('/api/auth/login').send({ email: session.email, password: randomPassword() });
    const unknown = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: randomPassword() });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  test('malformed JSON is a 400, not a 500', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_JSON');
  });
});

describe('JWT access tokens', () => {
  let session;
  beforeAll(async () => {
    session = await signUp(app);
  });

  test('a valid access token reaches protected routes', async () => {
    const res = await request(app).get('/api/auth/profile').set(session.auth);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(session.email);
    expect(res.body.wallet).toEqual(expect.objectContaining({ balance: 0 }));
    expect(res.body.password).toBeUndefined();
  });

  test('missing, malformed and forged tokens are rejected', async () => {
    expect((await request(app).get('/api/auth/profile')).body.code).toBe('NO_TOKEN');
    expect((await request(app).get('/api/auth/profile').set('Authorization', 'Bearer nope')).body.code).toBe('INVALID_TOKEN');
    const forged = jwt.sign({ type: 'access', role: 'admin' }, 'x'.repeat(64), { subject: session.user.id, issuer: config.jwt.issuer, audience: config.jwt.audience });
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  test('a refresh token cannot be used as an access token', async () => {
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${session.refreshToken}`);
    expect(res.status).toBe(401);
  });

  test('expired access tokens are reported as TOKEN_EXPIRED', async () => {
    const expired = jwt.sign({ type: 'access', role: 'user' }, config.jwt.accessSecret, {
      subject: session.user.id, issuer: config.jwt.issuer, audience: config.jwt.audience, expiresIn: -10,
    });
    const res = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('TOKEN_EXPIRED');
  });

  test('non-admins cannot reach admin routes', async () => {
    const res = await request(app).get('/api/admin/users').set(session.auth);
    expect(res.status).toBe(403);
  });
});

describe('refresh token rotation', () => {
  test('refresh issues a new pair and the old refresh token becomes single-use', async () => {
    const session = await signUp(app);
    const first = await request(app).post('/api/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toEqual(expect.any(String));
    expect(first.body.refreshToken).not.toBe(session.refreshToken);

    const profile = await request(app).get('/api/auth/profile').set('Authorization', `Bearer ${first.body.accessToken}`);
    expect(profile.status).toBe(200);

    // Re-using the rotated token right away (another tab) is refused, other sessions stay valid.
    const again = await request(app).post('/api/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(again.status).toBe(401);
    const stillValid = await request(app).post('/api/auth/refresh').send({ refreshToken: first.body.refreshToken });
    expect(stillValid.status).toBe(200);
  });

  test('re-use of an old refresh token after the grace period revokes every session', async () => {
    const session = await signUp(app);
    const rotated = await request(app).post('/api/auth/refresh').send({ refreshToken: session.refreshToken });
    const { jti } = jwt.decode(session.refreshToken);
    await RefreshToken.update({ revokedAt: new Date(Date.now() - 60 * 60 * 1000) }, { where: { id: jti } });

    const reuse = await request(app).post('/api/auth/refresh').send({ refreshToken: session.refreshToken });
    expect(reuse.status).toBe(401);
    expect(reuse.body.message).toMatch(/reuse detected/i);

    const latest = await request(app).post('/api/auth/refresh').send({ refreshToken: rotated.body.refreshToken });
    expect(latest.status).toBe(401);
    const active = await RefreshToken.count({ where: { userId: session.user.id, revokedAt: null } });
    expect(active).toBe(0);
  });

  test('garbage and access tokens are not accepted as refresh tokens', async () => {
    const session = await signUp(app);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: 'x'.repeat(40) })).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: session.accessToken })).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').send({})).status).toBe(400);
  });

  test('logout revokes the session; logout-all revokes every session', async () => {
    const session = await signUp(app);
    const out = await request(app).post('/api/auth/logout').send({ refreshToken: session.refreshToken });
    expect(out.status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: session.refreshToken })).status).toBe(401);

    const login = await request(app).post('/api/auth/login').send({ email: session.email, password: session.password });
    const second = await request(app).post('/api/auth/login').send({ email: session.email, password: session.password });
    const all = await request(app).post('/api/auth/logout-all').set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(all.status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken })).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: second.body.refreshToken })).status).toBe(401);
  });
});

describe('password change and reset', () => {
  test('changing the password re-hashes it and revokes other sessions', async () => {
    const session = await signUp(app);
    const newPassword = randomPassword();
    const res = await request(app).post('/api/auth/change-password').set(session.auth)
      .send({ currentPassword: session.password, newPassword });
    expect(res.status).toBe(200);
    expect(res.body.refreshToken).toEqual(expect.any(String));

    expect((await request(app).post('/api/auth/login').send({ email: session.email, password: session.password })).status).toBe(401);
    expect((await request(app).post('/api/auth/login').send({ email: session.email, password: newPassword })).status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: session.refreshToken })).status).toBe(401);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: res.body.refreshToken })).status).toBe(200);
  });

  test('wrong current password is rejected', async () => {
    const session = await signUp(app);
    const res = await request(app).post('/api/auth/change-password').set(session.auth)
      .send({ currentPassword: randomPassword(), newPassword: randomPassword() });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_CURRENT_PASSWORD');
  });

  test('reset works only with the single-use token (email alone is not enough)', async () => {
    const session = await signUp(app);
    // The old endpoint accepted { email, newPassword } with no proof of ownership.
    const legacy = await request(app).post('/api/auth/forgot-password').send({ email: session.email, newPassword: randomPassword() });
    expect(legacy.status).toBe(200);
    expect((await request(app).post('/api/auth/login').send({ email: session.email, password: session.password })).status).toBe(200);

    const { resetToken } = legacy.body; // exposed only because AUTH_EXPOSE_RESET_TOKEN=true in tests
    expect(resetToken).toMatch(/^[0-9a-f]{64}$/);
    const stored = await User.findOne({ where: { email: session.email } });
    expect(stored.passwordResetTokenHash).not.toBe(resetToken);

    const newPassword = randomPassword();
    expect((await request(app).post('/api/auth/reset-password').send({ token: resetToken, newPassword })).status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({ token: resetToken, newPassword: randomPassword() })).status).toBe(400);
    expect((await request(app).post('/api/auth/login').send({ email: session.email, password: newPassword })).status).toBe(200);
  });

  test('forgot-password does not reveal whether an email is registered', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'ghost@example.com' });
    expect(res.status).toBe(200);
    expect(res.body.resetToken).toBeUndefined();
  });
});

describe('rate limiting', () => {
  test('auth endpoints have a stricter limit than the rest of the API', async () => {
    const limited = createApp({ rateLimit: { authMax: 3, max: 1000 } });
    const attempt = () => request(limited).post('/api/auth/login').send({ email: 'x@example.com', password: randomPassword() });
    for (let i = 0; i < 3; i += 1) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
    // Non-auth routes are still governed by the (higher) global limit.
    expect((await request(limited).get('/api/cards')).status).toBe(401);
  });

  test('a global limit applies to every /api route', async () => {
    const limited = createApp({ rateLimit: { max: 2 } });
    await request(limited).get('/api/cards');
    await request(limited).get('/api/cards');
    expect((await request(limited).get('/api/cards')).status).toBe(429);
  });
});

describe('CORS and security headers', () => {
  test('allows configured origins only', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const preflight = await request(app).options('/api/auth/login').set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    expect(preflight.status).toBe(403);
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();

    const denied = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('CORS_ORIGIN_DENIED');
  });

  test('origins come from configuration', async () => {
    const custom = createApp({ corsOrigins: ['https://app.example.com'] });
    const res = await request(custom).get('/api/health').set('Origin', 'https://app.example.com');
    expect(res.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect((await request(custom).get('/api/health').set('Origin', 'http://localhost:5173')).status).toBe(403);
  });

  test('helmet headers are set and x-powered-by is hidden', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-request-id']).toEqual(expect.any(String));
  });
});
