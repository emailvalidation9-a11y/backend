const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't include password in queries by default
  },
  credits: {
    type: Number,
    default: 100
  },
  total_validations: {
    type: Number,
    default: 0
  },
  plan: {
    name: {
      type: String,
      default: 'free'
    },
    credits_limit: {
      type: Number,
      default: 100
    },
    renewal_date: {
      type: Date
    }
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  stripe: {
    subscription_id: String,
    status: {
      type: String,
      enum: ['active', 'inactive', 'canceled', 'past_due'],
      default: 'inactive'
    }
  },
  email_verified: {
    type: Boolean,
    default: false
  },
  verification_token: String,
  password_reset_token: String,
  password_reset_expires: Date,
  last_login: Date,
  avatar: {
    url: String,
    publicId: String
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Pre-save middleware to hash password
userSchema.pre('save', async function () {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return;

  // Hash password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
});

// Pre-save middleware to set renewal date for new users
userSchema.pre('save', function () {
  if (this.isNew && this.plan) {
    if (this.plan.name.toLowerCase() === 'free') {
      this.plan.renewal_date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    } else {
      this.plan.renewal_date = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
    }
  }
});

// Instance method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Instance method to get user data without sensitive info
userSchema.methods.getPublicProfile = function () {
  const userObject = this.toObject();
  delete userObject.password;
  delete userObject.verification_token;
  delete userObject.password_reset_token;
  delete userObject.password_reset_expires;
  return userObject;
};

// Static method to find user by email with password
userSchema.statics.findByEmailWithPassword = function (email) {
  return this.findOne({ email }).select('+password');
};

module.exports = mongoose.model('User', userSchema);