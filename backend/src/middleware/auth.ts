import { Request, Response, NextFunction } from 'express';
import { JWTUtils } from '@utils/jwt';
import { User } from '@models/User';
import { UserRole, AuthenticatedRequest } from '@types/index';

/**
 * Authentication middleware - verifies JWT token
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader || '');

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token is required',
        error: 'MISSING_TOKEN'
      });
      return;
    }

    // Verify the token
    const decoded = JWTUtils.verifyAccessToken(token);

    // Get user from database
    const user = await User.findById(decoded.userId).select('-password -refreshToken');
    
    if (!user) {
      res.status(401).json({
        success: false,
        message: 'User not found',
        error: 'USER_NOT_FOUND'
      });
      return;
    }

    if (user.status !== 'active') {
      res.status(403).json({
        success: false,
        message: 'Account is not active',
        error: 'ACCOUNT_INACTIVE'
      });
      return;
    }

    // Attach user to request object
    req.user = user;
    next();

  } catch (error: any) {
    if (error.message === 'Access token expired') {
      res.status(401).json({
        success: false,
        message: 'Access token expired',
        error: 'TOKEN_EXPIRED'
      });
    } else if (error.message === 'Invalid access token') {
      res.status(401).json({
        success: false,
        message: 'Invalid access token',
        error: 'INVALID_TOKEN'
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Authentication failed',
        error: 'AUTH_FAILED'
      });
    }
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader || '');

    if (token) {
      const decoded = JWTUtils.verifyAccessToken(token);
      const user = await User.findById(decoded.userId).select('-password -refreshToken');
      
      if (user && user.status === 'active') {
        req.user = user;
      }
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

/**
 * Role-based authorization middleware
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        error: 'AUTH_REQUIRED'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions',
        error: 'INSUFFICIENT_PERMISSIONS',
        data: {
          requiredRoles: roles,
          userRole: req.user.role
        }
      });
      return;
    }

    next();
  };
};

/**
 * Admin only middleware
 */
export const adminOnly = authorize(UserRole.ADMIN);

/**
 * NGO or Admin middleware
 */
export const ngoOrAdmin = authorize(UserRole.NGO, UserRole.ADMIN);

/**
 * Driver or NGO or Admin middleware
 */
export const driverOrNgoOrAdmin = authorize(UserRole.DRIVER, UserRole.NGO, UserRole.ADMIN);

/**
 * Individual user or Admin middleware
 */
export const individualOrAdmin = authorize(UserRole.INDIVIDUAL, UserRole.ADMIN);

/**
 * Middleware to check if user owns the resource
 */
export const checkResourceOwnership = (resourceField: string = 'submittedBy') => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      // Admin can access any resource
      if (req.user.role === UserRole.ADMIN) {
        next();
        return;
      }

      // Get resource ID from params
      const resourceId = req.params.id;
      if (!resourceId) {
        res.status(400).json({
          success: false,
          message: 'Resource ID is required',
          error: 'MISSING_RESOURCE_ID'
        });
        return;
      }

      // This would need to be customized based on the model being accessed
      // For now, we'll assume the resource has the ownership field
      const EWasteItem = await import('@models/EWasteItem');
      const resource = await EWasteItem.EWasteItem.findById(resourceId);

      if (!resource) {
        res.status(404).json({
          success: false,
          message: 'Resource not found',
          error: 'RESOURCE_NOT_FOUND'
        });
        return;
      }

      // Check ownership
      const ownerId = resource[resourceField as keyof typeof resource]?.toString();
      if (ownerId !== req.user._id.toString()) {
        res.status(403).json({
          success: false,
          message: 'Access denied - not resource owner',
          error: 'NOT_RESOURCE_OWNER'
        });
        return;
      }

      next();
    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error checking resource ownership',
        error: 'OWNERSHIP_CHECK_FAILED'
      });
    }
  };
};

/**
 * Middleware to check email verification
 */
export const requireEmailVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'AUTH_REQUIRED'
    });
    return;
  }

  if (!req.user.isEmailVerified) {
    res.status(403).json({
      success: false,
      message: 'Email verification required',
      error: 'EMAIL_NOT_VERIFIED'
    });
    return;
  }

  next();
};

/**
 * Middleware to check phone verification
 */
export const requirePhoneVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'AUTH_REQUIRED'
    });
    return;
  }

  if (!req.user.isPhoneVerified) {
    res.status(403).json({
      success: false,
      message: 'Phone verification required',
      error: 'PHONE_NOT_VERIFIED'
    });
    return;
  }

  next();
};

/**
 * Middleware to require both email and phone verification
 */
export const requireFullVerification = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
      error: 'AUTH_REQUIRED'
    });
    return;
  }

  if (!req.user.isEmailVerified || !req.user.isPhoneVerified) {
    res.status(403).json({
      success: false,
      message: 'Full account verification required',
      error: 'VERIFICATION_REQUIRED',
      data: {
        emailVerified: req.user.isEmailVerified,
        phoneVerified: req.user.isPhoneVerified
      }
    });
    return;
  }

  next();
};