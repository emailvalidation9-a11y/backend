const express = require('express');
const router = express.Router();
const accountController = require('../controllers/accountController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

// Activity log
router.get('/activity', accountController.getActivityLog);

// Usage analytics
router.get('/usage', accountController.getUsageStats);

// Export results as CSV
router.get('/export/:jobId', accountController.exportResultsCSV);

// Delete account (GDPR)
router.delete('/', accountController.deleteAccount);

module.exports = router;
