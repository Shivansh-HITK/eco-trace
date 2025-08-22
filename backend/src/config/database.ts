import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ewaste_management';

class Database {
  private static instance: Database;
  
  private constructor() {}
  
  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }
  
  public async connect(): Promise<void> {
    try {
      // Configure mongoose options
      const options = {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10, // Maximum number of connections in the connection pool
        serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
        socketTimeoutMS: 45000, // Close connections after 45 seconds of inactivity
        family: 4, // Use IPv4, skip trying IPv6
        retryWrites: true,
        w: 'majority'
      };
      
      // Connect to MongoDB
      await mongoose.connect(MONGODB_URI, options);
      
      console.log('✅ Connected to MongoDB successfully');
      
      // Handle connection events
      mongoose.connection.on('error', (error) => {
        console.error('❌ MongoDB connection error:', error);
      });
      
      mongoose.connection.on('disconnected', () => {
        console.warn('⚠️ MongoDB disconnected');
      });
      
      mongoose.connection.on('reconnected', () => {
        console.log('🔄 MongoDB reconnected');
      });
      
      // Handle process termination
      process.on('SIGINT', async () => {
        await this.disconnect();
        process.exit(0);
      });
      
    } catch (error) {
      console.error('❌ Failed to connect to MongoDB:', error);
      process.exit(1);
    }
  }
  
  public async disconnect(): Promise<void> {
    try {
      await mongoose.connection.close();
      console.log('🔌 MongoDB connection closed');
    } catch (error) {
      console.error('❌ Error closing MongoDB connection:', error);
    }
  }
  
  public getConnectionStatus(): string {
    const states = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };
    
    return states[mongoose.connection.readyState as keyof typeof states] || 'unknown';
  }
  
  public async healthCheck(): Promise<boolean> {
    try {
      await mongoose.connection.db.admin().ping();
      return true;
    } catch (error) {
      console.error('❌ Database health check failed:', error);
      return false;
    }
  }
  
  public async createIndexes(): Promise<void> {
    try {
      // Import models to ensure indexes are created
      await import('../models/User');
      await import('../models/EWasteItem');
      await import('../models/PickupRequest');
      await import('../models/Notification');
      await import('../models/Analytics');
      
      console.log('📊 Database indexes created successfully');
    } catch (error) {
      console.error('❌ Error creating database indexes:', error);
    }
  }
  
  public async seedInitialData(): Promise<void> {
    try {
      const { User } = await import('../models/User');
      const { UserRole, UserStatus } = await import('../types/index');
      
      // Check if admin user exists
      const adminExists = await User.findOne({ 
        email: process.env.ADMIN_EMAIL || 'admin@ewaste.com',
        role: UserRole.ADMIN 
      });
      
      if (!adminExists) {
        // Create default admin user
        const adminUser = new User({
          email: process.env.ADMIN_EMAIL || 'admin@ewaste.com',
          password: process.env.ADMIN_PASSWORD || 'Admin@123',
          role: UserRole.ADMIN,
          status: UserStatus.ACTIVE,
          profile: {
            firstName: 'System',
            lastName: 'Administrator',
            phone: '+1234567890',
            address: {
              street: '123 Admin Street',
              city: 'Admin City',
              state: 'Admin State',
              zipCode: '12345',
              country: 'India'
            }
          },
          isEmailVerified: true,
          isPhoneVerified: true
        });
        
        await adminUser.save();
        console.log('👤 Default admin user created');
      }
      
      console.log('🌱 Initial data seeding completed');
    } catch (error) {
      console.error('❌ Error seeding initial data:', error);
    }
  }
}

export default Database;