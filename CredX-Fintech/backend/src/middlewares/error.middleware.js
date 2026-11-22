const AppError = require('../utils/AppError');
const logger = require('../utils/logger');

/**
 * Consistent error responses: `{ message, code, details?, requestId? }`.
 * `message` stays top-level for compatibility with the existing frontend.
 * Unexpected errors are logged server-side (without request bodies) and
 * returned as a generic 500 so internals such as SQL never leak to clients.
 */
function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.path} not found`, code: 'ROUTE_NOT_FOUND' });
}

function toAppError(err) {
  if (err instanceof AppError) return err;

  // body-parser errors
  if (err.type === 'entity.parse.failed') return AppError.badRequest('Malformed JSON body', 'INVALID_JSON');
  if (err.type === 'entity.too.large') return new AppError(413, 'Request body too large', 'PAYLOAD_TOO_LARGE');

  if (err.name === 'SequelizeUniqueConstraintError') return AppError.conflict('Resource already exists', 'DUPLICATE');
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    return AppError.conflict('Operation conflicts with related records', 'FOREIGN_KEY_CONFLICT');
  }
  if (err.name === 'SequelizeValidationError') {
    return AppError.badRequest(
      'Validation failed',
      'VALIDATION_ERROR',
      (err.errors || []).map((e) => ({ path: e.path, message: e.message })),
    );
  }
  if (err.name === 'SequelizeDatabaseError' && /invalid input syntax for type uuid/i.test(err.message)) {
    return AppError.badRequest('Invalid identifier', 'INVALID_ID');
  }

  // CORS rejections and other errors that carry an explicit HTTP status
  if (Number.isInteger(err.status) && err.status >= 400 && err.status < 500) {
    return new AppError(err.status, err.expose === false ? 'Request rejected' : err.message, err.code || 'REQUEST_REJECTED');
  }
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const known = toAppError(err);
  if (known) {
    const body = { message: known.message, code: known.code };
    if (known.details !== undefined) body.details = known.details;
    return res.status(known.status).json(body);
  }

  logger.error('Unhandled error', {
    requestId: req.id,
    method: req.method,
    path: req.originalUrl,
    error: err,
  });
  return res.status(500).json({ message: 'Internal server error', code: 'INTERNAL_ERROR', requestId: req.id });
}

module.exports = { notFoundHandler, errorHandler };
