const { TokenExpiredError } = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { verifyAccessToken } = require('../modules/auth/token.service');

/**
 * Requires a valid access token: `Authorization: Bearer <token>`.
 * Sets `req.user = { id, role }`. Expired tokens get code TOKEN_EXPIRED so
 * the client knows to call POST /api/auth/refresh.
 */
module.exports = function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(AppError.unauthorized('No token provided', 'NO_TOKEN'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      return next(AppError.unauthorized('Access token expired', 'TOKEN_EXPIRED'));
    }
    return next(AppError.unauthorized('Invalid token', 'INVALID_TOKEN'));
  }
};
