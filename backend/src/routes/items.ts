import { Router } from 'express';
import { ItemsController } from '@controllers/itemsController';
import { authenticate, requireFullVerification } from '@middleware/auth';
import Joi from 'joi';

const router = Router();

// Validation schemas
const createItemSchema = Joi.object({
  deviceType: Joi.string().valid(
    'smartphone', 'laptop', 'tablet', 'desktop', 'television', 
    'refrigerator', 'washing_machine', 'air_conditioner', 'microwave', 
    'printer', 'router', 'battery', 'cables', 'other'
  ).required(),
  brand: Joi.string().required(),
  model: Joi.string().required(),
  serialNumber: Joi.string().optional(),
  condition: Joi.string().valid('working', 'partially_working', 'not_working', 'damaged').required(),
  estimatedWeight: Joi.number().min(0.1).max(1000).required(),
  photos: Joi.array().items(Joi.string().uri()).optional(),
  description: Joi.string().max(1000).optional(),
  location: Joi.object({
    address: Joi.string().required(),
    coordinates: Joi.object({
      latitude: Joi.number().required(),
      longitude: Joi.number().required()
    }).required()
  }).required()
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid(
    'registered', 'pickup_scheduled', 'picked_up', 'in_transit', 
    'at_sorting_center', 'being_processed', 'recycled', 'disposed', 'cancelled'
  ).required(),
  location: Joi.object({
    address: Joi.string().required(),
    coordinates: Joi.object({
      latitude: Joi.number().required(),
      longitude: Joi.number().required()
    }).required()
  }).optional(),
  notes: Joi.string().max(500).optional(),
  actualWeight: Joi.number().min(0.1).max(1000).optional()
});

const scanQRSchema = Joi.object({
  qrData: Joi.string().required()
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

// Apply authentication to all routes
router.use(authenticate);

// Public tracking route (no authentication required)
router.get('/track/:trackingId', ItemsController.trackItem);

// Item CRUD operations
router.post('/', requireFullVerification, validateRequest(createItemSchema), ItemsController.createItem);
router.get('/my-items', ItemsController.getUserItems);
router.get('/dashboard-stats', ItemsController.getDashboardStats);
router.get('/:id', ItemsController.getItemById);
router.put('/:id/status', validateRequest(updateStatusSchema), ItemsController.updateItemStatus);
router.delete('/:id', ItemsController.deleteItem);

// QR Code operations
router.get('/:id/qr-code', ItemsController.generateQRCode);
router.post('/scan-qr', validateRequest(scanQRSchema), ItemsController.scanQRCode);

export default router;