const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validateLogin, validateRegister, validate } = require('../utils/validation');

// Setup routes (public - only work when no admin exists)
router.get('/setup/status', authController.setupStatus);
router.post('/setup', authController.setupAdmin);

// Public routes
router.post('/register', validateRegister, validate, authController.register);
router.post('/login', validateLogin, validate, authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password/:token', authController.resetPassword);
router.get('/verify-email/:token', authController.verifyEmail);

// Protected routes
router.get('/me', protect, authController.getMe);
router.put('/profile', protect, authController.updateProfile);
router.put('/password', protect, authController.changePassword);
router.post('/logout', protect, authController.logout);
router.post('/resend-verification', protect, authController.resendVerification);

module.exports = router;