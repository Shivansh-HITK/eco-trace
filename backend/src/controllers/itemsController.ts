import { Response } from 'express';
import { EWasteItem } from '@models/EWasteItem';
import { User } from '@models/User';
import { Notification } from '@models/Notification';
import { QRCodeUtils } from '@utils/qrcode';
import { 
  AuthenticatedRequest, 
  ApiResponse, 
  DeviceType, 
  ItemCondition, 
  ItemStatus,
  NotificationType,
  UserRole,
  PaginationOptions,
  SearchFilters
} from '@types/index';

export class ItemsController {
  /**
   * Create new e-waste item
   */
  static async createItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const {
        deviceType,
        brand,
        model,
        serialNumber,
        condition,
        estimatedWeight,
        photos,
        description,
        location
      } = req.body;

      // Create new item
      const item = new EWasteItem({
        submittedBy: req.user._id,
        deviceType,
        brand,
        model,
        serialNumber,
        condition,
        estimatedWeight,
        photos: photos || [],
        description,
        location: {
          pickup: location,
          current: location
        }
      });

      await item.save();

      // Generate QR code
      const qrData = QRCodeUtils.generateQRData({
        _id: item._id,
        trackingId: item.trackingId,
        deviceType: item.deviceType,
        brand: item.brand,
        model: item.model,
        status: item.status,
        submittedAt: item.createdAt,
        estimatedCredits: item.estimatedCredits,
        submittedBy: item.submittedBy
      });

      const qrCodeDataURL = await QRCodeUtils.generateQRCodeDataURL(qrData);
      
      // Save QR code to item
      item.qrCode = qrCodeDataURL;
      await item.save();

      // Update user statistics
      await req.user.updateStatistics(1, item.estimatedCredits, 0);

      // Create notification
      await Notification.createNotification(
        req.user._id,
        NotificationType.ITEM_STATUS_UPDATE,
        'Item Registered Successfully',
        `Your ${item.brand} ${item.model} has been registered with tracking ID: ${item.trackingId}`,
        { itemId: item._id, trackingId: item.trackingId }
      );

      const response: ApiResponse = {
        success: true,
        message: 'E-waste item created successfully',
        data: {
          item: {
            id: item._id,
            trackingId: item.trackingId,
            deviceType: item.deviceType,
            brand: item.brand,
            model: item.model,
            condition: item.condition,
            estimatedWeight: item.estimatedWeight,
            status: item.status,
            estimatedCredits: item.estimatedCredits,
            qrCode: item.qrCode,
            location: item.location,
            createdAt: item.createdAt
          }
        }
      };

