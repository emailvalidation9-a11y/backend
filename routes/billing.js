const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const { protect } = require('../middleware/auth');

router.get('/plans', protect, billingController.getPlans);
router.get('/transactions', protect, billingController.getTransactions);
router.post('/checkout', protect, billingController.createCheckout);
router.post('/credits', protect, billingController.purchaseCredits);

module.exports = router;
