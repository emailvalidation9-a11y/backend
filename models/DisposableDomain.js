const mongoose = require('mongoose');

const disposableDomainSchema = new mongoose.Schema({
    domain: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    provider: {
        type: String,
        default: 'unknown'
    },
    is_active: {
        type: Boolean,
        default: true
    },
    source: {
        type: String
    }
}, {
    timestamps: { createdAt: 'added_at', updatedAt: 'updated_at' }
});



module.exports = mongoose.model('DisposableDomain', disposableDomainSchema);
