const mongoose = require('mongoose');

const apiKeySchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    key_hash: {
        type: String,
        required: true,
        unique: true
    },
    key_preview: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true,
        default: 'Default API Key'
    },
    usage_count: {
        type: Number,
        default: 0
    },
    rate_limit_per_minute: {
        type: Number,
        default: 60
    },
    is_active: {
        type: Boolean,
        default: true
    },
    last_used_at: {
        type: Date,
        default: null
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

apiKeySchema.index({ user_id: 1 });

module.exports = mongoose.model('ApiKey', apiKeySchema);
