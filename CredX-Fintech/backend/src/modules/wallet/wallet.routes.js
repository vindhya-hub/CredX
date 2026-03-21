const express = require('express');
const router = express.Router();
const walletController = require('./wallet.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const { addMoney } = require('./wallet.controller');

router.get('/', authMiddleware, walletController.getMyWallet);
router.post('/add-money', authMiddleware, addMoney);
router.post('/transfer', authMiddleware, walletController.transferMoney);

module.exports = router;