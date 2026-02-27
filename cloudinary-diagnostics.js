const dotenv = require('dotenv');
dotenv.config();

console.log('=== Cloudinary Configuration Diagnostics ===\n');

// Check environment variables
console.log('Environment Variables:');
console.log('CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME || 'NOT SET');
console.log('CLOUDINARY_API_KEY:', process.env.CLOUDINARY_API_KEY ? 'SET' : 'NOT SET');
console.log('CLOUDINARY_API_SECRET:', process.env.CLOUDINARY_API_SECRET ? 'SET (hidden)' : 'NOT SET');

// Try to load Cloudinary module
try {
    console.log('\n--- Loading Cloudinary Module ---');
    const { cloudinary, uploadBuffer } = require('./utils/cloudinary');
    console.log('✅ Cloudinary module loaded successfully');
    
    // Test basic configuration
    const config = cloudinary.config();
    console.log('\n--- Current Configuration ---');
    console.log('Cloud Name:', config.cloud_name || 'NOT SET');
    console.log('API Key:', config.api_key ? 'SET' : 'NOT SET');
    console.log('API Secret:', config.api_secret ? 'SET (hidden)' : 'NOT SET');
    
    // Test ping Cloudinary service
    console.log('\n--- Testing Cloudinary Connection ---');
    cloudinary.api.ping()
        .then(result => {
            console.log('✅ Cloudinary API connection successful');
            console.log('Response:', result);
        })
        .catch(error => {
            console.log('❌ Cloudinary API connection failed');
            console.log('Error:', error.message);
            if (error.message.includes('Unauthorized')) {
                console.log('💡 This usually means invalid credentials');
            } else if (error.message.includes('getaddrinfo')) {
                console.log('💡 This usually means network connectivity issues');
            }
        });
        
} catch (error) {
    console.log('❌ Failed to load Cloudinary module');
    console.log('Error:', error.message);
}