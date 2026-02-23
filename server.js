const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const billingRoutes = require('./routes/billing');
const keysRoutes = require('./routes/keys');
const validateRoutes = require('./routes/validate');
const blogRoutes = require('./routes/blog');
const settingsRoutes = require('./routes/settings');
const contactRoutes = require('./routes/contact');
const serversRoutes = require('./routes/servers');
const pricingRoutes = require('./routes/pricing');
const accountRoutes = require('./routes/account');
const uploadRoutes = require('./routes/upload');
const healthRoutes = require('./routes/health');
const healthCheckService = require('./services/healthCheckService');
const { AppError, sendErrorDev, sendErrorProd } = require('./utils/errorHandler');
const { validateEnv } = require('./config/env');
const requestId = require('./middleware/requestId');
const { generalLimiter } = require('./middleware/rateLimiter');

dotenv.config();
validateEnv();

const app = express();
const PORT = process.env.PORT || 5000;

// Security and base middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [process.env.FRONTEND_URL || 'http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));
app.use(requestId);
app.use(express.json({ limit: '1mb' }));

// Rate limit all /api (health is exempt inside generalLimiter)
app.use('/api', generalLimiter);

// MongoDB Connection & Server Start Lifecycle
console.log('Attempting MongoDB Connection...');
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/spamguard')
  .then(async () => {
    console.log('✅ MongoDB connected successfully');

    // Start server
    app.listen(PORT, async () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Demo credentials:`);
      console.log(`Email: ${process.env.DEMO_EMAIL}`);
      console.log(`Password: ${process.env.DEMO_PASSWORD}`);

      // Create demo user safely after connection
      await createDemoUser();
    });
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'SpamGuard API is running' });
});

// API Routes (health first for probes)
app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/keys', keysRoutes);
app.use('/api/validate', validateRoutes);
app.use('/api/blog', blogRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/servers', serversRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/upload', uploadRoutes);

// Create demo user if it doesn't exist
const createDemoUser = async () => {
  const User = require('./models/User');
  const bcrypt = require('bcryptjs');

  try {
    const existingUser = await User.findOne({ email: process.env.DEMO_EMAIL });
    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(process.env.DEMO_PASSWORD, 12);
      await User.create({
        name: 'Demo User',
        email: process.env.DEMO_EMAIL,
        password: hashedPassword,
        credits: 1000,
        total_validations: 150,
        plan: {
          name: 'Starter',
          credits_limit: 5000,
          renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        },
        role: 'user',
        stripe: {
          subscription_id: 'sub_demo123',
          status: 'active'
        },
        email_verified: true,
        is_active: true
      });
      console.log('Demo user created successfully');
    } else {
      console.log('Demo user already exists');
    }
  } catch (error) {
    console.error('Error creating demo user:', error);
  }
};

// Start health check service
setTimeout(() => {
  healthCheckService.start();
}, 5000); // Start after server is running

// Global error handling middleware
app.all('*', (req, res, next) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

app.use((err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, res);
  } else {
    sendErrorProd(err, res);
  }
});

// Lifecycle managed inside mongoose.connect block at the top