const express = require('express');
const walletController = require('./wallet.controller');
const schemas = require('./wallet.validation');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');

const router = express.Router();

router.get('/', authMiddleware, walletController.getMyWallet);
router.post('/add-money', authMiddleware, validate({ body: schemas.addMoney }), walletController.addMoney);
router.post('/transfer', authMiddleware, validate({ body: schemas.transfer }), walletController.transferMoney);

module.exports = router;
