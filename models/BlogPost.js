const mongoose = require('mongoose');

const blogPostSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    content: {
        type: String,
        required: true
    },
    excerpt: {
        type: String
    },
    category: {
        type: String,
        default: 'General'
    },
    status: {
        type: String,
        enum: ['draft', 'published'],
        default: 'draft'
    },
    author: {
        type: String,
        default: 'Admin'
    },
    coverImage: {
        type: String
    },
    tags: [{
        type: String
    }],
    publishedAt: {
        type: Date
    }
}, {
    timestamps: true
});

// Pre-save to auto-generate pub date if published
blogPostSchema.pre('save', function () {
    if (this.isModified('status') && this.status === 'published' && !this.publishedAt) {
        this.publishedAt = Date.now();
    }
});

module.exports = mongoose.model('BlogPost', blogPostSchema);
