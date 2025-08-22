import mongoose, { Schema } from 'mongoose';
import { IAnalytics, DeviceType, ItemStatus } from '@types/index';

const ByUserRoleSchema = new Schema({
  individual: { type: Number, default: 0 },
  ngo: { type: Number, default: 0 },
  driver: { type: Number, default: 0 }
}, { _id: false });

const ByDeviceTypeSchema = new Schema({
  [DeviceType.SMARTPHONE]: { type: Number, default: 0 },
  [DeviceType.LAPTOP]: { type: Number, default: 0 },
  [DeviceType.TABLET]: { type: Number, default: 0 },
  [DeviceType.DESKTOP]: { type: Number, default: 0 },
  [DeviceType.TELEVISION]: { type: Number, default: 0 },
  [DeviceType.REFRIGERATOR]: { type: Number, default: 0 },
  [DeviceType.WASHING_MACHINE]: { type: Number, default: 0 },
  [DeviceType.AIR_CONDITIONER]: { type: Number, default: 0 },
  [DeviceType.MICROWAVE]: { type: Number, default: 0 },
  [DeviceType.PRINTER]: { type: Number, default: 0 },
  [DeviceType.ROUTER]: { type: Number, default: 0 },
  [DeviceType.BATTERY]: { type: Number, default: 0 },
  [DeviceType.CABLES]: { type: Number, default: 0 },
  [DeviceType.OTHER]: { type: Number, default: 0 }
}, { _id: false });

const ByStatusSchema = new Schema({
  [ItemStatus.REGISTERED]: { type: Number, default: 0 },
  [ItemStatus.PICKUP_SCHEDULED]: { type: Number, default: 0 },
  [ItemStatus.PICKED_UP]: { type: Number, default: 0 },
  [ItemStatus.IN_TRANSIT]: { type: Number, default: 0 },
  [ItemStatus.AT_SORTING_CENTER]: { type: Number, default: 0 },
  [ItemStatus.BEING_PROCESSED]: { type: Number, default: 0 },
  [ItemStatus.RECYCLED]: { type: Number, default: 0 },
  [ItemStatus.DISPOSED]: { type: Number, default: 0 },
  [ItemStatus.CANCELLED]: { type: Number, default: 0 }
}, { _id: false });

const ByLocationSchema = new Schema({
  city: { type: String, required: true },
  count: { type: Number, required: true }
}, { _id: false });

const MetricsSchema = new Schema({
  totalUsers: { type: Number, default: 0 },
  activeUsers: { type: Number, default: 0 },
  newRegistrations: { type: Number, default: 0 },
  totalItems: { type: Number, default: 0 },
  itemsProcessed: { type: Number, default: 0 },
  totalCreditsAwarded: { type: Number, default: 0 },
  carbonFootprintReduced: { type: Number, default: 0 },
  byUserRole: { type: ByUserRoleSchema, default: {} },
  byDeviceType: { type: ByDeviceTypeSchema, default: {} },
  byStatus: { type: ByStatusSchema, default: {} },
  byLocation: [{ type: ByLocationSchema }]
}, { _id: false });

const AnalyticsSchema = new Schema<IAnalytics>({
  date: {
    type: Date,
    required: true,
    unique: true,
    validate: {
      validator: function(v: Date) {
        // Ensure date is at midnight (start of day)
        const midnight = new Date(v);
        midnight.setHours(0, 0, 0, 0);
        return v.getTime() === midnight.getTime();
      },
      message: 'Date must be at midnight (start of day)'
    }
  },
  metrics: { type: MetricsSchema, required: true }
}, {
  timestamps: true
});

// Indexes for better query performance
AnalyticsSchema.index({ date: -1 });
AnalyticsSchema.index({ createdAt: -1 });

// Static method to get or create today's analytics
AnalyticsSchema.statics.getTodayAnalytics = async function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let analytics = await this.findOne({ date: today });
  
  if (!analytics) {
    analytics = new this({ date: today, metrics: {} });
    await analytics.save();
  }
  
  return analytics;
};

