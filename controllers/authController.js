const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { AppError } = require('../utils/errorHandler');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sendEmail = require('../utils/email');
const emailTemplates = require('../utils/emailTemplates');
const { logActivity } = require('./accountController');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('User already exists with this email', 400));
    }

    // Generate email verification token (expires after VERIFICATION_LINK_EXPIRE_HOURS, default 24)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationExpireHours = parseInt(process.env.VERIFICATION_LINK_EXPIRE_HOURS, 10) || 24;
    const verificationExpires = new Date(Date.now() + verificationExpireHours * 60 * 60 * 1000);

    // Create user (password is hashed by the pre-save hook in the User model)
    const newUser = await User.create({
      name,
      email,
      password,
      credits: 100,
      total_validations: 0,
      plan: {
        name: 'Free',
        credits_limit: 100,
        renewal_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      },
      role: 'user',
      email_verified: false,
      verification_token: hashedToken,
      verification_expires: verificationExpires,
      is_active: true,
      last_login: new Date()
    });

    // Generate auth token
    const token = generateToken(newUser._id);

    // Send Verification Email
    const verifyURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;
    try {
      await sendEmail({
        email: newUser.email,
        subject: 'TrueValidator - Verify Your Email Address',
        message: `Welcome to TrueValidator, ${newUser.name}! Please verify your email by visiting: ${verifyURL}`,
        html: emailTemplates.verifyEmail({ name: newUser.name, verifyURL, isWelcome: true, expiryHours: verificationExpireHours }),
      });
    } catch (err) {
      console.log('Error sending verification email', err);
    }

    // Send response (user is NOT verified yet)
    await logActivity(newUser._id, 'register', { email: newUser.email }, req);
    res.status(201).json({
      status: 'success',
      data: {
        token,
        user: newUser.getPublicProfile(),
        message: 'Registration successful! Please check your email to verify your account.'
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // Find user by email with password included
    const user = await User.findByEmailWithPassword(email);

    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // Check if user is active
    if (!user.is_active) {
      return next(new AppError('This account has been deactivated', 401));
    }

    // Generate token with MongoDB ObjectId
    const token = generateToken(user._id);

    // Update last login
    user.last_login = new Date();
    await user.save({ validateBeforeSave: false });

    await logActivity(user._id, 'login', {}, req);

    // If email not verified, still return user data
    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res, next) => {
  try {
    // req.user is already set by the protect middleware from MongoDB
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res, next) => {
  try {
    const { name } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (name) user.name = name;

    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: 'success',
      data: {
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change password
// @route   PUT /api/auth/password
// @access  Private
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return next(new AppError('Please provide current and new password', 400));
    }

    // Get user with password
    const user = await User.findByEmailWithPassword(req.user.email);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Check current password
    if (!(await user.comparePassword(currentPassword))) {
      return next(new AppError('Current password is incorrect', 401));
    }

    // Set new password (will be hashed by the pre-save hook)
    user.password = newPassword;
    await user.save();

    // Generate new token
    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      data: {
        token,
        message: 'Password updated successfully'
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logout = async (req, res, next) => {
  try {
    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Check if system setup is needed (no admin exists)
// @route   GET /api/auth/setup/status
// @access  Public
const setupStatus = async (req, res, next) => {
  try {
    const adminCount = await User.countDocuments({ role: 'admin' });
    res.status(200).json({
      status: 'success',
      data: {
        setupRequired: adminCount === 0,
        adminExists: adminCount > 0
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create the initial system admin account
// @route   POST /api/auth/setup
// @access  Public (only works when no admin exists)
const setupAdmin = async (req, res, next) => {
  try {
    // Check if any admin already exists
    const adminCount = await User.countDocuments({ role: 'admin' });
    if (adminCount > 0) {
      return next(new AppError('System is already configured. An admin account exists.', 403));
    }

    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return next(new AppError('Please provide name, email and password', 400));
    }

    if (password.length < 6) {
      return next(new AppError('Password must be at least 6 characters', 400));
    }

    // Check if user already exists with this email
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      // If user exists but is not admin, promote them
      existingUser.role = 'admin';
      existingUser.is_active = true;
      existingUser.email_verified = true;
      existingUser.credits = 999999;
      existingUser.plan = {
        name: 'Growth',
        credits_limit: 999999,
        renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      };
      await existingUser.save({ validateBeforeSave: false });

      const token = generateToken(existingUser._id);
      return res.status(200).json({
        status: 'success',
        message: 'Existing user promoted to admin',
        data: {
          token,
          user: existingUser.getPublicProfile()
        }
      });
    }

    // Create new admin user
    const admin = await User.create({
      name,
      email,
      password,
      role: 'admin',
      credits: 999999,
      total_validations: 0,
      plan: {
        name: 'Growth',
        credits_limit: 999999,
        renewal_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      },
      email_verified: true,
      is_active: true,
      last_login: new Date()
    });

    const token = generateToken(admin._id);

    res.status(201).json({
      status: 'success',
      message: 'Admin account created successfully',
      data: {
        token,
        user: admin.getPublicProfile()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password
// @route   POST /api/auth/forgotpassword
// @access  Public
const forgotPassword = async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      // Return same response whether user exists or not to prevent email enumeration
      return res.status(200).json({
        status: 'success',
        message: 'If an account with that email exists, a reset link has been sent.'
      });
    }

    // Create reset token (expires after PASSWORD_RESET_EXPIRE_MINUTES, default 10)
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.password_reset_token = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetExpireMinutes = parseInt(process.env.PASSWORD_RESET_EXPIRE_MINUTES, 10) || 10;
    user.password_reset_expires = new Date(Date.now() + resetExpireMinutes * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Send email
    const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
    const message = `Forgot your password? Reset it here: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'TrueValidator - Reset Your Password',
        message,
        html: emailTemplates.passwordResetRequest({ resetURL, expiryMinutes: resetExpireMinutes }),
      });

      res.status(200).json({
        status: 'success',
        message: 'If an account with that email exists, a reset link has been sent.'
      });
    } catch (err) {
      user.password_reset_token = undefined;
      user.password_reset_expires = undefined;
      await user.save({ validateBeforeSave: false });
      return next(new AppError('There was an error sending the email. Try again later!', 500));
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password
// @route   POST /api/auth/resetpassword/:token
// @access  Public
const resetPassword = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      password_reset_token: hashedToken,
      password_reset_expires: { $gt: new Date() }
    });

    if (!user) {
      return next(new AppError('This link is invalid or has expired. Request a new password reset.', 400));
    }

    user.password = req.body.password;
    user.password_reset_token = undefined;
    user.password_reset_expires = undefined;
    await user.save();

    const token = generateToken(user._id);

    // Send confirmation email
    try {
      await sendEmail({
        email: user.email,
        subject: 'TrueValidator - Password Reset Successful',
        message: 'Your password has been reset successfully.',
        html: emailTemplates.passwordResetSuccess(),
      });
    } catch (err) {
      console.log('Error sending reset confirmation', err);
    }

    res.status(200).json({
      status: 'success',
      data: {
        token,
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify email address
// @route   GET /api/auth/verify-email/:token
// @access  Public
const verifyEmail = async (req, res, next) => {
  try {
    const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

    const user = await User.findOne({
      verification_token: hashedToken,
      verification_expires: { $gt: new Date() }
    });

    if (!user) {
      return next(new AppError('This verification link is invalid or has expired. Request a new one from your account.', 400));
    }

    user.email_verified = true;
    user.verification_token = undefined;
    user.verification_expires = undefined;
    await user.save({ validateBeforeSave: false });

    const token = generateToken(user._id);

    res.status(200).json({
      status: 'success',
      message: 'Email verified successfully!',
      data: {
        token,
        user: user.getPublicProfile()
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
// @access  Private
const resendVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    if (user.email_verified) {
      return res.status(200).json({
        status: 'success',
        message: 'Email is already verified'
      });
    }

    // Generate new verification token (expires after VERIFICATION_LINK_EXPIRE_HOURS, default 24)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const verificationExpireHours = parseInt(process.env.VERIFICATION_LINK_EXPIRE_HOURS, 10) || 24;
    user.verification_token = hashedToken;
    user.verification_expires = new Date(Date.now() + verificationExpireHours * 60 * 60 * 1000);
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verifyURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;
    try {
      await sendEmail({
        email: user.email,
        subject: 'TrueValidator - Verify Your Email Address',
        message: `Please verify your email by visiting: ${verifyURL}`,
        html: emailTemplates.verifyEmail({ name: user.name, verifyURL, isWelcome: false, expiryHours: verificationExpireHours }),
      });
    } catch (err) {
      console.log('Error sending verification email', err);
      return next(new AppError('There was an error sending the email. Try again later!', 500));
    }

    res.status(200).json({
      status: 'success',
      message: 'Verification email sent!'
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  register,
  login,
  getMe,
  updateProfile,
  changePassword,
  logout,
  setupStatus,
  setupAdmin,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification
};
