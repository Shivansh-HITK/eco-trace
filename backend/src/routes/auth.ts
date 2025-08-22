import { Router } from 'express';
import { AuthController } from '@controllers/authController';
import { authenticate } from '@middleware/auth';
import { validateRequest } from '@middleware/validation';
import Joi from 'joi';

const router = Router();

// Validation schemas
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  confirmPassword: Joi.string().valid(Joi.ref('password')).required(),
  role: Joi.string().valid('individual', 'ngo', 'driver').required(),
  profile: Joi.object({
    firstName: Joi.string().required(),
    lastName: Joi.string().required(),
    phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/).required(),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      zipCode: Joi.string().required(),
      country: Joi.string().default('India'),
      coordinates: Joi.object({
        latitude: Joi.number(),
        longitude: Joi.number()
      }).optional()
    }).required(),
    organizationName: Joi.string().when('role', { is: 'ngo', then: Joi.required() }),
    licenseNumber: Joi.string().when('role', { is: 'driver', then: Joi.required() }),
    avatar: Joi.string().uri().optional()
  }).required()
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

const updateProfileSchema = Joi.object({
  profile: Joi.object({
    firstName: Joi.string(),
    lastName: Joi.string(),
    phone: Joi.string().pattern(/^[+]?[\d\s-()]+$/),
    address: Joi.object({
      street: Joi.string(),
      city: Joi.string(),
      state: Joi.string(),
      zipCode: Joi.string(),
      country: Joi.string(),
      coordinates: Joi.object({
        latitude: Joi.number(),
        longitude: Joi.number()
      })
    }),
    organizationName: Joi.string(),
    licenseNumber: Joi.string(),
    avatar: Joi.string().uri()
  }),
  preferences: Joi.object({
    notifications: Joi.object({
      email: Joi.boolean(),
      sms: Joi.boolean(),
      push: Joi.boolean()
    }),
    language: Joi.string()
  })
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
});

const verifyOTPSchema = Joi.object({
  otp: Joi.string().length(6).pattern(/^\d+$/).required(),
  otpToken: Joi.string().required()
});

// Middleware function to validate request body
function validateRequest(schema: Joi.ObjectSchema) {
  return (req: any, res: any, next: any) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        error: 'VALIDATION_ERROR',
        data: { errors: error.details.map((detail: any) => detail.message) }
      });
    }
    next();
  };
}

// Public routes
router.post('/register', validateRequest(registerSchema), AuthController.register);
router.post('/login', validateRequest(loginSchema), AuthController.login);
router.post('/refresh-token', validateRequest(refreshTokenSchema), AuthController.refreshToken);

// Protected routes
router.use(authenticate); // All routes below require authentication

router.post('/logout', AuthController.logout);
router.get('/profile', AuthController.getProfile);
router.put('/profile', validateRequest(updateProfileSchema), AuthController.updateProfile);
router.put('/change-password', validateRequest(changePasswordSchema), AuthController.changePassword);

// Verification routes
router.post('/send-email-verification', AuthController.sendEmailVerification);
router.post('/verify-email', validateRequest(verifyOTPSchema), AuthController.verifyEmail);
router.post('/send-phone-verification', AuthController.sendPhoneVerification);
router.post('/verify-phone', validateRequest(verifyOTPSchema), AuthController.verifyPhone);

export default router;