const express = require('express');
const router = express.Router();
const keysController = require('../controllers/keysController');
const { protect } = require('../middleware/auth');
const { validateCreateKey, validate, stripUnknownFields } = require('../utils/validation');
const { apiKeyCreationLimiter } = require('../middleware/rateLimiter');

router.get('/', protect, keysController.getKeys);
router.post('/', protect, apiKeyCreationLimiter, stripUnknownFields(['name']), validateCreateKey, validate, keysController.createKey);
router.put('/:id', protect, stripUnknownFields(['is_active']), keysController.updateKey);
router.delete('/:id', protect, keysController.deleteKey);

module.exports = router;
