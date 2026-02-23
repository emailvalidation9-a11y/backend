const User = require('../models/User');
const { generateToken } = require('../utils/jwt');
const { AppError } = require('../utils/errorHandler');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const sendEmail = require('../utils/email');
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

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

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
        subject: 'SpamGuard - Verify Your Email Address',
        message: `Welcome to SpamGuard, ${newUser.name}! Please verify your email by visiting: ${verifyURL}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #6366f1; text-align: center;">Welcome to SpamGuard!</h1>
            <p style="font-size: 16px; color: #333;">Hi ${newUser.name},</p>
            <p style="font-size: 16px; color: #333;">Thanks for signing up! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyURL}" style="background-color: #6366f1; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Verify My Email</a>
            </div>
            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 14px; color: #6366f1; word-break: break-all;">${verifyURL}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `
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
      return next(new AppError('There is no user with that email address.', 404));
    }

    // Create reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.password_reset_token = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.password_reset_expires = Date.now() + 10 * 60 * 1000; // 10 mins
    await user.save({ validateBeforeSave: false });

    // Send email
    const resetURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password/${resetToken}`;
    const message = `Forgot your password? Reset it here: ${resetURL}.\nIf you didn't forget your password, please ignore this email!`;

    try {
      await sendEmail({
        email: user.email,
        subject: 'Your password reset token (valid for 10 min)',
        message,
        html: `<h1>Password Reset</h1><p>Forgot your password? <a href="${resetURL}">Click here to reset it.</a></p><p>If you didn't request this, please ignore this email.</p>`
      });

      res.status(200).json({
        status: 'success',
        message: 'Token sent to email!'
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
      password_reset_expires: { $gt: Date.now() }
    });

    if (!user) {
      return next(new AppError('Token is invalid or has expired', 400));
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
        subject: 'Password Reset Successful',
        message: 'Your password has been reset successfully.',
        html: '<h1>Success</h1><p>Your password has been reset successfully.</p>'
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

    const user = await User.findOne({ verification_token: hashedToken });

    if (!user) {
      return next(new AppError('Invalid or expired verification token', 400));
    }

    user.email_verified = true;
    user.verification_token = undefined;
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

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(verificationToken).digest('hex');

    user.verification_token = hashedToken;
    await user.save({ validateBeforeSave: false });

    // Send verification email
    const verifyURL = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/verify-email/${verificationToken}`;
    try {
      await sendEmail({
        email: user.email,
        subject: 'SpamGuard - Verify Your Email Address',
        message: `Please verify your email by visiting: ${verifyURL}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #6366f1; text-align: center;">Verify Your Email</h1>
            <p style="font-size: 16px; color: #333;">Hi ${user.name},</p>
            <p style="font-size: 16px; color: #333;">Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verifyURL}" style="background-color: #6366f1; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">Verify My Email</a>
            </div>
            <p style="font-size: 14px; color: #666;">Or copy and paste this link into your browser:</p>
            <p style="font-size: 14px; color: #6366f1; word-break: break-all;">${verifyURL}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999; text-align: center;">If you didn't create an account, you can safely ignore this email.</p>
          </div>
        `
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
