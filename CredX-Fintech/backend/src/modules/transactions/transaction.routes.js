const express = require('express');
const transactionController = require('./transaction.controller');
const { TRANSACTION_TYPES } = require('./transaction.model');
const walletSchemas = require('../wallet/wallet.validation');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { z, intInRange } = require('../../utils/validators');

const router = express.Router();

const historyQuery = z.object({
  limit: intInRange(1, 200).default(50),
  offset: intInRange(0, 100000).default(0),
  type: z.enum(TRANSACTION_TYPES).optional(),
});

router.post('/transfer', authMiddleware, validate({ body: walletSchemas.transfer }), transactionController.transfer);
router.get('/history', authMiddleware, validate({ query: historyQuery }), transactionController.getHistory);

module.exports = router;
