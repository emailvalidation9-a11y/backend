const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { protect } = require('../middleware/auth');
const { validateCheckout, validatePurchaseCredits, validate, stripUnknownFields } = require('../utils/validation');

router.get('/plans', protect, billingController.getPlans);
router.get('/transactions', protect, billingController.getTransactions);
router.post('/checkout', protect, stripUnknownFields(['plan', 'success_url', 'cancel_url', 'currency']), validateCheckout, validate, billingController.createCheckout);
router.post('/credits', protect, stripUnknownFields(['package', 'success_url', 'cancel_url', 'currency']), validatePurchaseCredits, validate, billingController.purchaseCredits);
router.post('/verifyPayment', protect, billingController.verifyPayment);

module.exports = router;
