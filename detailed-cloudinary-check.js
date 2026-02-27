const dotenv = require('dotenv');
dotenv.config();

console.log('=== Detailed Cloudinary Diagnostics ===\n');

// Check all environment variables
console.log('All Environment Variables containing "CLOUDINARY":');
Object.keys(process.env)
    .filter(key => key.includes('CLOUDINARY'))
    .forEach(key => {
        console.log(`${key}:`, process.env[key] || 'NOT SET');
    });

console.log('\n--- Testing Cloudinary Module ---');

try {
    const cloudinaryModule = require('cloudinary');
    console.log('✅ Cloudinary base module loaded');
    
    const cloudinary = cloudinaryModule.v2;
    console.log('✅ Cloudinary v2 API loaded');
    
    // Configure with current environment
    console.log('\n--- Configuration Attempt ---');
    try {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        
        const config = cloudinary.config();
        console.log('Configuration applied:');
        console.log('  cloud_name:', config.cloud_name || 'NOT SET');
        console.log('  api_key:', config.api_key ? 'SET' : 'NOT SET');
        console.log('  api_secret:', config.api_secret ? 'SET (hidden)' : 'NOT SET');
        
        if (!config.cloud_name || !config.api_key || !config.api_secret) {
            console.log('❌ Missing required configuration values');
            console.log('You need to set:');
            if (!config.cloud_name) console.log('  - CLOUDINARY_CLOUD_NAME');
            if (!config.api_key) console.log('  - CLOUDINARY_API_KEY');
            if (!config.api_secret) console.log('  - CLOUDINARY_API_SECRET');
        } else {
            console.log('✅ All required configuration values present');
            
            // Test API connection
            console.log('\n--- Testing API Connection ---');
            cloudinary.api.ping()
                .then(result => {
                    console.log('✅ Cloudinary API connection successful!');
                    console.log('Response:', JSON.stringify(result, null, 2));
                })
                .catch(error => {
                    console.log('❌ Cloudinary API connection failed');
                    console.log('Error:', error.message);
                    console.log('Error details:', error);
                });
        }
        
    } catch (configError) {
        console.log('❌ Configuration error:', configError.message);
    }
    
} catch (error) {
    console.log('❌ Failed to load Cloudinary:', error.message);
    console.log('Error stack:', error.stack);
}