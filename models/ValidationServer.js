const mongoose = require('mongoose');

const validationServerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Server name is required'],
        trim: true,
        maxlength: [100, 'Name cannot exceed 100 characters']
    },
    url: {
        type: String,
        required: [true, 'Server URL is required'],
        trim: true,
        match: [/^https?:\/\/.+/, 'Please enter a valid URL']
    },
    isActive: {
        type: Boolean,
        default: true
    },
    isHealthy: {
        type: Boolean,
        default: true
    },
    weight: {
        type: Number,
        default: 1,
        min: 1,
        max: 10
    },
    lastHealthCheck: {
        type: Date,
        default: Date.now
    },
    totalRequests: {
        type: Number,
        default: 0
    },
    successRate: {
        type: Number,
        default: 100,
        min: 0,
        max: 100
    },
    avgResponseTime: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

validationServerSchema.index({ isActive: 1, isHealthy: 1 });
validationServerSchema.index({ url: 1 }, { unique: true });

module.exports = mongoose.model('ValidationServer', validationServerSchema);