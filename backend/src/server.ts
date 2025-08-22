import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import dotenv from 'dotenv';
import path from 'path';
import Database from '@config/database';
import { ApiResponse } from '@types/index';

// Import routes
import authRoutes from '@routes/auth';
import itemsRoutes from '@routes/items';

// Load environment variables
dotenv.config();

class Server {
  public app: Application;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '5000');
    
    this.initializeDatabase();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    const database = Database.getInstance();
    await database.connect();
    await database.createIndexes();
    await database.seedInitialData();
  }

  private initializeMiddleware(): void {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", "data:", "https:"],
        },
      },
      crossOriginEmbedderPolicy: false,
    }));

    // CORS configuration
    const corsOptions = {
      origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    };
    this.app.use(cors(corsOptions));

    // Compression middleware
    this.app.use(compression());

    // Body parsing middleware
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    // Rate limiting would go here in production
    // this.app.use(rateLimitMiddleware);
  }

  private initializeRoutes(): void {
    // Health check endpoint
    this.app.get('/health', async (req: Request, res: Response) => {
      const database = Database.getInstance();
      const dbHealthy = await database.healthCheck();
      
      const response: ApiResponse = {
        success: true,
        message: 'Server is running',
        data: {
          status: 'OK',
          timestamp: new Date().toISOString(),
          database: dbHealthy ? 'connected' : 'disconnected',
          version: process.env.npm_package_version || '1.0.0'
        }
      };
      
      res.status(dbHealthy ? 200 : 503).json(response);
    });

    // API routes
    this.app.use('/api/auth', authRoutes);
    this.app.use('/api/items', itemsRoutes);

    // Serve static files (for QR codes, etc.)
    this.app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

    // Public tracking route (accessible without authentication)
    this.app.get('/track/:trackingId', async (req: Request, res: Response) => {
      try {
        const { trackingId } = req.params;
        const { EWasteItem } = await import('@models/EWasteItem');
        
        const item = await EWasteItem.findOne({ trackingId }).lean();
        
        if (!item) {
          return res.status(404).json({
            success: false,
            message: 'Item not found',
            error: 'ITEM_NOT_FOUND'
          });
        }

        // Return public tracking information
        const trackingInfo = {
          trackingId: item.trackingId,
          deviceType: item.deviceType,
          brand: item.brand,
          model: item.model,
          status: item.status,
          estimatedCredits: item.estimatedCredits,
          timeline: item.timeline.map((entry: any) => ({
            status: entry.status,
            timestamp: entry.timestamp,
            notes: entry.notes
          })),
          environmentalImpact: item.environmentalImpact,
          submittedAt: item.createdAt
        };

        res.json({
          success: true,
          message: 'Item tracking information retrieved',
          data: { item: trackingInfo }
        });
      } catch (error) {
        console.error('Public tracking error:', error);
        res.status(500).json({
          success: false,
          message: 'Error retrieving tracking information',
          error: 'TRACKING_FAILED'
        });
      }
    });

    // 404 handler for undefined routes
    this.app.use('*', (req: Request, res: Response) => {
      const response: ApiResponse = {
        success: false,
        message: `Route ${req.method} ${req.originalUrl} not found`,
        error: 'ROUTE_NOT_FOUND'
      };
      res.status(404).json(response);
    });
  }

  private initializeErrorHandling(): void {
    // Global error handler
    this.app.use((error: any, req: Request, res: Response, next: NextFunction) => {
      console.error('Global error handler:', error);

      // Handle specific error types
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          error: 'VALIDATION_ERROR',
          data: { details: error.message }
        });
      }

      if (error.name === 'CastError') {
        return res.status(400).json({
          success: false,
          message: 'Invalid ID format',
          error: 'INVALID_ID'
        });
      }

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Duplicate entry',
          error: 'DUPLICATE_ENTRY'
        });
      }

      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
          error: 'INVALID_TOKEN'
        });
      }

      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          error: 'TOKEN_EXPIRED'
        });
      }

      // Default error response
      const response: ApiResponse = {
        success: false,
        message: process.env.NODE_ENV === 'production' 
          ? 'Internal server error' 
          : error.message,
        error: 'INTERNAL_SERVER_ERROR'
      };

      res.status(error.statusCode || 500).json(response);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      // Close server gracefully
      this.gracefulShutdown();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error);
      // Close server gracefully
      this.gracefulShutdown();
    });

    // Handle SIGTERM signal
    process.on('SIGTERM', () => {
      console.log('SIGTERM received, shutting down gracefully');
      this.gracefulShutdown();
    });

    // Handle SIGINT signal (Ctrl+C)
    process.on('SIGINT', () => {
      console.log('SIGINT received, shutting down gracefully');
      this.gracefulShutdown();
    });
  }

  private async gracefulShutdown(): Promise<void> {
    console.log('Starting graceful shutdown...');
    
    // Close database connection
    const database = Database.getInstance();
    await database.disconnect();
    
    console.log('Graceful shutdown completed');
    process.exit(0);
  }

  public start(): void {
    this.app.listen(this.port, () => {
      console.log(`
🚀 E-Waste Management Server is running!
📍 Port: ${this.port}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
📊 Database: ${Database.getInstance().getConnectionStatus()}
🕐 Started at: ${new Date().toISOString()}

Available endpoints:
📋 Health Check: GET /health
🔐 Authentication: /api/auth/*
📦 Items Management: /api/items/*
🔍 Public Tracking: /track/:trackingId

Documentation: Check README.md for API documentation
      `);
    });
  }
}

// Create and start server
const server = new Server();
server.start();

export default server;