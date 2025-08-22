import mongoose, { Schema } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { IEWasteItem, DeviceType, ItemCondition, ItemStatus } from '@types/index';

const CoordinatesSchema = new Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true }
}, { _id: false });

const LocationSchema = new Schema({
  address: { type: String, required: true },
  coordinates: { type: CoordinatesSchema, required: true }
}, { _id: false });

const CurrentLocationSchema = new Schema({
  address: { type: String, required: true },
  coordinates: { type: CoordinatesSchema, required: true },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const ItemLocationSchema = new Schema({
  pickup: { type: LocationSchema, required: true },
  current: { type: CurrentLocationSchema }
}, { _id: false });

const TimelineEntrySchema = new Schema({
  status: {
    type: String,
    enum: Object.values(ItemStatus),
    required: true
  },
  timestamp: { type: Date, default: Date.now },
  updatedBy: { 
    type: Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  location: { type: LocationSchema },
  notes: { type: String }
}, { _id: false });

const MaterialsRecoveredSchema = new Schema({
  metal: { type: Number, default: 0 },
  plastic: { type: Number, default: 0 },
  glass: { type: Number, default: 0 },
  other: { type: Number, default: 0 }
}, { _id: false });

const EnvironmentalImpactSchema = new Schema({
  carbonFootprintReduced: { type: Number, default: 0 }, // in kg CO2
  materialsRecovered: { type: MaterialsRecoveredSchema, default: {} }
}, { _id: false });

const EWasteItemSchema = new Schema<IEWasteItem>({
  trackingId: {
    type: String,
    unique: true,
    default: () => `ET${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`
  },
  qrCode: { type: String }, // Will be generated after item creation
  submittedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  assignedDriver: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedNGO: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  deviceType: {
    type: String,
    enum: Object.values(DeviceType),
    required: true
  },
  brand: {
    type: String,
    required: true,
    trim: true
  },
  model: {
    type: String,
    required: true,
    trim: true
  },
  serialNumber: {
    type: String,
    trim: true
  },
  condition: {
    type: String,
    enum: Object.values(ItemCondition),
    required: true
  },
  estimatedWeight: {
    type: Number,
    required: true,
    min: 0.1,
    max: 1000 // Max 1000kg
  },
  actualWeight: {
    type: Number,
    min: 0.1,
    max: 1000
  },
  photos: [{
    type: String,
    validate: {
      validator: function(v: string) {
        return /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp)$/i.test(v);
      },
      message: 'Photo must be a valid image URL'
    }
  }],
  description: {
    type: String,
    maxlength: 1000
  },
  status: {
    type: String,
    enum: Object.values(ItemStatus),
    default: ItemStatus.REGISTERED
  },
  location: { type: ItemLocationSchema, required: true },
  timeline: [{ type: TimelineEntrySchema, default: [] }],
  estimatedCredits: {
    type: Number,
    default: 0,
    min: 0
  },
  actualCredits: {
    type: Number,
    min: 0
  },
  recyclingCenter: {
    type: String
  },
  environmentalImpact: { type: EnvironmentalImpactSchema, default: {} }
}, {
  timestamps: true
});

// Indexes for better query performance
EWasteItemSchema.index({ trackingId: 1 });
EWasteItemSchema.index({ submittedBy: 1 });
EWasteItemSchema.index({ assignedDriver: 1 });
EWasteItemSchema.index({ assignedNGO: 1 });
EWasteItemSchema.index({ status: 1 });
EWasteItemSchema.index({ deviceType: 1 });
EWasteItemSchema.index({ createdAt: -1 });
EWasteItemSchema.index({ 'location.pickup.coordinates': '2dsphere' });
EWasteItemSchema.index({ 'location.current.coordinates': '2dsphere' });

// Pre-save middleware to initialize timeline
EWasteItemSchema.pre<IEWasteItem>('save', function(next) {
  if (this.isNew) {
    this.timeline = [{
      status: this.status,
      timestamp: new Date(),
      updatedBy: this.submittedBy,
      location: this.location.pickup,
      notes: 'Item registered in the system'
    }];
    
    // Calculate estimated credits based on device type and weight
    this.estimatedCredits = this.calculateEstimatedCredits();
  }
  next();
});

// Method to calculate estimated credits
EWasteItemSchema.methods.calculateEstimatedCredits = function(): number {
  const creditRates: { [key in DeviceType]: number } = {
    [DeviceType.SMARTPHONE]: 10,
    [DeviceType.LAPTOP]: 25,
    [DeviceType.TABLET]: 15,
    [DeviceType.DESKTOP]: 30,
    [DeviceType.TELEVISION]: 20,
    [DeviceType.REFRIGERATOR]: 50,
    [DeviceType.WASHING_MACHINE]: 40,
    [DeviceType.AIR_CONDITIONER]: 35,
    [DeviceType.MICROWAVE]: 15,
    [DeviceType.PRINTER]: 12,
    [DeviceType.ROUTER]: 5,
    [DeviceType.BATTERY]: 8,
    [DeviceType.CABLES]: 2,
    [DeviceType.OTHER]: 5
  };

  const baseCredits = creditRates[this.deviceType] || 5;
  const weightMultiplier = Math.max(0.5, Math.min(2, this.estimatedWeight / 5));
  
  // Condition affects credits
  const conditionMultiplier = {
    [ItemCondition.WORKING]: 1.2,
    [ItemCondition.PARTIALLY_WORKING]: 1.0,
    [ItemCondition.NOT_WORKING]: 0.8,
    [ItemCondition.DAMAGED]: 0.6
  }[this.condition];

  return Math.round(baseCredits * weightMultiplier * conditionMultiplier);
};

// Method to update status and timeline
EWasteItemSchema.methods.updateStatus = function(
  newStatus: ItemStatus,
  updatedBy: string,
  location?: { address: string; coordinates: { latitude: number; longitude: number } },
  notes?: string
) {
  this.status = newStatus;
  
  const timelineEntry = {
    status: newStatus,
    timestamp: new Date(),
    updatedBy,
    location,
    notes
  };
  
  this.timeline.push(timelineEntry);
  
  // Update current location if provided
  if (location) {
    this.location.current = {
      ...location,
      updatedAt: new Date()
    };
  }
  
  return this.save();
};

// Method to calculate environmental impact
EWasteItemSchema.methods.calculateEnvironmentalImpact = function() {
  const carbonFootprintRates: { [key in DeviceType]: number } = {
    [DeviceType.SMARTPHONE]: 70, // kg CO2
    [DeviceType.LAPTOP]: 200,
    [DeviceType.TABLET]: 130,
    [DeviceType.DESKTOP]: 250,
    [DeviceType.TELEVISION]: 150,
    [DeviceType.REFRIGERATOR]: 300,
    [DeviceType.WASHING_MACHINE]: 200,
    [DeviceType.AIR_CONDITIONER]: 180,
    [DeviceType.MICROWAVE]: 80,
    [DeviceType.PRINTER]: 90,
    [DeviceType.ROUTER]: 40,
    [DeviceType.BATTERY]: 30,
    [DeviceType.CABLES]: 10,
    [DeviceType.OTHER]: 50
  };

  const carbonReduction = carbonFootprintRates[this.deviceType] || 50;
  
  // Estimate materials recovered based on device type and weight
  const materialsRecovered = {
    metal: this.estimatedWeight * 0.3, // 30% metal
    plastic: this.estimatedWeight * 0.4, // 40% plastic
    glass: this.estimatedWeight * 0.2, // 20% glass
    other: this.estimatedWeight * 0.1 // 10% other materials
  };

  this.environmentalImpact = {
    carbonFootprintReduced: carbonReduction,
    materialsRecovered
  };
  
  return this.save();
};

// Static method to find items by status
EWasteItemSchema.statics.findByStatus = function(status: ItemStatus) {
  return this.find({ status });
};

// Static method to find items near location
EWasteItemSchema.statics.findNearLocation = function(
  coordinates: { latitude: number; longitude: number },
  maxDistance: number = 10000 // 10km in meters
) {
  return this.find({
    'location.pickup.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates.longitude, coordinates.latitude]
        },
        $maxDistance: maxDistance
      }
    }
  });
};

// Static method to get user's items with pagination
EWasteItemSchema.statics.findUserItems = function(
  userId: string,
  page: number = 1,
  limit: number = 10,
  status?: ItemStatus
) {
  const query: any = { submittedBy: userId };
  if (status) query.status = status;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate('submittedBy', 'profile.firstName profile.lastName email')
    .populate('assignedDriver', 'profile.firstName profile.lastName profile.phone')
    .populate('assignedNGO', 'profile.organizationName profile.phone');
};

// Virtual for item age in days
EWasteItemSchema.virtual('ageInDays').get(function(this: IEWasteItem) {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Virtual for current status duration
EWasteItemSchema.virtual('currentStatusDuration').get(function(this: IEWasteItem) {
  const lastUpdate = this.timeline[this.timeline.length - 1];
  if (!lastUpdate) return 0;
  return Math.floor((Date.now() - lastUpdate.timestamp.getTime()) / (1000 * 60 * 60 * 24));
});

// Ensure virtual fields are serialized
EWasteItemSchema.set('toJSON', { virtuals: true });
EWasteItemSchema.set('toObject', { virtuals: true });

export const EWasteItem = mongoose.model<IEWasteItem>('EWasteItem', EWasteItemSchema);