const { validateEmail } = require('./services/validationService');

async function testValidationConnection() {
    console.log('🧪 Testing Validation Engine Connection...\n');
    
    try {
        // Test with a valid email
        console.log('Testing valid email: test@gmail.com');
        const result = await validateEmail('test@gmail.com', { verifySMTP: true });
        console.log('✅ Validation successful!');
        console.log('Result:', JSON.stringify(result, null, 2));
        
        // Test with an invalid email
        console.log('\nTesting invalid email: invalid@email');
        const invalidResult = await validateEmail('invalid@email', { verifySMTP: false });
        console.log('✅ Invalid email validation successful!');
        console.log('Result:', JSON.stringify(invalidResult, null, 2));
        
    } catch (error) {
        console.error('❌ Validation test failed:', error.message);
        
        if (error.message.includes('ECONNREFUSED')) {
            console.error('\n💡 Troubleshooting steps:');
            console.error('1. Make sure the Validation Engine is running on port 3000');
            console.error('2. Run: cd "../Validation Engine" && npm start');
            console.error('3. Check if VALIDATION_ENGINE_URL is set correctly in .env');
        }
    }
}

// Run the test
testValidationConnection();