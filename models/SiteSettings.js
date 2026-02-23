const mongoose = require('mongoose');

const siteSettingsSchema = new mongoose.Schema({
    // Only one document should exist
    isSingleton: {
        type: Boolean,
        default: true,
        unique: true
    },
    socialMedia: {
        twitter: { type: String, default: '' },
        facebook: { type: String, default: '' },
        linkedin: { type: String, default: '' },
        instagram: { type: String, default: '' },
        github: { type: String, default: '' }
    },
    contactInfo: {
        email: { type: String, default: '' },
        phone: { type: String, default: '' },
        address: { type: String, default: '' },
        supportEmail: { type: String, default: '' },
        salesEmail: { type: String, default: '' }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('SiteSettings', siteSettingsSchema);
