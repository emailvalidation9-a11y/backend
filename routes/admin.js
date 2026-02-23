const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);
router.use(restrictTo('admin'));

// Dashboard
router.get('/stats', ctrl.getStats);

// Users
router.get('/users', ctrl.getUsers);
router.get('/users/export', ctrl.exportUsers);
router.get('/users/:id', ctrl.getUser);
router.put('/users/:id', ctrl.updateUser);
router.delete('/users/:id', ctrl.deleteUser);
router.post('/users/:id/credits/adjust', ctrl.adjustCredits);
router.post('/users/:id/credits/set', ctrl.setCredits);
router.post('/users/:id/reset-password', ctrl.resetUserPassword);

// Bulk operations
router.post('/users/bulk', ctrl.bulkOperation);

// API Keys
router.get('/api-keys', ctrl.getApiKeys);
router.patch('/api-keys/:id/revoke', ctrl.revokeApiKey);
router.delete('/api-keys/:id', ctrl.deleteApiKey);

// Activity Log
router.get('/activity', ctrl.getActivityLog);

// Jobs & Transactions
router.get('/jobs', ctrl.getJobs);
router.get('/transactions', ctrl.getTransactions);

module.exports = router;
