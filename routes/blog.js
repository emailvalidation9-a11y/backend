const express = require('express');
const router = express.Router();
const BlogPost = require('../models/BlogPost');
const { protect, restrictTo } = require('../middleware/auth');
const { AppError } = require('../utils/errorHandler');

// Get all published posts (Public)
router.get('/', async (req, res, next) => {
    try {
        const posts = await BlogPost.find({ status: 'published' }).sort('-publishedAt');
        res.json({ status: 'success', data: { posts } });
    } catch (err) {
        next(err);
    }
});

// Get all posts including drafts (Admin)
router.get('/admin', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const posts = await BlogPost.find().sort('-createdAt');
        res.json({ status: 'success', data: { posts } });
    } catch (err) {
        next(err);
    }
});

// Get single post by slug (Public)
router.get('/:slug', async (req, res, next) => {
    try {
        const post = await BlogPost.findOne({ slug: req.params.slug, status: 'published' });
        if (!post) {
            return next(new AppError('Post not found', 404));
        }
        res.json({ status: 'success', data: { post } });
    } catch (err) {
        next(err);
    }
});

// Get single post by id (Admin)
router.get('/admin/:id', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const post = await BlogPost.findById(req.params.id);
        if (!post) {
            return next(new AppError('Post not found', 404));
        }
        res.json({ status: 'success', data: { post } });
    } catch (err) {
        next(err);
    }
});

// Create new post (Admin)
router.post('/', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const { title, slug, content, excerpt, coverImage, tags, category, status, publishedAt, metaTitle, metaDescription } = req.body;
        const newPost = await BlogPost.create({ title, slug, content, excerpt, coverImage, tags, category, status, publishedAt, metaTitle, metaDescription });
        res.status(201).json({ status: 'success', data: { post: newPost } });
    } catch (err) {
        next(err);
    }
});

// Update post (Admin)
router.put('/:id', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const { title, slug, content, excerpt, coverImage, tags, category, status, publishedAt, metaTitle, metaDescription } = req.body;
        const allowedFields = {};
        if (title !== undefined) allowedFields.title = title;
        if (slug !== undefined) allowedFields.slug = slug;
        if (content !== undefined) allowedFields.content = content;
        if (excerpt !== undefined) allowedFields.excerpt = excerpt;
        if (coverImage !== undefined) allowedFields.coverImage = coverImage;
        if (tags !== undefined) allowedFields.tags = tags;
        if (category !== undefined) allowedFields.category = category;
        if (status !== undefined) allowedFields.status = status;
        if (publishedAt !== undefined) allowedFields.publishedAt = publishedAt;
        if (metaTitle !== undefined) allowedFields.metaTitle = metaTitle;
        if (metaDescription !== undefined) allowedFields.metaDescription = metaDescription;
        const post = await BlogPost.findByIdAndUpdate(req.params.id, allowedFields, {
            new: true,
            runValidators: true
        });
        if (!post) {
            return next(new AppError('Post not found', 404));
        }
        res.json({ status: 'success', data: { post } });
    } catch (err) {
        next(err);
    }
});

// Delete post (Admin)
router.delete('/:id', protect, restrictTo('admin'), async (req, res, next) => {
    try {
        const post = await BlogPost.findByIdAndDelete(req.params.id);
        if (!post) {
            return next(new AppError('Post not found', 404));
        }
        res.status(204).json({ status: 'success', data: null });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
