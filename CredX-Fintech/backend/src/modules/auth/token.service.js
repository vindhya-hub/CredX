/**
 * JWT access + refresh tokens.
 *
 * - Access tokens (default 15m) authorise API calls. They are stateless:
 *   auth.middleware.js only verifies the signature and claims.
 * - Refresh tokens (default 7d) are exchanged at POST /api/auth/refresh for a
 *   new pair. Each one is backed by a RefreshToken row (id = jti) and is
 *   single use: rotation revokes the presented token. Re-using a revoked
 *   token outside a short grace period (two tabs refreshing at once) is
 *   treated as theft and revokes every session of that user.
 * - Refresh tokens also carry the user's `tokenVersion`; bumping it (password
 *   change/reset) invalidates all of them at once.
 * - Separate secrets plus a `type` claim mean one kind can never be used as
 *   the other. Algorithm, issuer and audience are pinned on verification.
 */
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const config = require('../../config/config');
const logger = require('../../utils/logger');
const AppError = require('../../utils/AppError');
const { sequelize, User, RefreshToken } = require('../../models');

const ALGORITHM = 'HS256';
const REUSE_GRACE_MS = 30 * 1000;

function signAccessToken(user) {
  return jwt.sign({ type: 'access', role: user.role }, config.jwt.accessSecret, {
    algorithm: ALGORITHM,
    subject: String(user.id),
    expiresIn: config.jwt.accessTtl,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
}

function signRefreshToken(user, jti) {
  return jwt.sign({ type: 'refresh', tv: user.tokenVersion ?? 0 }, config.jwt.refreshSecret, {
    algorithm: ALGORITHM,
    subject: String(user.id),
    expiresIn: config.jwt.refreshTtl,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
    jwtid: jti,
  });
}

function verify(token, secret, expectedType) {
  const payload = jwt.verify(token, secret, {
    algorithms: [ALGORITHM],
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  });
  if (payload.type !== expectedType || !payload.sub) {
    throw new jwt.JsonWebTokenError('invalid token type');
  }
  return payload;
}

const verifyAccessToken = (token) => verify(token, config.jwt.accessSecret, 'access');
const verifyRefreshToken = (token) => verify(token, config.jwt.refreshSecret, 'refresh');

/** Creates a session row and returns a new access/refresh pair. */
async function issueTokenPair(user, { transaction } = {}) {
  const jti = crypto.randomUUID();
  const refreshToken = signRefreshToken(user, jti);
  const { exp } = jwt.decode(refreshToken);
  await RefreshToken.create({ id: jti, userId: user.id, expiresAt: new Date(exp * 1000) }, { transaction });

  return {
    accessToken: signAccessToken(user),
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: config.jwt.accessTtl,
  };
}

/** Revokes every active session of the user (logout everywhere, password change, token theft). */
async function revokeAllSessions(userId, { transaction } = {}) {
  await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null }, transaction },
  );
}

/** Removes expired session rows of a user (called on login to keep the table small). */
async function pruneSessions(userId) {
  await RefreshToken.destroy({ where: { userId, expiresAt: { [Op.lt]: new Date() } } });
}

const invalidRefresh = (message = 'Invalid or expired refresh token') =>
  AppError.unauthorized(message, 'INVALID_REFRESH_TOKEN');

/**
 * Exchanges a refresh token for a new pair (rotation).
 * @returns {Promise<{ user: object, tokens: object }>}
 */
async function rotateRefreshToken(token) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw invalidRefresh();
  }
  if (!payload.jti) throw invalidRefresh();

  const outcome = await sequelize.transaction(async (t) => {
    const session = await RefreshToken.findOne({
      where: { id: payload.jti, userId: payload.sub },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!session) return { error: invalidRefresh() };

    if (session.revokedAt) {
      if (Date.now() - session.revokedAt.getTime() <= REUSE_GRACE_MS && session.replacedById) {
        // Concurrent refresh from another tab: reject this one, keep the sessions.
        return { error: invalidRefresh('Refresh token already used') };
      }
      await revokeAllSessions(payload.sub, { transaction: t });
      await User.increment('tokenVersion', { where: { id: payload.sub }, transaction: t });
      logger.warn('Refresh token reuse detected; all sessions revoked', { userId: payload.sub });
      return { error: invalidRefresh('Refresh token reuse detected; please log in again') };
    }

    const user = await User.findByPk(payload.sub, { transaction: t });
    if (!user || user.tokenVersion !== payload.tv || user.account_status !== 'active') {
      session.revokedAt = new Date();
      await session.save({ transaction: t });
      return { error: invalidRefresh('Refresh token has been revoked') };
    }

    const tokens = await issueTokenPair(user, { transaction: t });
    session.revokedAt = new Date();
    session.replacedById = jwt.decode(tokens.refreshToken).jti;
    await session.save({ transaction: t });
    return { user, tokens };
  });

  // Revocations above are committed before the error is reported.
  if (outcome.error) throw outcome.error;
  return outcome;
}

/** Revokes the session behind a refresh token (logout). Invalid/expired tokens are ignored. */
async function revokeRefreshToken(token) {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    return false;
  }
  if (!payload.jti) return false;
  const [count] = await RefreshToken.update(
    { revokedAt: new Date() },
    { where: { id: payload.jti, userId: payload.sub, revokedAt: null } },
  );
  return count > 0;
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  issueTokenPair,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllSessions,
  pruneSessions,
};
