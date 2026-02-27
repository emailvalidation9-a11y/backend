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

// Get Cloudflare Browser Check Setting
router.get('/cloudflare/browser-check', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const zoneId = '753bb298cdc62db27e8331bc62c647d1';
        const email = process.env.CLOUDFLARE_EMAIL || '';
        const apiKey = process.env.CLOUDFLARE_API_KEY || '';

        if (!email || !apiKey) {
            return next(new AppError('Cloudflare credentials not configured on the server', 500));
        }

        const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/browser_check`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Email': email,
                'X-Auth-Key': apiKey
            }
        });

        const data = await response.json();
        res.json({ status: 'success', data });
    } catch (err) {
        next(err);
    }
});

// Update Cloudflare Browser Check Setting
router.patch('/cloudflare/browser-check', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const { value } = req.body;
        if (!value || (value !== 'on' && value !== 'off')) {
            return next(new AppError('Value must be "on" or "off"', 400));
        }

        const zoneId = '753bb298cdc62db27e8331bc62c647d1';
        const email = process.env.CLOUDFLARE_EMAIL || '';
        const apiKey = process.env.CLOUDFLARE_API_KEY || '';

        if (!email || !apiKey) {
            return next(new AppError('Cloudflare credentials not configured on the server', 500));
        }

        const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/settings/browser_check`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-Auth-Email': email,
                'X-Auth-Key': apiKey
            },
            body: JSON.stringify({ value })
        });

        const data = await response.json();
        res.json({ status: 'success', data });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
