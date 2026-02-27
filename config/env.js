/**
 * Environment validation — fail fast at startup if required vars are missing.
 * Add or remove keys per environment (see .env.example).
 */
const required = [
  'MONGODB_URI',
  'JWT_SECRET',
];

const optional = [
  'PORT',
  'NODE_ENV',
  'FRONTEND_URL',
  'JWT_EXPIRES_IN',
  'VALIDATION_ENGINE_URL',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'DEMO_EMAIL',
  'DEMO_PASSWORD',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
];

function validateEnv() {
  const missing = required.filter((key) => !process.env[key] || process.env[key].trim() === '');
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    console.error('Set them in .env or the hosting platform. See .env.example.');
    process.exit(1);
  }

  if (process.env.NODE_ENV === 'production') {
    const weak = ['JWT_SECRET'];
    const weakFound = weak.filter((key) => {
      const v = process.env[key];
      return v && v.length < 16;
    });
    if (weakFound.length > 0) {
      console.warn('Warning: In production, use strong values for:', weakFound.join(', '));
    }
  }

  return { required, optional };
}

module.exports = { validateEnv };