      res.status(201).json(response);
    } catch (error: any) {
      console.error('Create item error:', error);

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
        message: 'Error creating e-waste item',
        error: 'ITEM_CREATION_FAILED'
      });
    }
  }

  /**
   * Get user's items with pagination and filters
   */
  static async getUserItems(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const {
        page = 1,
        limit = 10,
        status,
        deviceType,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = { submittedBy: req.user._id };
      
      if (status) {
        query.status = status;
      }
      
      if (deviceType) {
        query.deviceType = deviceType;
      }

      // Get total count
      const total = await EWasteItem.countDocuments(query);

      // Get items
      const items = await EWasteItem.find(query)
        .sort({ [sortBy as string]: sortOrder === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limitNum)
        .populate('assignedDriver', 'profile.firstName profile.lastName profile.phone')
        .populate('assignedNGO', 'profile.organizationName profile.phone')
        .lean();

      const response: ApiResponse = {
        success: true,
        message: 'Items retrieved successfully',
        data: { items },
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          totalPages: Math.ceil(total / limitNum)
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get user items error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving items',
        error: 'ITEMS_FETCH_FAILED'
      });
    }
  }

  /**
   * Get single item by ID
   */
  static async getItemById(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const item = await EWasteItem.findById(id)
        .populate('submittedBy', 'profile.firstName profile.lastName email profile.phone')
        .populate('assignedDriver', 'profile.firstName profile.lastName profile.phone')
        .populate('assignedNGO', 'profile.organizationName profile.phone')
        .lean();

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Item not found',
          error: 'ITEM_NOT_FOUND'
        });
        return;
      }

      // Check access permissions
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const canAccess = 
        req.user.role === UserRole.ADMIN ||
        item.submittedBy._id.toString() === req.user._id.toString() ||
        (item.assignedDriver && item.assignedDriver._id.toString() === req.user._id.toString()) ||
        (item.assignedNGO && item.assignedNGO._id.toString() === req.user._id.toString());

      if (!canAccess) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          error: 'ACCESS_DENIED'
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'Item retrieved successfully',
        data: { item }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get item by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving item',
        error: 'ITEM_FETCH_FAILED'
      });
    }
  }

  /**
   * Track item by tracking ID
   */
  static async trackItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { trackingId } = req.params;

      const item = await EWasteItem.findOne({ trackingId })
        .populate('submittedBy', 'profile.firstName profile.lastName')
        .populate('assignedDriver', 'profile.firstName profile.lastName profile.phone')
        .populate('assignedNGO', 'profile.organizationName profile.phone')
        .lean();

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Item not found',
          error: 'ITEM_NOT_FOUND'
        });
        return;
      }

      // Public tracking information (limited data)
      const trackingInfo = {
        trackingId: item.trackingId,
        deviceType: item.deviceType,
        brand: item.brand,
        model: item.model,
        status: item.status,
        estimatedCredits: item.estimatedCredits,
        timeline: item.timeline.map(entry => ({
          status: entry.status,
          timestamp: entry.timestamp,
          location: entry.location,
          notes: entry.notes
        })),
        environmentalImpact: item.environmentalImpact,
        submittedAt: item.createdAt
      };

      const response: ApiResponse = {
        success: true,
        message: 'Item tracking information retrieved',
        data: { item: trackingInfo }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Track item error:', error);
      res.status(500).json({
        success: false,
        message: 'Error tracking item',
        error: 'TRACKING_FAILED'
      });
    }
  }

  /**
   * Update item status (for drivers/NGOs)
   */
  static async updateItemStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const { id } = req.params;
      const { status, location, notes, actualWeight } = req.body;

      const item = await EWasteItem.findById(id);
      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Item not found',
          error: 'ITEM_NOT_FOUND'
        });
        return;
      }

      // Check permissions
      const canUpdate = 
        req.user.role === UserRole.ADMIN ||
        (item.assignedDriver && item.assignedDriver.toString() === req.user._id.toString()) ||
        (item.assignedNGO && item.assignedNGO.toString() === req.user._id.toString());

      if (!canUpdate) {
        res.status(403).json({
          success: false,
          message: 'Not authorized to update this item',
          error: 'UPDATE_NOT_AUTHORIZED'
        });
        return;
      }

      // Update status and timeline
      await item.updateStatus(status, req.user._id, location, notes);

      // Update actual weight if provided
      if (actualWeight && status === ItemStatus.PICKED_UP) {
        item.actualWeight = actualWeight;
        await item.save();
      }

      // Calculate environmental impact if item is completed
      if (status === ItemStatus.RECYCLED || status === ItemStatus.DISPOSED) {
        await item.calculateEnvironmentalImpact();
        
        // Update actual credits based on final processing
        item.actualCredits = item.estimatedCredits;
        await item.save();

        // Update user statistics
        const submittedUser = await User.findById(item.submittedBy);
        if (submittedUser) {
          await submittedUser.updateStatistics(0, 0, item.environmentalImpact.carbonFootprintReduced);
        }
      }

      // Send notification to item owner
      await Notification.createNotification(
        item.submittedBy,
        NotificationType.ITEM_STATUS_UPDATE,
        'Item Status Updated',
        `Your ${item.brand} ${item.model} status has been updated to: ${status}`,
        { itemId: item._id, trackingId: item.trackingId, newStatus: status }
      );

      const response: ApiResponse = {
        success: true,
        message: 'Item status updated successfully',
        data: {
          item: {
            id: item._id,
            trackingId: item.trackingId,
            status: item.status,
            timeline: item.timeline,
            actualWeight: item.actualWeight,
            actualCredits: item.actualCredits,
            environmentalImpact: item.environmentalImpact
          }
        }
      };

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Update item status error:', error);

      if (error.name === 'ValidationError') {
        res.status(400).json({
          success: false,
          message: 'Invalid status value',
          error: 'INVALID_STATUS'
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: 'Error updating item status',
        error: 'STATUS_UPDATE_FAILED'
      });
    }
  }

  /**
   * Generate QR code for item
   */
  static async generateQRCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const { id } = req.params;
      const { format = 'dataURL', width = 256 } = req.query;

      const item = await EWasteItem.findById(id);
      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Item not found',
          error: 'ITEM_NOT_FOUND'
        });
        return;
      }

      // Check ownership
      if (item.submittedBy.toString() !== req.user._id.toString() && req.user.role !== UserRole.ADMIN) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
          error: 'ACCESS_DENIED'
        });
        return;
      }

      const qrData = QRCodeUtils.generateQRData({
        _id: item._id,
        trackingId: item.trackingId,
        deviceType: item.deviceType,
        brand: item.brand,
        model: item.model,
        status: item.status,
        submittedAt: item.createdAt,
        estimatedCredits: item.estimatedCredits,
        submittedBy: item.submittedBy
      });

      let qrCode: string | Buffer;
      const options = { width: parseInt(width as string) };

      switch (format) {
        case 'svg':
          qrCode = await QRCodeUtils.generateQRCodeSVG(qrData, options);
          break;
        case 'buffer':
          qrCode = await QRCodeUtils.generateQRCodeBuffer(qrData, options);
          break;
        default:
          qrCode = await QRCodeUtils.generateQRCodeDataURL(qrData, options);
      }

      const response: ApiResponse = {
        success: true,
        message: 'QR code generated successfully',
        data: {
          qrCode,
          trackingId: item.trackingId,
          format
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Generate QR code error:', error);
      res.status(500).json({
        success: false,
        message: 'Error generating QR code',
        error: 'QR_GENERATION_FAILED'
      });
    }
  }

  /**
   * Scan QR code and get item information
   */
  static async scanQRCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { qrData } = req.body;

      let parsedData;
      try {
        parsedData = QRCodeUtils.parseQRData(qrData);
      } catch (error) {
        res.status(400).json({
          success: false,
          message: 'Invalid QR code format',
          error: 'INVALID_QR_FORMAT'
        });
        return;
      }

      const item = await EWasteItem.findById(parsedData.itemId)
        .populate('submittedBy', 'profile.firstName profile.lastName profile.phone')
        .populate('assignedDriver', 'profile.firstName profile.lastName profile.phone')
        .populate('assignedNGO', 'profile.organizationName profile.phone')
        .lean();

      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Item not found',
          error: 'ITEM_NOT_FOUND'
        });
        return;
      }

      // Verify QR code authenticity
      const isValid = QRCodeUtils.verifyQRCode(parsedData, {
        _id: item._id,
        trackingId: item.trackingId,
        submittedBy: item.submittedBy._id
      });

      if (!isValid) {
        res.status(400).json({
          success: false,
          message: 'QR code verification failed',
          error: 'QR_VERIFICATION_FAILED'
        });
        return;
      }

      const response: ApiResponse = {
        success: true,
        message: 'QR code scanned successfully',
        data: {
          item: {
            id: item._id,
            trackingId: item.trackingId,
            deviceType: item.deviceType,
            brand: item.brand,
            model: item.model,
            status: item.status,
            condition: item.condition,
            estimatedWeight: item.estimatedWeight,
            actualWeight: item.actualWeight,
            estimatedCredits: item.estimatedCredits,
            timeline: item.timeline,
            environmentalImpact: item.environmentalImpact,
            submittedBy: item.submittedBy,
            assignedDriver: item.assignedDriver,
            assignedNGO: item.assignedNGO,
            createdAt: item.createdAt
          }
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Scan QR code error:', error);
      res.status(500).json({
        success: false,
        message: 'Error scanning QR code',
        error: 'QR_SCAN_FAILED'
      });
    }
  }

  /**
   * Delete item (only by owner or admin)
   */
  static async deleteItem(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const { id } = req.params;

      const item = await EWasteItem.findById(id);
      if (!item) {
        res.status(404).json({
          success: false,
          message: 'Item not found',
          error: 'ITEM_NOT_FOUND'
        });
        return;
      }

      // Check permissions
      const canDelete = 
        req.user.role === UserRole.ADMIN ||
        (item.submittedBy.toString() === req.user._id.toString() && 
         item.status === ItemStatus.REGISTERED);

      if (!canDelete) {
        res.status(403).json({
          success: false,
          message: 'Cannot delete item that is already in process',
          error: 'DELETE_NOT_ALLOWED'
        });
        return;
      }

      await EWasteItem.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Item deleted successfully'
      });
    } catch (error) {
      console.error('Delete item error:', error);
      res.status(500).json({
        success: false,
        message: 'Error deleting item',
        error: 'DELETE_FAILED'
      });
    }
  }

  /**
   * Get dashboard statistics for user
   */
  static async getDashboardStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
          error: 'AUTH_REQUIRED'
        });
        return;
      }

      const userId = req.user._id;
      
      // Get user's items statistics
      const totalItems = await EWasteItem.countDocuments({ submittedBy: userId });
      const itemsInProgress = await EWasteItem.countDocuments({ 
        submittedBy: userId,
        status: { $in: [ItemStatus.PICKUP_SCHEDULED, ItemStatus.PICKED_UP, ItemStatus.IN_TRANSIT, ItemStatus.AT_SORTING_CENTER, ItemStatus.BEING_PROCESSED] }
      });
      const itemsCompleted = await EWasteItem.countDocuments({ 
        submittedBy: userId,
        status: { $in: [ItemStatus.RECYCLED, ItemStatus.DISPOSED] }
      });

      // Get credits and environmental impact
      const creditsResult = await EWasteItem.aggregate([
        { $match: { submittedBy: userId } },
        { $group: { _id: null, totalCredits: { $sum: '$actualCredits' }, estimatedCredits: { $sum: '$estimatedCredits' } } }
      ]);

      const carbonResult = await EWasteItem.aggregate([
        { $match: { submittedBy: userId } },
        { $group: { _id: null, totalCarbon: { $sum: '$environmentalImpact.carbonFootprintReduced' } } }
      ]);

      const totalCredits = creditsResult[0]?.totalCredits || creditsResult[0]?.estimatedCredits || 0;
      const carbonFootprintReduced = carbonResult[0]?.totalCarbon || 0;

      // Get recent activity
      const recentItems = await EWasteItem.find({ submittedBy: userId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .lean();

      const recentActivity = recentItems.map(item => ({
        type: 'status_update',
        message: `${item.brand} ${item.model} - ${item.status}`,
        timestamp: item.updatedAt
      }));

      const response: ApiResponse = {
        success: true,
        message: 'Dashboard statistics retrieved successfully',
        data: {
          stats: {
            totalItems,
            itemsInProgress,
            itemsCompleted,
            totalCredits,
            carbonFootprintReduced,
            recentActivity
          }
        }
      };

      res.status(200).json(response);
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Error retrieving dashboard statistics',
        error: 'STATS_FETCH_FAILED'
      });
    }
  }
}