const mongoose = require('mongoose');

const validationJobSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    api_key_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApiKey',
        default: null
    },
    type: {
        type: String,
        enum: ['single', 'bulk'],
        required: true
    },
    engine_job_id: {
        type: String
    },
    source: {
        type: String,
        enum: ['dashboard', 'api'],
        required: true
    },
    total_emails: {
        type: Number,
        required: true,
        default: 0
    },
    processed_emails: {
        type: Number,
        default: 0
    },
    status: {
        type: String,
        enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'],
        default: 'queued'
    },
    credits_used: {
        type: Number,
        default: 0
    },
    credits_reserved: {
        type: Number,
        default: 0
    },
    file_info: {
        original_filename: String,
        stored_path: String,
        file_size: Number
    },
    email_column: {
        type: String,
        default: 'email'
    },
    result_file: {
        path: String,
        download_url: String,
        expires_at: Date
    },
    server_used: {
        type: String
    },
    webhook_url: {
        type: String
    },
    webhook_sent: {
        type: Boolean,
        default: false
    },
    error_message: {
        type: String
    },
    progress_percentage: {
        type: Number,
        default: 0
    },
    valid_count: {
        type: Number,
        default: 0
    },
    invalid_count: {
        type: Number,
        default: 0
    },
    catch_all_count: {
        type: Number,
        default: 0
    },
    disposable_count: {
        type: Number,
        default: 0
    },
    role_based_count: {
        type: Number,
        default: 0
    },
    unknown_count: {
        type: Number,
        default: 0
    },
    input_data: {
        type: mongoose.Schema.Types.Mixed
    },
    processing_started_at: {
        type: Date
    },
    completed_at: {
        type: Date
    }
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
});

validationJobSchema.index({ user_id: 1, status: 1, created_at: -1 });

module.exports = mongoose.model('ValidationJob', validationJobSchema);
