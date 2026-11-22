const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { fn, col, where } = require('sequelize');
const config = require('../../config/config');
const logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');
const { sequelize, User, Wallet } = require('../../models');
const {
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllSessions,
  pruneSessions,
} = require('./token.service');

const INVALID_CREDENTIALS = 'Invalid email or password';

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

/** Case-insensitive lookup so legacy mixed-case emails still match. */
const findUserByEmail = (email) => User.findOne({ where: where(fn('lower', col('email')), email.toLowerCase()) });

// Comparing against a dummy hash when the user does not exist keeps response
// times similar, so login timing does not reveal which emails are registered.
let dummyHash;
const getDummyHash = () => {
  if (!dummyHash) dummyHash = bcrypt.hash(crypto.randomBytes(16).toString('hex'), config.bcryptRounds);
  return dummyHash;
};

const hashPassword = (plain) => bcrypt.hash(plain, config.bcryptRounds);

// ================= REGISTER =================
exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  if (await findUserByEmail(email)) {
    throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  }

  const passwordHash = await hashPassword(password);

  // User and wallet are created atomically: no user can end up without a wallet.
  const user = await sequelize.transaction(async (transaction) => {
    const created = await User.create({ name, email, password: passwordHash }, { transaction });
    await Wallet.create({ userId: created.id }, { transaction });
    return created;
  });

  res.status(201).json({ message: 'User registered successfully', user });
};

// ================= LOGIN =================
exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await findUserByEmail(email);

  if (!user) {
    await bcrypt.compare(password, await getDummyHash());
    throw AppError.unauthorized(INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) throw AppError.unauthorized(INVALID_CREDENTIALS, 'INVALID_CREDENTIALS');

  if (user.account_status === 'suspended') {
    throw AppError.forbidden('This account has been suspended', 'ACCOUNT_SUSPENDED');
  }

  // Transparently upgrade hashes created with a lower bcrypt cost.
  if (bcrypt.getRounds(user.password) < config.bcryptRounds) {
    user.password = await hashPassword(password);
    await user.save({ fields: ['password'] });
  }

  await pruneSessions(user.id);
  res.json({ ...(await issueTokenPair(user)), user });
};

// ================= REFRESH (rotating, single use) =================
exports.refresh = async (req, res) => {
  const { tokens } = await rotateRefreshToken(req.body.refreshToken);
  res.json(tokens);
};

// ================= LOGOUT =================
// Revokes the session behind the given refresh token. Idempotent.
exports.logout = async (req, res) => {
  if (req.body.refreshToken) await revokeRefreshToken(req.body.refreshToken);
  res.json({ message: 'Logged out' });
};

// ================= LOGOUT EVERYWHERE =================
exports.logoutAll = async (req, res) => {
  await sequelize.transaction(async (transaction) => {
    await revokeAllSessions(req.user.id, { transaction });
    await User.increment('tokenVersion', { where: { id: req.user.id }, transaction });
  });
  res.json({ message: 'Logged out of all sessions' });
};

// ================= PROFILE =================
exports.getProfile = async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    include: [{ model: Wallet, as: 'wallet', attributes: ['balance', 'currency'] }],
  });
  if (!user) throw AppError.notFound('User not found');
  res.json(user);
};

// ================= CHANGE PASSWORD =================
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findByPk(req.user.id);
  if (!user) throw AppError.unauthorized();

  if (!(await bcrypt.compare(currentPassword, user.password))) {
    throw AppError.badRequest('Current password is incorrect', 'INVALID_CURRENT_PASSWORD');
  }

  user.password = await hashPassword(newPassword);
  user.tokenVersion += 1;

  // Signs out every other session; this device gets a fresh pair.
  const tokens = await sequelize.transaction(async (transaction) => {
    await user.save({ transaction });
    await revokeAllSessions(user.id, { transaction });
    return issueTokenPair(user, { transaction });
  });

  res.json({ message: 'Password changed successfully', ...tokens });
};

// ================= FORGOT PASSWORD =================
// Always answers the same way so the endpoint cannot be used to discover
// which emails have accounts. Stores only a hash of the single-use token.
exports.forgotPassword = async (req, res) => {
  const user = await findUserByEmail(req.body.email);
  const response = { message: 'If an account exists for that email, password reset instructions have been sent.' };

  if (user && user.account_status === 'active') {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + config.auth.resetTokenTtlMinutes * 60 * 1000);
    user.passwordResetTokenHash = sha256(token);
    user.passwordResetExpiresAt = expiresAt;
    await user.save();

    // No e-mail provider is configured in this project; delivery would hook in here.
    logger.info('Password reset requested', { userId: user.id });

    if (config.auth.exposeResetToken) {
      // Local demo only (AUTH_EXPOSE_RESET_TOKEN=true, never in production).
      response.resetToken = token;
      response.resetTokenExpiresAt = expiresAt.toISOString();
    }
  }

  res.json(response);
};

// ================= RESET PASSWORD =================
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;
  const user = await User.findOne({ where: { passwordResetTokenHash: sha256(token) } });

  if (!user || !user.passwordResetExpiresAt || user.passwordResetExpiresAt.getTime() < Date.now()) {
    throw AppError.badRequest('Invalid or expired reset token', 'INVALID_RESET_TOKEN');
  }

  user.password = await hashPassword(newPassword);
  user.passwordResetTokenHash = null;
  user.passwordResetExpiresAt = null;
  user.tokenVersion += 1;
  await sequelize.transaction(async (transaction) => {
    await user.save({ transaction });
    await revokeAllSessions(user.id, { transaction });
  });

  res.json({ message: 'Password reset successful. Please log in with your new password.' });
};
