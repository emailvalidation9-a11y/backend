const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        enum: [
            'login', 'register', 'logout',
            'password_change', 'profile_update',
            'email_verified', 'password_reset',
            'validation_single', 'validation_bulk',
            'credit_purchase', 'plan_upgrade', 'plan_downgrade',
            'api_key_created', 'api_key_deleted',
            'account_deleted', 'export_results',
            'webhook_triggered'
        ],
        required: true
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },
    ip_address: String,
    user_agent: String
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false }
});

activityLogSchema.index({ user_id: 1, created_at: -1 });
activityLogSchema.index({ action: 1 });

module.exports = mongoose.model('ActivityLog', activityLogSchema);
