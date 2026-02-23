const mongoose = require('mongoose');

const pricingPlanSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Plan name is required'],
        trim: true
    },
    slug: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    price: {
        type: Number,
        required: true,
        default: 0
    },
    interval: {
        type: String,
        enum: ['month', 'year', 'one_time'],
        default: 'month'
    },
    credits: {
        type: Number,
        required: true,
        default: 0
    },
    features: [{
        type: String
    }],
    is_popular: {
        type: Boolean,
        default: false
    },
    is_active: {
        type: Boolean,
        default: true
    },
    sort_order: {
        type: Number,
        default: 0
    },
    type: {
        type: String,
        enum: ['subscription', 'credit_package'],
        default: 'subscription'
    },
    // For credit packages
    per_credit_cost: {
        type: Number,
        default: 0
    },
    description: {
        type: String,
        default: ''
    },
    cta_text: {
        type: String,
        default: 'Get Started'
    }
}, {
    timestamps: true
});

pricingPlanSchema.index({ type: 1, is_active: 1, sort_order: 1 });

module.exports = mongoose.model('PricingPlan', pricingPlanSchema);
