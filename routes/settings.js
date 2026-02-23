const express = require('express');
const router = express.Router();
const SiteSettings = require('../models/SiteSettings');
const { protect, restrictTo } = require('../middleware/auth');
const { AppError } = require('../utils/errorHandler');

// Get settings (Public)
router.get('/', async (req, res, next) => {
    try {
        let settings = await SiteSettings.findOne();
        if (!settings) {
            settings = await SiteSettings.create({});
        }
        res.json({ status: 'success', data: { settings } });
    } catch (err) {
        next(err);
    }
});

// Update settings (Admin)
router.put('/', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        let settings = await SiteSettings.findOne();
        if (!settings) {
            settings = new SiteSettings();
        }

        // Merge new values
        if (req.body.socialMedia) {
            settings.socialMedia = { ...settings.socialMedia, ...req.body.socialMedia };
        }
        if (req.body.contactInfo) {
            settings.contactInfo = { ...settings.contactInfo, ...req.body.contactInfo };
        }

        await settings.save();
        res.json({ status: 'success', data: { settings } });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
