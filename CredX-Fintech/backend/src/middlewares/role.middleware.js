const AppError = require('../utils/AppError');

/** Allows the request through only if `req.user.role` is one of `roles`. Use after authMiddleware. */
module.exports = function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(AppError.forbidden(`${roles.join(' or ')} access required`));
    }
    return next();
  };
};
