const express = require('express');
const cardController = require('./card.controller');
const schemas = require('./card.validation');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');

const router = express.Router();

router.use(authMiddleware);

router.post('/create', validate({ body: schemas.createCard }), cardController.createCard);
router.post('/spend', validate({ body: schemas.spend }), cardController.spend);
router.post('/pay-bill', validate({ body: schemas.payBill }), cardController.payCreditBill);
router.post('/toggle-freeze', validate({ body: schemas.toggleFreeze }), cardController.toggleFreeze);
router.post('/simulate', validate({ body: schemas.simulate }), cardController.simulateTransactions);

router.get('/', cardController.getUserCards);
router.get('/spendings', validate({ query: schemas.listQuery }), cardController.getUserSpendings);
router.get('/analytics', cardController.getSpendingAnalytics);
router.get('/analytics/categories', validate({ query: schemas.categoryAnalyticsQuery }), cardController.getCategoryAnalytics);
router.get('/:cardId/transactions', validate({ params: schemas.cardIdParam, query: schemas.listQuery }), cardController.getCardTransactions);
router.get('/:id', validate({ params: schemas.idParam }), cardController.getCardById);
router.delete('/:cardId', validate({ params: schemas.cardIdParam }), cardController.deleteCard);

module.exports = router;
