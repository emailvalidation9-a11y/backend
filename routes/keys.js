const express = require('express');
const router = express.Router();
const keysController = require('../controllers/keysController');
const { protect } = require('../middleware/auth');

router.get('/', protect, keysController.getKeys);
router.post('/', protect, keysController.createKey);
router.put('/:id', protect, keysController.updateKey);
router.delete('/:id', protect, keysController.deleteKey);

module.exports = router;
