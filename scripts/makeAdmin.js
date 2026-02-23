const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const User = require('../models/User');

async function run() {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOneAndUpdate(
        { email: process.env.DEMO_EMAIL },
        { role: 'admin' },
        { new: true }
    );
    if (user) {
        console.log(`✅ ${user.email} is now role: ${user.role}`);
    } else {
        console.log('❌ User not found');
    }
    await mongoose.disconnect();
}

run().catch(console.error);
