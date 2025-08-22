import { Document } from 'mongoose';

// User Types
export enum UserRole {
  INDIVIDUAL = 'individual',
  NGO = 'ngo',
  DRIVER = 'driver',
  ADMIN = 'admin'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification'
}

export interface IUser extends Document {
  _id: string;
  email: string;
  password: string;
  role: UserRole;
  status: UserStatus;
  profile: {
    firstName: string;
    lastName: string;
    phone: string;
    address: {
      street: string;
      city: string;
      state: string;
      zipCode: string;
      country: string;
      coordinates?: {
        latitude: number;
        longitude: number;
      };
    };
    avatar?: string;
    organizationName?: string; // For NGOs
    licenseNumber?: string; // For drivers
    verificationDocuments?: string[];
  };
  preferences: {
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
    language: string;
  };
  statistics: {
    totalItemsSubmitted: number;
    totalCreditsEarned: number;
    totalCarbonFootprintReduced: number;
  };
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  refreshToken?: string;
}

// E-Waste Item Types
export enum DeviceType {
  SMARTPHONE = 'smartphone',
  LAPTOP = 'laptop',
  TABLET = 'tablet',
  DESKTOP = 'desktop',
  TELEVISION = 'television',
  REFRIGERATOR = 'refrigerator',
  WASHING_MACHINE = 'washing_machine',
  AIR_CONDITIONER = 'air_conditioner',
  MICROWAVE = 'microwave',
  PRINTER = 'printer',
  ROUTER = 'router',
  BATTERY = 'battery',
  CABLES = 'cables',
  OTHER = 'other'
}

export enum ItemCondition {
  WORKING = 'working',
  PARTIALLY_WORKING = 'partially_working',
  NOT_WORKING = 'not_working',
  DAMAGED = 'damaged'
}

export enum ItemStatus {
  REGISTERED = 'registered',
  PICKUP_SCHEDULED = 'pickup_scheduled',
  PICKED_UP = 'picked_up',
  IN_TRANSIT = 'in_transit',
  AT_SORTING_CENTER = 'at_sorting_center',
  BEING_PROCESSED = 'being_processed',
  RECYCLED = 'recycled',
  DISPOSED = 'disposed',
  CANCELLED = 'cancelled'
}

export interface IEWasteItem extends Document {
  _id: string;
  trackingId: string;
  qrCode: string;
  submittedBy: string; // User ID
  assignedDriver?: string; // Driver ID
  assignedNGO?: string; // NGO ID
  deviceType: DeviceType;
  brand: string;
  model: string;
  serialNumber?: string;
  condition: ItemCondition;
  estimatedWeight: number; // in kg
  actualWeight?: number; // in kg (measured during pickup)
  photos: string[];
  description?: string;
  status: ItemStatus;
  location: {
    pickup: {
      address: string;
      coordinates: {
        latitude: number;
        longitude: number;
      };
    };
    current?: {
      address: string;
      coordinates: {
        latitude: number;
        longitude: number;
      };
      updatedAt: Date;
    };
  };
  timeline: {
    status: ItemStatus;
    timestamp: Date;
    updatedBy: string; // User ID
    location?: {
      address: string;
      coordinates: {
        latitude: number;
        longitude: number;
      };
    };
    notes?: string;
  }[];
  estimatedCredits: number;
  actualCredits?: number;
  recyclingCenter?: string;
  environmentalImpact: {
    carbonFootprintReduced: number; // in kg CO2
    materialsRecovered: {
      metal: number; // in kg
      plastic: number; // in kg
      glass: number; // in kg
      other: number; // in kg
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

// Pickup Request Types
export enum PickupStatus {
  PENDING = 'pending',
  ASSIGNED = 'assigned',
  SCHEDULED = 'scheduled',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface IPickupRequest extends Document {
  _id: string;
  requestedBy: string; // User ID
  items: string[]; // E-waste item IDs
  assignedDriver?: string; // Driver ID
  assignedNGO?: string; // NGO ID
  status: PickupStatus;
  scheduledDate: Date;
  actualPickupDate?: Date;
  location: {
    address: string;
    coordinates: {
      latitude: number;
      longitude: number;
    };
  };
  notes?: string;
  estimatedDuration: number; // in minutes
  actualDuration?: number; // in minutes
  createdAt: Date;
  updatedAt: Date;
}

// Notification Types
export enum NotificationType {
  ITEM_STATUS_UPDATE = 'item_status_update',
  PICKUP_SCHEDULED = 'pickup_scheduled',
  PICKUP_COMPLETED = 'pickup_completed',
  CREDITS_EARNED = 'credits_earned',
  SYSTEM_ALERT = 'system_alert',
  VERIFICATION_REQUIRED = 'verification_required'
}

export interface INotification extends Document {
  _id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: any;
  isRead: boolean;
  createdAt: Date;
}

// Analytics Types
export interface IAnalytics extends Document {
  _id: string;
  date: Date;
  metrics: {
    totalUsers: number;
    activeUsers: number;
    newRegistrations: number;
    totalItems: number;
    itemsProcessed: number;
    totalCreditsAwarded: number;
    carbonFootprintReduced: number;
    byUserRole: {
      individual: number;
      ngo: number;
      driver: number;
    };
    byDeviceType: {
      [key in DeviceType]: number;
    };
    byStatus: {
      [key in ItemStatus]: number;
    };
    byLocation: {
      city: string;
      count: number;
    }[];
  };
  createdAt: Date;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// JWT Payload
export interface JWTPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat: number;
  exp: number;
}

// Request Extensions
export interface AuthenticatedRequest extends Request {
  user?: IUser;
}

// File Upload Types
export interface FileUpload {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

// QR Code Data
export interface QRCodeData {
  type: 'e-waste-item';
  itemId: string;
  trackingId: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  status: ItemStatus;
  submittedAt: Date;
  estimatedCredits: number;
  verificationHash: string;
}

// Geolocation
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  coordinates?: Coordinates;
}

// Search and Filter Types
export interface SearchFilters {
  status?: ItemStatus[];
  deviceType?: DeviceType[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  location?: {
    city?: string;
    state?: string;
    radius?: number; // in km
    coordinates?: Coordinates;
  };
  user?: string;
  ngo?: string;
  driver?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Dashboard Statistics
export interface DashboardStats {
  totalItems: number;
  itemsInProgress: number;
  itemsCompleted: number;
  totalCredits: number;
  carbonFootprintReduced: number;
  recentActivity: {
    type: string;
    message: string;
    timestamp: Date;
  }[];
  monthlyTrends: {
    month: string;
    items: number;
    credits: number;
  }[];
}