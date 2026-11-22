const express = require('express');
const controller = require('./assistant.controller');
const schemas = require('./assistant.validation');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { useLimiter } = require('../../middlewares/rateLimit.middleware');

const router = express.Router();

router.use(authMiddleware);

// Per-user limiter (runs after auth): retrieval + embeddings are CPU-heavy.
router.post('/query', useLimiter('assistant'), validate({ body: schemas.query }), controller.query);
router.get('/suggestions', controller.suggestions);
router.get('/status', controller.status);

module.exports = router;
