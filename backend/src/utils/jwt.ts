import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { JWTPayload, UserRole } from '@types/index';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-here';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export class JWTUtils {
  /**
   * Generate access token
   */
  static generateAccessToken(payload: {
    userId: string;
    email: string;
    role: UserRole;
  }): string {
    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
      issuer: 'ewaste-management',
      audience: 'ewaste-users'
    });
  }

  /**
   * Generate refresh token
   */
  static generateRefreshToken(userId: string): string {
    const payload = {
      userId,
      type: 'refresh',
      tokenId: crypto.randomUUID()
    };

    return jwt.sign(payload, JWT_REFRESH_SECRET, {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'ewaste-management',
      audience: 'ewaste-users'
    });
  }

  /**
   * Generate both access and refresh tokens
   */
  static generateTokenPair(user: {
    _id: string;
    email: string;
    role: UserRole;
  }) {
    const accessToken = this.generateAccessToken({
      userId: user._id,
      email: user.email,
      role: user.role
    });

    const refreshToken = this.generateRefreshToken(user._id);

    return {
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRES_IN
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): JWTPayload {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'ewaste-management',
        audience: 'ewaste-users'
      }) as JWTPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): any {
    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
        issuer: 'ewaste-management',
        audience: 'ewaste-users'
      });

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      } else {
        throw new Error('Refresh token verification failed');
      }
    }
  }

  /**
   * Extract token from Authorization header
   */
  static extractTokenFromHeader(authHeader: string): string | null {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    return authHeader.substring(7); // Remove 'Bearer ' prefix
  }

  /**
   * Get token expiration time
   */
  static getTokenExpiration(token: string): Date | null {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000);
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if token is expired
   */
  static isTokenExpired(token: string): boolean {
    const expiration = this.getTokenExpiration(token);
    if (!expiration) return true;
    
    return expiration.getTime() < Date.now();
  }

  /**
   * Get token payload without verification (for debugging)
   */
  static decodeToken(token: string): any {
    try {
      return jwt.decode(token);
    } catch (error) {
      return null;
    }
  }

  /**
   * Generate OTP token for email/phone verification
   */
  static generateOTPToken(userId: string, type: 'email' | 'phone', otp: string): string {
    const payload = {
      userId,
      type,
      otp,
      purpose: 'verification'
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: '10m', // OTP valid for 10 minutes
      issuer: 'ewaste-management',
      audience: 'ewaste-verification'
    });
  }

  /**
   * Verify OTP token
   */
  static verifyOTPToken(token: string): any {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'ewaste-management',
        audience: 'ewaste-verification'
      });

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('OTP expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid OTP token');
      } else {
        throw new Error('OTP verification failed');
      }
    }
  }

  /**
   * Generate password reset token
   */
  static generatePasswordResetToken(userId: string, email: string): string {
    const payload = {
      userId,
      email,
      purpose: 'password-reset',
      resetId: crypto.randomUUID()
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: '1h', // Password reset valid for 1 hour
      issuer: 'ewaste-management',
      audience: 'ewaste-password-reset'
    });
  }

  /**
   * Verify password reset token
   */
  static verifyPasswordResetToken(token: string): any {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'ewaste-management',
        audience: 'ewaste-password-reset'
      });

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Password reset token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid password reset token');
      } else {
        throw new Error('Password reset token verification failed');
      }
    }
  }

  /**
   * Generate QR code verification token
   */
  static generateQRVerificationToken(itemId: string, userId: string): string {
    const payload = {
      itemId,
      userId,
      purpose: 'qr-verification',
      verificationId: crypto.randomUUID()
    };

    return jwt.sign(payload, JWT_SECRET, {
      expiresIn: '24h', // QR verification valid for 24 hours
      issuer: 'ewaste-management',
      audience: 'ewaste-qr-verification'
    });
  }

  /**
   * Verify QR code token
   */
  static verifyQRToken(token: string): any {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'ewaste-management',
        audience: 'ewaste-qr-verification'
      });

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('QR verification token expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid QR verification token');
      } else {
        throw new Error('QR verification failed');
      }
    }
  }
}