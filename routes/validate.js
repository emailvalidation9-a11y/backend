const express = require('express');
const router = express.Router();
const validateController = require('../controllers/validateController');
const { protect } = require('../middleware/auth');
const multer = require('multer');
const { validateSingleEmail, validate, stripUnknownFields } = require('../utils/validation');
const { validationLimiter, bulkValidationLimiter } = require('../middleware/rateLimiter');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

router.get('/jobs', protect, validateController.getJobs);
router.get('/jobs/:id', protect, validateController.getJob);
router.get('/jobs/:id/results', protect, validateController.getJobResults);
router.delete('/jobs/:id', protect, validateController.cancelJob);
router.post('/single', protect, validationLimiter, stripUnknownFields(['email']), validateSingleEmail, validate, validateController.validateSingle);
router.post('/bulk', protect, bulkValidationLimiter, upload.single('file'), validateController.validateBulk);
router.post('/csv-headers', protect, upload.single('csvFile'), validateController.getCsvHeaders);

module.exports = router;
