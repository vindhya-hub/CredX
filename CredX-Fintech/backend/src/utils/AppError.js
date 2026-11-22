/**
 * Operational error with an HTTP status and a stable machine-readable code.
 * Thrown from controllers/services and rendered by error.middleware.js.
 */
class AppError extends Error {
  constructor(status, message, code = 'ERROR', details = undefined) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, code = 'BAD_REQUEST', details) {
    return new AppError(400, message, code, details);
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new AppError(401, message, code);
  }

  static paymentRequired(message, code = 'PAYMENT_DECLINED', details) {
    return new AppError(402, message, code, details);
  }

  static forbidden(message = 'You do not have access to this resource', code = 'FORBIDDEN') {
    return new AppError(403, message, code);
  }

  static notFound(message = 'Resource not found', code = 'NOT_FOUND') {
    return new AppError(404, message, code);
  }

  static conflict(message, code = 'CONFLICT') {
    return new AppError(409, message, code);
  }
}

module.exports = AppError;
