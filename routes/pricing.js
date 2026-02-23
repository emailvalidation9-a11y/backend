const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/pricingController');
const { protect, restrictTo } = require('../middleware/auth');

// Public routes
router.get('/public', ctrl.getPublicPlans);
router.post('/coupon/validate', protect, ctrl.validateCoupon);

// Admin routes
router.use(protect);
router.use(restrictTo('admin'));

// System config
router.get('/config', ctrl.getSystemConfig);

// Plans
router.get('/plans', ctrl.getPlans);
router.post('/plans', ctrl.createPlan);
router.post('/plans/seed', ctrl.seedPlans);
router.put('/plans/:id', ctrl.updatePlan);
router.delete('/plans/:id', ctrl.deletePlan);

// Coupons
router.get('/coupons', ctrl.getCoupons);
router.post('/coupons', ctrl.createCoupon);
router.put('/coupons/:id', ctrl.updateCoupon);
router.delete('/coupons/:id', ctrl.deleteCoupon);

module.exports = router;
