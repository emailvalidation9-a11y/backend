const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['subscription', 'one_time', 'refund', 'bonus', 'adjustment'],
        required: true
    },
    stripe: {
        payment_intent_id: String,
        subscription_id: String,
        invoice_id: String
    },
    amount: {
        paid: { type: Number, required: true },
        currency: { type: String, required: true, default: 'usd' }
    },
    credits: {
        before: { type: Number, required: true },
        added: { type: Number, default: 0 },
        deducted: { type: Number, default: 0 },
        after: { type: Number, required: true }
    },
    plan: {
        name: String,
        credits: Number,
        interval: String
    },
    status: {
        type: String,
        enum: ['pending', 'success', 'failed', 'refunded'],
        default: 'pending'
    },
    description: {
        type: String,
        required: true
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

transactionSchema.index({ user_id: 1, created_at: -1 });

module.exports = mongoose.model('Transaction', transactionSchema);
