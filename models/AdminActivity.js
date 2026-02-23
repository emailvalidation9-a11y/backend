const mongoose = require('mongoose');

const adminActivitySchema = new mongoose.Schema({
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    action: {
        type: String,
        required: true
    },
    target_type: {
        type: String,
        enum: ['user', 'api_key', 'system'],
        default: 'user'
    },
    target_id: {
        type: mongoose.Schema.Types.ObjectId
    },
    target_label: String,  // e.g. user email or key name
    details: mongoose.Schema.Types.Mixed,
    ip: String
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

module.exports = mongoose.model('AdminActivity', adminActivitySchema);
