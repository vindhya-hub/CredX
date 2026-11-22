const crypto = require('crypto');

/** Tags every request with an id (echoed as X-Request-Id) for log correlation. */
module.exports = function requestId(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
};
