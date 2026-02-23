const mongoose = require('mongoose');

const usageStatSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    validations: {
        single: { type: Number, default: 0 },
        bulk: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },
    results: {
        valid: { type: Number, default: 0 },
        invalid: { type: Number, default: 0 },
        risky: { type: Number, default: 0 },
        unknown: { type: Number, default: 0 }
    },
    credits_used: { type: Number, default: 0 },
    api_calls: { type: Number, default: 0 }
}, {
    timestamps: false
});

usageStatSchema.index({ user_id: 1, date: -1 }, { unique: true });

module.exports = mongoose.model('UsageStat', usageStatSchema);
