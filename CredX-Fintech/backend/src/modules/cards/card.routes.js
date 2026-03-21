const express = require('express');
const router = express.Router();
const cardController = require('./card.controller');
const authMiddleware = require('../../middlewares/auth.middleware');


router.delete('/:cardId', authMiddleware, cardController.deleteCard);
router.post('/create', authMiddleware, cardController.createCard);
router.post('/spend', authMiddleware, cardController.spend);
router.post('/toggle-freeze', authMiddleware, cardController.toggleFreeze);
router.post('/simulate', authMiddleware, cardController.simulateTransactions);
router.post('/pay-bill', authMiddleware, cardController.payCreditBill); // ✅ THIS MUST EXIST
router.get('/', authMiddleware, cardController.getUserCards);
router.get('/:cardId/transactions', authMiddleware, cardController.getCardTransactions);
router.get('/spendings', authMiddleware, cardController.getUserSpendings);
router.get("/analytics", authMiddleware, cardController.getSpendingAnalytics);
router.get("/analytics/categories", authMiddleware, cardController.getCategoryAnalytics);
router.get("/:id", authMiddleware, cardController.getCardById);

module.exports = router;