// Static method to update daily metrics
AnalyticsSchema.statics.updateDailyMetrics = async function() {
  const User = mongoose.model('User');
  const EWasteItem = mongoose.model('EWasteItem');
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  // Calculate metrics
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ 
    lastLogin: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } // Last 30 days
  });
  const newRegistrations = await User.countDocuments({
    createdAt: { $gte: today, $lt: tomorrow }
  });
  
  const totalItems = await EWasteItem.countDocuments();
  const itemsProcessed = await EWasteItem.countDocuments({
    status: { $in: [ItemStatus.RECYCLED, ItemStatus.DISPOSED] }
  });
  
  // Calculate credits and carbon footprint
  const creditsPipeline = await EWasteItem.aggregate([
    { $group: { _id: null, total: { $sum: '$actualCredits' } } }
  ]);
  const totalCreditsAwarded = creditsPipeline[0]?.total || 0;
  
  const carbonPipeline = await EWasteItem.aggregate([
    { $group: { _id: null, total: { $sum: '$environmentalImpact.carbonFootprintReduced' } } }
  ]);
  const carbonFootprintReduced = carbonPipeline[0]?.total || 0;
  
  // Calculate by user role
  const userRolePipeline = await User.aggregate([
    { $group: { _id: '$role', count: { $sum: 1 } } }
  ]);
  const byUserRole = {
    individual: 0,
    ngo: 0,
    driver: 0
  };
  userRolePipeline.forEach(item => {
    if (item._id in byUserRole) {
      byUserRole[item._id as keyof typeof byUserRole] = item.count;
    }
  });
  
  // Calculate by device type
  const deviceTypePipeline = await EWasteItem.aggregate([
    { $group: { _id: '$deviceType', count: { $sum: 1 } } }
  ]);
  const byDeviceType: any = {};
  Object.values(DeviceType).forEach(type => {
    byDeviceType[type] = 0;
  });
  deviceTypePipeline.forEach(item => {
    if (item._id in byDeviceType) {
      byDeviceType[item._id] = item.count;
    }
  });
  
  // Calculate by status
  const statusPipeline = await EWasteItem.aggregate([
    { $group: { _id: '$status', count: { $sum: 1 } } }
  ]);
  const byStatus: any = {};
  Object.values(ItemStatus).forEach(status => {
    byStatus[status] = 0;
  });
  statusPipeline.forEach(item => {
    if (item._id in byStatus) {
      byStatus[item._id] = item.count;
    }
  });
  
  // Calculate by location
  const locationPipeline = await EWasteItem.aggregate([
    { $group: { _id: '$location.pickup.address', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 20 }
  ]);
  const byLocation = locationPipeline.map(item => ({
    city: item._id,
    count: item.count
  }));
  
  const metrics = {
    totalUsers,
    activeUsers,
    newRegistrations,
    totalItems,
    itemsProcessed,
    totalCreditsAwarded,
    carbonFootprintReduced,
    byUserRole,
    byDeviceType,
    byStatus,
    byLocation
  };
  
  return await this.findOneAndUpdate(
    { date: today },
    { metrics },
    { upsert: true, new: true }
  );
};

// Static method to get analytics for date range
AnalyticsSchema.statics.getAnalyticsRange = function(
  startDate: Date,
  endDate: Date
) {
  return this.find({
    date: { $gte: startDate, $lte: endDate }
  }).sort({ date: -1 });
};

// Static method to get monthly analytics
AnalyticsSchema.statics.getMonthlyAnalytics = function(year: number, month: number) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  return this.getAnalyticsRange(startDate, endDate);
};

// Method to calculate growth rate compared to previous day
AnalyticsSchema.methods.calculateGrowthRate = async function(field: string) {
  const previousDay = new Date(this.date);
  previousDay.setDate(previousDay.getDate() - 1);
  
  const previousAnalytics = await this.constructor.findOne({ date: previousDay });
  
  if (!previousAnalytics) return 0;
  
  const currentValue = this.metrics[field] || 0;
  const previousValue = previousAnalytics.metrics[field] || 0;
  
  if (previousValue === 0) return currentValue > 0 ? 100 : 0;
  
  return ((currentValue - previousValue) / previousValue) * 100;
};

export const Analytics = mongoose.model<IAnalytics>('Analytics', AnalyticsSchema);