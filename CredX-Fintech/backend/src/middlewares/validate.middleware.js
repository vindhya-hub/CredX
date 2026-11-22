const AppError = require('../utils/AppError');

const formatIssues = (issues) =>
  issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));

/**
 * Validates request parts against zod schemas: `validate({ body, query, params })`.
 * Parsed (coerced, trimmed) body replaces `req.body`; parsed query/params are
 * exposed as `req.validated.query` / `req.validated.params` (Express 5 makes
 * `req.query` read-only).
 */
module.exports = function validate(schemas) {
  return (req, res, next) => {
    req.validated = req.validated || {};
    for (const part of ['params', 'query', 'body']) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part] ?? {});
      if (!result.success) {
        return next(AppError.badRequest('Validation failed', 'VALIDATION_ERROR', formatIssues(result.error.issues)));
      }
      if (part === 'body') req.body = result.data;
      req.validated[part] = result.data;
    }
    return next();
  };
};
