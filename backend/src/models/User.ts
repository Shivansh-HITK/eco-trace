import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcryptjs';
import { IUser, UserRole, UserStatus } from '@types/index';

const AddressSchema = new Schema({
  street: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zipCode: { type: String, required: true },
  country: { type: String, required: true, default: 'India' },
  coordinates: {
    latitude: { type: Number },
    longitude: { type: Number }
  }
}, { _id: false });

const ProfileSchema = new Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phone: { 
    type: String, 
    required: true,
    validate: {
      validator: function(v: string) {
        return /^[+]?[\d\s-()]+$/.test(v);
      },
      message: 'Phone number is not valid'
    }
  },
  address: { type: AddressSchema, required: true },
  avatar: { type: String },
  organizationName: { type: String }, // For NGOs
  licenseNumber: { type: String }, // For drivers
  verificationDocuments: [{ type: String }]
}, { _id: false });

const NotificationPreferencesSchema = new Schema({
  email: { type: Boolean, default: true },
  sms: { type: Boolean, default: true },
  push: { type: Boolean, default: true }
}, { _id: false });

const PreferencesSchema = new Schema({
  notifications: { type: NotificationPreferencesSchema, default: {} },
  language: { type: String, default: 'en' }
}, { _id: false });

const StatisticsSchema = new Schema({
  totalItemsSubmitted: { type: Number, default: 0 },
  totalCreditsEarned: { type: Number, default: 0 },
  totalCarbonFootprintReduced: { type: Number, default: 0 }
}, { _id: false });

const UserSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: {
      validator: function(v: string) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
      },
      message: 'Email is not valid'
    }
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
    validate: {
      validator: function(v: string) {
        return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(v);
      },
      message: 'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
    }
  },
  role: {
    type: String,
    enum: Object.values(UserRole),
    required: true
  },
  status: {
    type: String,
    enum: Object.values(UserStatus),
    default: UserStatus.PENDING_VERIFICATION
  },
  profile: { type: ProfileSchema, required: true },
  preferences: { type: PreferencesSchema, default: {} },
  statistics: { type: StatisticsSchema, default: {} },
  lastLogin: { type: Date },
  isEmailVerified: { type: Boolean, default: false },
  isPhoneVerified: { type: Boolean, default: false },
  refreshToken: { type: String }
}, {
  timestamps: true,
  toJSON: {
    transform: function(doc, ret) {
      delete ret.password;
      delete ret.refreshToken;
      return ret;
    }
  }
});

// Indexes for better query performance
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ 'profile.phone': 1 });
UserSchema.index({ 'profile.address.city': 1 });
UserSchema.index({ 'profile.address.state': 1 });
UserSchema.index({ createdAt: -1 });

// Pre-save middleware to hash password
UserSchema.pre<IUser>('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get full name
UserSchema.methods.getFullName = function(): string {
  return `${this.profile.firstName} ${this.profile.lastName}`;
};

// Method to update statistics
UserSchema.methods.updateStatistics = function(itemsCount: number, credits: number, carbonReduction: number) {
  this.statistics.totalItemsSubmitted += itemsCount;
  this.statistics.totalCreditsEarned += credits;
  this.statistics.totalCarbonFootprintReduced += carbonReduction;
  return this.save();
};

// Static method to find users by role
UserSchema.statics.findByRole = function(role: UserRole) {
  return this.find({ role, status: UserStatus.ACTIVE });
};

// Static method to find nearby users (NGOs/Drivers)
UserSchema.statics.findNearby = function(
  coordinates: { latitude: number; longitude: number },
  maxDistance: number = 10000, // 10km in meters
  role?: UserRole
) {
  const query: any = {
    'profile.address.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [coordinates.longitude, coordinates.latitude]
        },
        $maxDistance: maxDistance
      }
    },
    status: UserStatus.ACTIVE
  };

  if (role) {
    query.role = role;
  }

  return this.find(query);
};

// Create geospatial index for location-based queries
UserSchema.index({ 'profile.address.coordinates': '2dsphere' });

// Virtual for user's display name
UserSchema.virtual('displayName').get(function(this: IUser) {
  if (this.role === UserRole.NGO && this.profile.organizationName) {
    return this.profile.organizationName;
  }
  return this.getFullName();
});

// Ensure virtual fields are serialized
UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

export const User = mongoose.model<IUser>('User', UserSchema);