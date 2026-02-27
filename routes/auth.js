const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const {
  validateLogin, validateRegister, validateSetup,
  validateUpdateProfile, validateChangePassword,
  validateForgotPassword, validateResetPassword,
  validate, stripUnknownFields,
} = require('../utils/validation');
const { authLimiter, strictLimiter, setupLimiter } = require('../middleware/rateLimiter');

// Setup routes (public - only work when no admin exists)
router.get('/setup/status', setupLimiter, authController.setupStatus);
router.post('/setup', setupLimiter, stripUnknownFields(['name', 'email', 'password']), validateSetup, validate, authController.setupAdmin);

// Public routes (rate limited to prevent abuse)
router.post('/register', authLimiter, stripUnknownFields(['name', 'email', 'password']), validateRegister, validate, authController.register);
router.post('/login', authLimiter, stripUnknownFields(['email', 'password']), validateLogin, validate, authController.login);
router.post('/forgot-password', authLimiter, stripUnknownFields(['email']), validateForgotPassword, validate, authController.forgotPassword);
router.post('/reset-password/:token', strictLimiter, stripUnknownFields(['password']), validateResetPassword, validate, authController.resetPassword);
router.get('/verify-email/:token', strictLimiter, authController.verifyEmail);

// Protected routes
router.get('/me', protect, authController.getMe);
router.put('/profile', protect, stripUnknownFields(['name']), validateUpdateProfile, validate, authController.updateProfile);
router.put('/password', protect, stripUnknownFields(['currentPassword', 'newPassword']), validateChangePassword, validate, authController.changePassword);
router.post('/logout', protect, authController.logout);
router.post('/resend-verification', protect, authController.resendVerification);

module.exports = router;
