const { body, validationResult } = require('express-validator');

// ─── Shared password strength rule ────────────────────────────
const passwordChain = (field = 'password') =>
  body(field)
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .isLength({ max: 128 })
    .withMessage('Password must not exceed 128 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number');

// ─── Result handler ───────────────────────────────────────────
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'fail',
      errors: errors.array()
    });
  }
  next();
};

/**
 * Middleware factory: strips any fields from req.body that are not
 * in the provided allowlist. Prevents mass-assignment attacks.
 */
const stripUnknownFields = (allowedFields) => (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    const allowed = new Set(allowedFields);
    Object.keys(req.body).forEach((key) => {
      if (!allowed.has(key)) delete req.body[key];
    });
  }
  next();
};

// ═══════════════════════════════════════════════════════════════
// AUTH
// ═══════════════════════════════════════════════════════════════

const validateLogin = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validateRegister = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  passwordChain('password'),
];

const validateSetup = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  passwordChain('password'),
];

const validateUpdateProfile = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
];

const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  passwordChain('newPassword'),
];

const validateForgotPassword = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
];

const validateResetPassword = [
  passwordChain('password'),
];

// ═══════════════════════════════════════════════════════════════
// CONTACT
// ═══════════════════════════════════════════════════════════════

const validateContact = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('subject')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Subject must not exceed 200 characters'),
  body('message')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Message must be between 10 and 5000 characters'),
];

// ═══════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════

const validateSingleEmail = [
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email address')
    .normalizeEmail(),
];

// ═══════════════════════════════════════════════════════════════
// BILLING
// ═══════════════════════════════════════════════════════════════

const validateCheckout = [
  body('plan')
    .trim()
    .notEmpty()
    .withMessage('Plan is required')
    .isLength({ max: 50 })
    .withMessage('Plan identifier too long'),
  body('success_url')
    .optional()
    .isURL()
    .withMessage('success_url must be a valid URL'),
  body('cancel_url')
    .optional()
    .isURL()
    .withMessage('cancel_url must be a valid URL'),
];

const validatePurchaseCredits = [
  body('package')
    .trim()
    .notEmpty()
    .withMessage('Package is required')
    .isLength({ max: 50 })
    .withMessage('Package identifier too long'),
  body('success_url')
    .optional()
    .isURL()
    .withMessage('success_url must be a valid URL'),
  body('cancel_url')
    .optional()
    .isURL()
    .withMessage('cancel_url must be a valid URL'),
];

// ═══════════════════════════════════════════════════════════════
// API KEYS
// ═══════════════════════════════════════════════════════════════

const validateCreateKey = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Key name must be between 1 and 100 characters'),
];

// ═══════════════════════════════════════════════════════════════
// PRICING / COUPONS
// ═══════════════════════════════════════════════════════════════

const validateCouponCode = [
  body('code')
    .trim()
    .notEmpty()
    .withMessage('Coupon code is required')
    .isLength({ max: 50 })
    .withMessage('Coupon code too long')
    .matches(/^[A-Za-z0-9_-]+$/)
    .withMessage('Coupon code contains invalid characters'),
  body('planId')
    .optional()
    .isMongoId()
    .withMessage('Invalid plan ID'),
];

// ═══════════════════════════════════════════════════════════════
// ADMIN — USER MANAGEMENT
// ═══════════════════════════════════════════════════════════════

const validateUpdateUser = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Name must be between 2 and 50 characters'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('role')
    .optional()
    .isIn(['user', 'admin'])
    .withMessage('Role must be user or admin'),
  body('credits')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Credits must be a non-negative integer')
    .toInt(),
  body('is_active')
    .optional()
    .isBoolean()
    .withMessage('is_active must be a boolean'),
];

const validateAdjustCredits = [
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isInt()
    .withMessage('Amount must be an integer')
    .toInt(),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
];

const validateSetCredits = [
  body('credits')
    .notEmpty()
    .withMessage('Credits value is required')
    .isInt({ min: 0 })
    .withMessage('Credits must be a non-negative integer')
    .toInt(),
  body('reason')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Reason must not exceed 500 characters'),
];

const validateResetUserPassword = [
  passwordChain('newPassword'),
];

const validateBulkOperation = [
  body('ids')
    .isArray({ min: 1, max: 100 })
    .withMessage('ids must be an array with 1-100 items'),
  body('ids.*')
    .isMongoId()
    .withMessage('Each id must be a valid MongoDB ObjectId'),
  body('action')
    .isIn(['activate', 'deactivate', 'delete', 'add_credits', 'set_plan', 'make_admin', 'remove_admin'])
    .withMessage('Invalid bulk action'),
  body('amount')
    .optional()
    .isInt()
    .withMessage('Amount must be an integer')
    .toInt(),
  body('plan')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Plan name too long'),
];

// ═══════════════════════════════════════════════════════════════
// SERVERS
// ═══════════════════════════════════════════════════════════════

const validateCreateServer = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('url')
    .trim()
    .isURL()
    .withMessage('Please provide a valid URL'),
  body('weight')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Weight must be between 1 and 100')
    .toInt(),
];

const validateUpdateServer = [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('url')
    .optional()
    .trim()
    .isURL()
    .withMessage('Please provide a valid URL'),
  body('weight')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Weight must be between 1 and 100')
    .toInt(),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
];

module.exports = {
  validate,
  stripUnknownFields,
  // Auth
  validateLogin,
  validateRegister,
  validateSetup,
  validateUpdateProfile,
  validateChangePassword,
  validateForgotPassword,
  validateResetPassword,
  // Contact
  validateContact,
  // Validation
  validateSingleEmail,
  // Billing
  validateCheckout,
  validatePurchaseCredits,
  // API Keys
  validateCreateKey,
  // Pricing / Coupons
  validateCouponCode,
  // Admin
  validateUpdateUser,
  validateAdjustCredits,
  validateSetCredits,
  validateResetUserPassword,
  validateBulkOperation,
  // Servers
  validateCreateServer,
  validateUpdateServer,
};
