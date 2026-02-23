const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
    code: {
        type: String,
        required: [true, 'Coupon code is required'],
        unique: true,
        uppercase: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    discount_type: {
        type: String,
        enum: ['percentage', 'fixed', 'credits'],
        required: true
    },
    discount_value: {
        type: Number,
        required: true,
        min: 0
    },
    // For percentage: max discount cap
    max_discount: {
        type: Number,
        default: null
    },
    // For credits type: number of bonus credits
    bonus_credits: {
        type: Number,
        default: 0
    },
    // Applicable plans (empty = all plans)
    applicable_plans: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PricingPlan'
    }],
    min_purchase_amount: {
        type: Number,
        default: 0
    },
    max_uses: {
        type: Number,
        default: null // null = unlimited
    },
    max_uses_per_user: {
        type: Number,
        default: 1
    },
    current_uses: {
        type: Number,
        default: 0
    },
    used_by: [{
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        used_at: {
            type: Date,
            default: Date.now
        }
    }],
    starts_at: {
        type: Date,
        default: Date.now
    },
    expires_at: {
        type: Date,
        default: null // null = never expires
    },
    is_active: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

couponSchema.index({ is_active: 1, starts_at: 1, expires_at: 1 });

// Virtual to check if coupon is currently valid
couponSchema.methods.isValid = function () {
    const now = new Date();
    if (!this.is_active) return false;
    if (this.starts_at && now < this.starts_at) return false;
    if (this.expires_at && now > this.expires_at) return false;
    if (this.max_uses !== null && this.current_uses >= this.max_uses) return false;
    return true;
};

module.exports = mongoose.model('Coupon', couponSchema);
