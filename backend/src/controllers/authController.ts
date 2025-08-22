import { Request, Response } from 'express';
import { User } from '@models/User';
import { Notification } from '@models/Notification';
import { JWTUtils } from '@utils/jwt';
import { AuthenticatedRequest, ApiResponse, UserRole, UserStatus, NotificationType } from '@types/index';
import crypto from 'crypto';

export class AuthController {
  /**
   * Register new user
   */
  static async register(req: Request, res: Response): Promise<void> {
    try {
      const {
        email,
        password,
        role,
        profile,
        confirmPassword
      } = req.body;

      // Validate password confirmation
      if (password !== confirmPassword) {
        res.status(400).json({
          success: false,
          message: 'Passwords do not match',
          error: 'PASSWORD_MISMATCH'
        });
        return;
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        res.status(409).json({
          success: false,
          message: 'User with this email already exists',
          error: 'USER_EXISTS'
        });
        return;
      }

      // Validate role-specific requirements
      if (role === UserRole.NGO && !profile.organizationName) {
        res.status(400).json({
          success: false,
          message: 'Organization name is required for NGO registration',
          error: 'MISSING_ORGANIZATION_NAME'
        });
        return;
      }

      if (role === UserRole.DRIVER && !profile.licenseNumber) {
        res.status(400).json({
          success: false,
          message: 'License number is required for driver registration',
          error: 'MISSING_LICENSE_NUMBER'
        });
        return;
      }

      // Create new user
      const user = new User({
        email: email.toLowerCase(),
        password,
        role,
        profile,
        status: role === UserRole.ADMIN ? UserStatus.ACTIVE : UserStatus.PENDING_VERIFICATION
      });

      await user.save();

      // Generate tokens
      const tokens = JWTUtils.generateTokenPair(user);

      // Save refresh token
      user.refreshToken = tokens.refreshToken;
      await user.save();

      // Create welcome notification
      await Notification.createNotification(
        user._id,
        NotificationType.SYSTEM_ALERT,
        'Welcome to E-Waste Management!',
        'Your account has been created successfully. Please verify your email and phone number.',
        { registrationDate: new Date() }
      );

      const response: ApiResponse = {
        success: true,
        message: 'User registered successfully',
        data: {
          user: {
            id: user._id,
            email: user.email,
            role: user.role,
            profile: user.profile,
            status: user.status,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified
          },
          tokens
        }
      };

      res.status(201).json(response);
    } catch (error: any) {
      console.error('Registration error:', error);

      if (error.code === 11000) {
        res.status(409).json({
          success: false,
          message: 'User with this email already exists',
          error: 'DUPLICATE_EMAIL'
        });
        return;
      }

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map((err: any) => err.message);
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: 'VALIDATION_ERROR',
          data: { errors: validationErrors }
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during registration',
        error: 'REGISTRATION_FAILED'
      });
    }
  }

  /**
   * Login user
   */
  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      // Find user by email
      const user = await User.findOne({ email: email.toLowerCase() });
      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS'
        });
        return;
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password',
          error: 'INVALID_CREDENTIALS'
        });
        return;
      }

      // Check account status
      if (user.status === UserStatus.SUSPENDED) {
        res.status(403).json({
          success: false,
          message: 'Account has been suspended',
          error: 'ACCOUNT_SUSPENDED'
        });
        return;
      }

      // Generate tokens
      const tokens = JWTUtils.generateTokenPair(user);

      // Update user login info
      user.refreshToken = tokens.refreshToken;
      user.lastLogin = new Date();
      await user.save();

      const response: ApiResponse = {
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            email: user.email,
            role: user.role,
            profile: user.profile,
            status: user.status,
            isEmailVerified: user.isEmailVerified,
            isPhoneVerified: user.isPhoneVerified,
            statistics: user.statistics
          },
          tokens
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error during login',
        error: 'LOGIN_FAILED'
      });
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required',
          error: 'MISSING_REFRESH_TOKEN'
        });
        return;
      }

      // Verify refresh token
      const decoded = JWTUtils.verifyRefreshToken(refreshToken);

      // Find user and validate refresh token
      const user = await User.findById(decoded.userId);
      if (!user || user.refreshToken !== refreshToken) {
        res.status(401).json({
          success: false,
          message: 'Invalid refresh token',
          error: 'INVALID_REFRESH_TOKEN'
        });
        return;
      }

      // Generate new tokens
      const tokens = JWTUtils.generateTokenPair(user);

      // Update refresh token
      user.refreshToken = tokens.refreshToken;
      await user.save();

      const response: ApiResponse = {
        success: true,
        message: 'Token refreshed successfully',
        data: { tokens }
      };

      res.status(200).json(response);
    } catch (error: any) {
      if (error.message === 'Refresh token expired') {
        res.status(401).json({
          success: false,
          message: 'Refresh token expired',
          error: 'REFRESH_TOKEN_EXPIRED'
        });
      } else {
        res.status(401).json({
          success: false,
          message: 'Invalid refresh token',
          error: 'INVALID_REFRESH_TOKEN'
        });
      }
    }
  }

  /**
   * Logout user
   */
  static async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (req.user) {
        // Clear refresh token
        req.user.refreshToken = undefined;
        await req.user.save();
      }

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Error during logout',
        error: 'LOGOUT_FAILED'
      });
    }
  }

  /**
   * Get current user profile
   */
  static async getProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Profile retrieved successfully',
        data: {
          user: {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role,
            profile: req.user.profile,
            status: req.user.status,
            isEmailVerified: req.user.isEmailVerified,
            isPhoneVerified: req.user.isPhoneVerified,
            statistics: req.user.statistics,
            createdAt: req.user.createdAt,
            lastLogin: req.user.lastLogin
          }
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving profile',
        error: 'PROFILE_FETCH_FAILED'
      });
    }
  }

  /**
   * Update user profile
   */
  static async updateProfile(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const { profile, preferences } = req.body;

      // Update profile fields
      if (profile) {
        Object.assign(req.user.profile, profile);
      }

      if (preferences) {
        Object.assign(req.user.preferences, preferences);
      }

      await req.user.save();

      const response: ApiResponse = {
        success: true,
        message: 'Profile updated successfully',
        data: {
          user: {
            id: req.user._id,
            email: req.user.email,
            role: req.user.role,
            profile: req.user.profile,
            preferences: req.user.preferences
          }
        }
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Update profile error:', error);

      if (error.name === 'ValidationError') {
        const validationErrors = Object.values(error.errors).map((err: any) => err.message);
        res.status(400).json({
          success: false,
          message: 'Validation failed',
          error: 'VALIDATION_ERROR',
          data: { errors: validationErrors }
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error updating profile',
        error: 'PROFILE_UPDATE_FAILED'
      });
    }
  }

  /**
   * Change password
   */
  static async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const { currentPassword, newPassword, confirmPassword } = req.body;

      // Validate current password
      const isCurrentPasswordValid = await req.user.comparePassword(currentPassword);
      if (!isCurrentPasswordValid) {
        res.status(400).json({
          success: false,
          message: 'Current password is incorrect',
          error: 'INVALID_CURRENT_PASSWORD'
        });
        return;
      }

      // Validate new password confirmation
      if (newPassword !== confirmPassword) {
        res.status(400).json({
          success: false,
          message: 'New passwords do not match',
          error: 'PASSWORD_MISMATCH'
        });
        return;
      }

      // Update password
      req.user.password = newPassword;
      req.user.refreshToken = undefined; // Invalidate all existing sessions
      await req.user.save();

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error: any) {
      console.error('Change password error:', error);

      if (error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          message: 'Password validation failed',
          error: 'VALIDATION_ERROR'
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error changing password',
        error: 'PASSWORD_CHANGE_FAILED'
      });
    }
  }

  /**
   * Send email verification
   */
  static async sendEmailVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      if (req.user.isEmailVerified) {
        res.status(400).json({
          success: false,
          message: 'Email is already verified',
          error: 'EMAIL_ALREADY_VERIFIED'
        });
        return;
      }

      // Generate OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      const otpToken = JWTUtils.generateOTPToken(req.user._id, 'email', otp);

      // In production, send email with OTP
      // For now, we'll just return the OTP in development
      console.log(`Email verification OTP for ${req.user.email}: ${otp}`);

      res.status(200).json({
        success: true,
        message: 'Verification email sent successfully',
        data: {
          // Remove this in production
          otp: process.env.NODE_ENV === 'development' ? otp : undefined,
          otpToken
        }
      });
    } catch (error) {
      console.error('Send email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error sending verification email',
        error: 'EMAIL_SEND_FAILED'
      });
    }
  }

  /**
   * Verify email
   */
  static async verifyEmail(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const { otp, otpToken } = req.body;

      try {
        const decoded = JWTUtils.verifyOTPToken(otpToken);
        
        if (decoded.userId !== req.user._id || decoded.type !== 'email' || decoded.otp !== otp) {
          res.status(400).json({
            success: false,
            message: 'Invalid OTP',
            error: 'INVALID_OTP'
          });
          return;
        }

        // Mark email as verified
        req.user.isEmailVerified = true;
        if (req.user.status === UserStatus.PENDING_VERIFICATION && req.user.isPhoneVerified) {
          req.user.status = UserStatus.ACTIVE;
        }
        await req.user.save();

        res.status(200).json({
          success: true,
          message: 'Email verified successfully',
          data: {
            isEmailVerified: req.user.isEmailVerified,
            status: req.user.status
          }
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'OTP_VERIFICATION_FAILED'
        });
      }
    } catch (error) {
      console.error('Email verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying email',
        error: 'EMAIL_VERIFICATION_FAILED'
      });
    }
  }

  /**
   * Send phone verification
   */
  static async sendPhoneVerification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      if (req.user.isPhoneVerified) {
        res.status(400).json({
          success: false,
          message: 'Phone is already verified',
          error: 'PHONE_ALREADY_VERIFIED'
        });
        return;
      }

      // Generate OTP
      const otp = crypto.randomInt(100000, 999999).toString();
      const otpToken = JWTUtils.generateOTPToken(req.user._id, 'phone', otp);

      // In production, send SMS with OTP using Twilio
      console.log(`Phone verification OTP for ${req.user.profile.phone}: ${otp}`);

      res.status(200).json({
        success: true,
        message: 'Verification SMS sent successfully',
        data: {
          // Remove this in production
          otp: process.env.NODE_ENV === 'development' ? otp : undefined,
          otpToken
        }
      });
    } catch (error) {
      console.error('Send phone verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error sending verification SMS',
        error: 'SMS_SEND_FAILED'
      });
    }
  }

  /**
   * Verify phone
   */
  static async verifyPhone(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const { otp, otpToken } = req.body;

      try {
        const decoded = JWTUtils.verifyOTPToken(otpToken);
        
        if (decoded.userId !== req.user._id || decoded.type !== 'phone' || decoded.otp !== otp) {
          res.status(400).json({
            success: false,
            message: 'Invalid OTP',
            error: 'INVALID_OTP'
          });
          return;
        }

        // Mark phone as verified
        req.user.isPhoneVerified = true;
        if (req.user.status === UserStatus.PENDING_VERIFICATION && req.user.isEmailVerified) {
          req.user.status = UserStatus.ACTIVE;
        }
        await req.user.save();

        res.status(200).json({
          success: true,
          message: 'Phone verified successfully',
          data: {
            isPhoneVerified: req.user.isPhoneVerified,
            status: req.user.status
          }
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          message: error.message,
          error: 'OTP_VERIFICATION_FAILED'
        });
      }
    } catch (error) {
      console.error('Phone verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Error verifying phone',
        error: 'PHONE_VERIFICATION_FAILED'
      });
    }
  }
}