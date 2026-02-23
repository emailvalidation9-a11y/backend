const express = require('express');
const router = express.Router();
const validateController = require('../controllers/validateController');
const { protect } = require('../middleware/auth');
const multer = require('multer');

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

router.get('/jobs', protect, validateController.getJobs);
router.get('/jobs/:id', protect, validateController.getJob);
router.get('/jobs/:id/results', protect, validateController.getJobResults);
router.delete('/jobs/:id', protect, validateController.cancelJob);
router.post('/single', protect, validateController.validateSingle);
router.post('/bulk', protect, upload.single('file'), validateController.validateBulk);

module.exports = router;
