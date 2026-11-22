const express = require('express');
const authController = require('./auth.controller');
const schemas = require('./auth.validation');
const authMiddleware = require('../../middlewares/auth.middleware');
const validate = require('../../middlewares/validate.middleware');
const { useLimiter } = require('../../middlewares/rateLimit.middleware');

const router = express.Router();
const authLimit = useLimiter('auth');

router.post('/register', authLimit, validate({ body: schemas.register }), authController.register);
router.post('/login', authLimit, validate({ body: schemas.login }), authController.login);
router.post('/refresh', authLimit, validate({ body: schemas.refresh }), authController.refresh);
router.post('/logout', authLimit, validate({ body: schemas.logout }), authController.logout);
router.post('/logout-all', authMiddleware, authController.logoutAll);
router.get('/profile', authMiddleware, authController.getProfile);
router.post('/change-password', authMiddleware, authLimit, validate({ body: schemas.changePassword }), authController.changePassword);
router.post('/forgot-password', authLimit, validate({ body: schemas.forgotPassword }), authController.forgotPassword);
router.post('/reset-password', authLimit, validate({ body: schemas.resetPassword }), authController.resetPassword);

module.exports = router;
