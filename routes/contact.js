const express = require('express');
const router = express.Router();
const ContactMessage = require('../models/ContactMessage');
const { protect, restrictTo } = require('../middleware/auth');
const { AppError } = require('../utils/errorHandler');

// Get all contact messages (Admin)
router.get('/', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const messages = await ContactMessage.find().sort('-createdAt');
        res.json({ status: 'success', data: { messages } });
    } catch (err) {
        next(err);
    }
});

// Submit a contact message (Public)
router.post('/', async (req, res, next) => {
    try {
        const { name, email, subject, message } = req.body;
        if (!name || !email || !message) {
            return next(new AppError('Please provide name, email, and message', 400));
        }

        const newMessage = await ContactMessage.create({
            name, email, subject, message
        });

        res.status(201).json({ status: 'success', data: { message: newMessage } });
    } catch (err) {
        next(err);
    }
});

// Update contact message status (Admin)
router.patch('/:id/status', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const { status } = req.body;
        if (!['unread', 'read', 'replied'].includes(status)) {
            return next(new AppError('Invalid status', 400));
        }

        const message = await ContactMessage.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true, runValidators: true }
        );

        if (!message) {
            return next(new AppError('Message not found', 404));
        }

        res.json({ status: 'success', data: { message } });
    } catch (err) {
        next(err);
    }
});

// Delete contact message (Admin)
router.delete('/:id', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const message = await ContactMessage.findByIdAndDelete(req.params.id);
        if (!message) {
            return next(new AppError('Message not found', 404));
        }
        res.status(204).json({ status: 'success', data: null });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
