const express = require('express');
const router = express.Router();
const authMiddleware = require('../../middlewares/auth.middleware');
const loanController = require('./loan.controller');

router.post('/apply', authMiddleware, loanController.applyLoan);
router.get('/', authMiddleware, loanController.getUserLoans);
router.post('/pay', authMiddleware, loanController.payEMI);

module.exports = router;