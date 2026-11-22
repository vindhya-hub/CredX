const express = require('express');
const adminController = require('./admin.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const adminMiddleware = require('../../middlewares/admin.middleware');
const validate = require('../../middlewares/validate.middleware');
const { z, id, intInRange } = require('../../utils/validators');

const router = express.Router();

const pageQuery = z.object({
  limit: intInRange(1, 200).default(50),
  offset: intInRange(0, 1_000_000).default(0),
});

router.use(authMiddleware, adminMiddleware);

router.get('/users', validate({ query: pageQuery }), adminController.getAllUsers);
router.get('/frauds', validate({ query: pageQuery }), adminController.getFraudTransactions);
router.post('/freeze-card', validate({ body: z.object({ cardId: id('cardId') }) }), adminController.freezeUserCard);

module.exports = router;
