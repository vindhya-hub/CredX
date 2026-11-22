const express = require('express');
const loanController = require('./loan.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { z, amount, id, intInRange } = require('../../utils/validators');

const router = express.Router();

const applySchema = z.object({
  amount: amount(5_000_000),
  tenureMonths: intInRange(1, 360),
});

const paySchema = z.object({ loanId: id('loanId') });

router.post('/apply', authMiddleware, validate({ body: applySchema }), loanController.applyLoan);
router.get('/quote', authMiddleware, validate({ query: applySchema }), loanController.quoteLoan);
router.get('/', authMiddleware, loanController.getUserLoans);
router.post('/pay', authMiddleware, validate({ body: paySchema }), loanController.payEMI);

module.exports = router;
