const express = require('express');
const router = express.Router();
const adminController = require('./admin.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const adminMiddleware = require('../../middlewares/admin.middleware');

router.get('/users', authMiddleware, adminMiddleware, adminController.getAllUsers);
router.get('/frauds', authMiddleware, adminMiddleware, adminController.getFraudTransactions);
router.post('/freeze-card', authMiddleware, adminMiddleware, adminController.freezeUserCard);

module.exports = router;