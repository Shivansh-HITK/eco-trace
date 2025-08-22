import mongoose, { Schema } from 'mongoose';
import { INotification, NotificationType } from '@types/index';

const NotificationSchema = new Schema<INotification>({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: Object.values(NotificationType),
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 500
  },
  data: {
    type: Schema.Types.Mixed,
    default: {}
  },
  isRead: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Indexes for better query performance
NotificationSchema.index({ userId: 1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ isRead: 1 });
NotificationSchema.index({ createdAt: -1 });
NotificationSchema.index({ userId: 1, isRead: 1 });
NotificationSchema.index({ userId: 1, createdAt: -1 });

// Method to mark as read
NotificationSchema.methods.markAsRead = function() {
  this.isRead = true;
  return this.save();
};

// Static method to mark multiple notifications as read
NotificationSchema.statics.markAllAsRead = function(userId: string) {
  return this.updateMany(
    { userId, isRead: false },
    { isRead: true }
  );
};

// Static method to get unread count
NotificationSchema.statics.getUnreadCount = function(userId: string) {
  return this.countDocuments({ userId, isRead: false });
};

// Static method to get user's notifications with pagination
NotificationSchema.statics.getUserNotifications = function(
  userId: string,
  page: number = 1,
  limit: number = 20,
  type?: NotificationType
) {
  const query: any = { userId };
  if (type) query.type = type;
  
  return this.find(query)
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

// Static method to create and send notification
NotificationSchema.statics.createNotification = async function(
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: any
) {
  const notification = new this({
    userId,
    type,
    title,
    message,
    data
  });
  
  await notification.save();
  
  // Here you could integrate with push notification services
  // like Firebase Cloud Messaging, OneSignal, etc.
  
  return notification;
};

// Static method to clean old notifications (older than 30 days)
NotificationSchema.statics.cleanOldNotifications = function() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  return this.deleteMany({
    createdAt: { $lt: thirtyDaysAgo },
    isRead: true
  });
};

// Virtual for age in hours
NotificationSchema.virtual('ageInHours').get(function(this: INotification) {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60));
});

// Ensure virtual fields are serialized
NotificationSchema.set('toJSON', { virtuals: true });
NotificationSchema.set('toObject', { virtuals: true });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);