const mongoose = require('mongoose');

const validationResultSchema = new mongoose.Schema({
    job_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ValidationJob',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    email: {
        type: String,
        required: true
    },
    domain: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['valid', 'invalid', 'catch_all', 'disposable', 'role_based', 'unknown'],
        required: true
    },
    checks: {
        syntax_valid: { type: Boolean, default: false },
        mx_found: { type: Boolean, default: false },
        smtp_valid: { type: Boolean, default: false },
        catch_all: { type: Boolean, default: false },
        disposable: { type: Boolean, default: false },
        role_based: { type: Boolean, default: false },
        free_provider: { type: Boolean, default: false }
    },
    score: {
        type: Number,
        min: 0,
        max: 100,
        required: true
    },
    mx_records: {
        type: [String],
        default: []
    },
    smtp_response_code: {
        type: String
    },
    smtp_response_message: {
        type: String
    },
    response_time_ms: {
        type: Number
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

validationResultSchema.index({ job_id: 1, email: 1 });
validationResultSchema.index({ user_id: 1, status: 1 });

module.exports = mongoose.model('ValidationResult', validationResultSchema);
