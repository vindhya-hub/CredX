const express = require('express');
const router = express.Router();
const authController = require('./auth.controller');
const { getProfile } = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth.middleware');


router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/profile', authMiddleware, getProfile);
router.post("/forgot-password", authController.forgotPassword);

module.exports = router;