const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect, restrictTo } = require('../middleware/auth');
const { AppError } = require('../utils/errorHandler');
const {
    uploadImage,
    uploadAvatar,
    uploadRawFile,
    uploadBlogImage,
    deleteFile,
} = require('../utils/cloudinary');
const User = require('../models/User');

// Configure multer for memory storage (buffer → Cloudinary)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB for images
    fileFilter: (req, file, cb) => {
        // Allow images, CSVs, and common file types
        const allowedMimes = [
            'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
            'text/csv', 'application/pdf',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'text/plain',
        ];

        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new AppError(`File type ${file.mimetype} is not supported`, 400), false);
        }
    },
});

// Upload avatar (Protected - any user)
router.post('/avatar', protect, upload.single('avatar'), async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new AppError('Please provide an image file', 400));
        }

        // Delete old avatar if exists
        const user = await User.findById(req.user.id);
        if (user.avatar?.publicId) {
            try {
                await deleteFile(user.avatar.publicId, 'image');
            } catch (err) {
                console.log('Old avatar cleanup failed (non-critical):', err.message);
            }
        }

        // Upload new avatar
        const result = await uploadAvatar(req.file.buffer, req.user.id);

        // Save to user model
        user.avatar = {
            url: result.secureUrl,
            publicId: result.publicId,
        };
        await user.save();

        res.status(200).json({
            status: 'success',
            data: {
                url: result.secureUrl,
                publicId: result.publicId,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Delete avatar (Protected - any user)
router.delete('/avatar', protect, async (req, res, next) => {
    try {
        const user = await User.findById(req.user.id);

        if (user.avatar?.publicId) {
            await deleteFile(user.avatar.publicId, 'image');
            user.avatar = undefined;
            await user.save();
        }

        res.status(200).json({
            status: 'success',
            message: 'Avatar removed',
        });
    } catch (error) {
        next(error);
    }
});

// Upload blog cover image (Admin only)
router.post('/blog', protect, restrictTo('admin'), upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new AppError('Please provide an image file', 400));
        }

        const slug = req.body.slug || `blog_${Date.now()}`;
        const result = await uploadBlogImage(req.file.buffer, slug);

        res.status(200).json({
            status: 'success',
            data: {
                url: result.secureUrl,
                publicId: result.publicId,
                width: result.width,
                height: result.height,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Upload generic image (Admin only - for site settings, etc.)
router.post('/image', protect, restrictTo('admin'), upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new AppError('Please provide an image file', 400));
        }

        const folder = req.body.folder || 'general';
        const result = await uploadImage(req.file.buffer, { folder });

        res.status(200).json({
            status: 'success',
            data: {
                url: result.secureUrl,
                publicId: result.publicId,
                width: result.width,
                height: result.height,
                format: result.format,
                bytes: result.bytes,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Upload raw file (CSV, PDF, etc. - Admin only)
router.post('/file', protect, restrictTo('admin'), upload.single('file'), async (req, res, next) => {
    try {
        if (!req.file) {
            return next(new AppError('Please provide a file', 400));
        }

        const folder = req.body.folder || 'files';
        const result = await uploadRawFile(req.file.buffer, {
            folder,
            originalFilename: req.file.originalname,
        });

        res.status(200).json({
            status: 'success',
            data: {
                url: result.secureUrl,
                publicId: result.publicId,
                format: result.format,
                bytes: result.bytes,
            },
        });
    } catch (error) {
        next(error);
    }
});

// Delete any file by publicId (Admin only)
router.delete('/file', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const { publicId, resourceType = 'image' } = req.body;

        if (!publicId) {
            return next(new AppError('Please provide a publicId', 400));
        }

        await deleteFile(publicId, resourceType);

        res.status(200).json({
            status: 'success',
            message: 'File deleted from cloud storage',
        });
    } catch (error) {
        next(error);
    }
});

module.exports = router;
