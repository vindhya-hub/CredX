const express = require('express');
const router = express.Router();
const transactionController = require('./transaction.controller');
const authMiddleware = require('../../middlewares/auth.middleware');

router.post('/transfer', authMiddleware, transactionController.transfer);
router.get('/history', authMiddleware, transactionController.getHistory);

module.exports = router;