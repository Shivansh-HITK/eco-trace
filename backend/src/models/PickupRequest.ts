import mongoose, { Schema } from 'mongoose';
import { IPickupRequest, PickupStatus } from '@types/index';

const CoordinatesSchema = new Schema({
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true }
}, { _id: false });

const LocationSchema = new Schema({
  address: { type: String, required: true },
  coordinates: { type: CoordinatesSchema, required: true }
}, { _id: false });

const PickupRequestSchema = new Schema<IPickupRequest>({
  requestedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  items: [{
    type: Schema.Types.ObjectId,
    ref: 'EWasteItem',
    required: true
  }],
  assignedDriver: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  assignedNGO: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  status: {
    type: String,
    enum: Object.values(PickupStatus),
    default: PickupStatus.PENDING
  },
  scheduledDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(v: Date) {
        return v > new Date();
      },
      message: 'Scheduled date must be in the future'
    }
  },
  actualPickupDate: { type: Date },
  location: { type: LocationSchema, required: true },
  notes: {
    type: String,
    maxlength: 500
  },
  estimatedDuration: {
    type: Number,
    required: true,
    min: 15, // minimum 15 minutes
    max: 480 // maximum 8 hours
  },
  actualDuration: {
    type: Number,
    min: 1
  }
}, {
  timestamps: true
});

// Indexes for better query performance
PickupRequestSchema.index({ requestedBy: 1 });
PickupRequestSchema.index({ assignedDriver: 1 });
PickupRequestSchema.index({ assignedNGO: 1 });
PickupRequestSchema.index({ status: 1 });
PickupRequestSchema.index({ scheduledDate: 1 });
PickupRequestSchema.index({ createdAt: -1 });
PickupRequestSchema.index({ 'location.coordinates': '2dsphere' });

// Pre-save middleware to update item statuses
PickupRequestSchema.pre<IPickupRequest>('save', async function(next) {
  if (this.isModified('status')) {
    const EWasteItem = mongoose.model('EWasteItem');
    
    if (this.status === PickupStatus.SCHEDULED) {
      await EWasteItem.updateMany(
        { _id: { $in: this.items } },
        { 
          status: 'pickup_scheduled',
          assignedDriver: this.assignedDriver,
          assignedNGO: this.assignedNGO
        }
      );
    } else if (this.status === PickupStatus.COMPLETED && !this.actualPickupDate) {
      this.actualPickupDate = new Date();
      await EWasteItem.updateMany(
        { _id: { $in: this.items } },
        { status: 'picked_up' }
      );
    }
  }
  next();
});

// Method to assign driver and NGO
PickupRequestSchema.methods.assignToDriverAndNGO = function(driverId: string, ngoId: string) {
  this.assignedDriver = driverId;
  this.assignedNGO = ngoId;
  this.status = PickupStatus.ASSIGNED;
  return this.save();
};

// Method to complete pickup
PickupRequestSchema.methods.completePickup = function(actualDuration?: number) {
  this.status = PickupStatus.COMPLETED;
  this.actualPickupDate = new Date();
  if (actualDuration) {
    this.actualDuration = actualDuration;
  }
  return this.save();
};

// Static method to find pending requests near location
PickupRequestSchema.statics.findPendingNearLocation = function(
  coordinates: { latitude: number; longitude: number },
  maxDistance: number = 20000 // 20km in meters
) {
  return this.find({
    status: { $in: [PickupStatus.PENDING, PickupStatus.ASSIGNED] },
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates.longitude, coordinates.latitude]
        },
        $maxDistance: maxDistance
      }
    }
  })
  .populate('requestedBy', 'profile.firstName profile.lastName profile.phone')
  .populate('items', 'deviceType brand model estimatedWeight')
  .sort({ scheduledDate: 1 });
};

// Static method to find driver's assigned requests
PickupRequestSchema.statics.findDriverRequests = function(driverId: string) {
  return this.find({ assignedDriver: driverId })
    .populate('requestedBy', 'profile.firstName profile.lastName profile.phone profile.address')
    .populate('items', 'deviceType brand model trackingId estimatedWeight')
    .sort({ scheduledDate: 1 });
};

// Static method to find NGO's requests
PickupRequestSchema.statics.findNGORequests = function(ngoId: string) {
  return this.find({ assignedNGO: ngoId })
    .populate('requestedBy', 'profile.firstName profile.lastName profile.phone')
    .populate('assignedDriver', 'profile.firstName profile.lastName profile.phone')
    .populate('items', 'deviceType brand model trackingId estimatedWeight status')
    .sort({ scheduledDate: 1 });
};

// Virtual for total estimated weight
PickupRequestSchema.virtual('totalEstimatedWeight').get(function(this: IPickupRequest) {
  if (!this.populated('items')) return 0;
  return (this.items as any[]).reduce((total, item) => total + (item.estimatedWeight || 0), 0);
});

// Virtual for items count
PickupRequestSchema.virtual('itemsCount').get(function(this: IPickupRequest) {
  return this.items.length;
});

// Virtual for time until pickup
PickupRequestSchema.virtual('timeUntilPickup').get(function(this: IPickupRequest) {
  const now = new Date();
  const scheduled = new Date(this.scheduledDate);
  const diffMs = scheduled.getTime() - now.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60))); // hours
});

// Ensure virtual fields are serialized
PickupRequestSchema.set('toJSON', { virtuals: true });
PickupRequestSchema.set('toObject', { virtuals: true });

export const PickupRequest = mongoose.model<IPickupRequest>('PickupRequest', PickupRequestSchema);