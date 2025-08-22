# E-Waste Management Backend API

A comprehensive backend system for managing electronic waste collection, tracking, and disposal through QR code-based identification and real-time tracking.

## 🌟 Features

- **Role-based Authentication**: Support for Individual Users, NGOs, Drivers, and Admins
- **E-Waste Item Management**: Complete CRUD operations with real-time tracking
- **QR Code System**: Generate, scan, and verify QR codes for item tracking
- **Real-time Notifications**: Status updates and system alerts
- **Analytics Dashboard**: Comprehensive statistics and reporting
- **Environmental Impact Tracking**: Carbon footprint and material recovery metrics
- **Geolocation Support**: Location-based services and tracking
- **Security**: JWT-based authentication with refresh tokens
- **Data Validation**: Comprehensive input validation with Joi

## 🚀 Quick Start

### Prerequisites

- Node.js (v16 or higher)
- MongoDB (v4.4 or higher)
- npm or yarn package manager

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

5. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## 📋 Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/ewaste_management

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
JWT_REFRESH_SECRET=your-refresh-secret-key-here
JWT_REFRESH_EXPIRES_IN=30d

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Email Configuration (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# SMS Configuration (Optional)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# File Upload Configuration (Optional)
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# CORS Configuration
CORS_ORIGIN=http://localhost:3000

# Admin Configuration
ADMIN_EMAIL=admin@ewaste.com
ADMIN_PASSWORD=Admin@123

# QR Code Configuration
QR_CODE_BASE_URL=https://your-domain.com/track
```

## 📚 API Documentation

### Base URL
```
http://localhost:5000/api
```

### Authentication Endpoints

#### Register User
```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password@123",
  "confirmPassword": "Password@123",
  "role": "individual", // individual | ngo | driver
  "profile": {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "address": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001",
      "country": "USA",
      "coordinates": {
        "latitude": 40.7128,
        "longitude": -74.0060
      }
    },
    "organizationName": "Green NGO", // Required for NGOs
    "licenseNumber": "DL123456", // Required for drivers
    "avatar": "https://example.com/avatar.jpg"
  }
}
```

#### Login
```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "Password@123"
}
```

#### Refresh Token
```http
POST /api/auth/refresh-token
```

**Request Body:**
```json
{
  "refreshToken": "your-refresh-token"
}
```

### E-Waste Item Endpoints

#### Create Item
```http
POST /api/items
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "deviceType": "smartphone",
  "brand": "Apple",
  "model": "iPhone 13",
  "serialNumber": "ABC123456",
  "condition": "working",
  "estimatedWeight": 0.2,
  "photos": ["https://example.com/photo1.jpg"],
  "description": "Fully functional iPhone",
  "location": {
    "address": "123 Main St, New York, NY",
    "coordinates": {
      "latitude": 40.7128,
      "longitude": -74.0060
    }
  }
}
```

#### Get User's Items
```http
GET /api/items/my-items?page=1&limit=10&status=registered&deviceType=smartphone
Authorization: Bearer <access-token>
```

#### Get Item by ID
```http
GET /api/items/:id
Authorization: Bearer <access-token>
```

#### Update Item Status
```http
PUT /api/items/:id/status
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "status": "picked_up",
  "location": {
    "address": "NGO Warehouse, New York, NY",
    "coordinates": {
      "latitude": 40.7589,
      "longitude": -73.9851
    }
  },
  "notes": "Item collected successfully",
  "actualWeight": 0.18
}
```

#### Generate QR Code
```http
GET /api/items/:id/qr-code?format=dataURL&width=256
Authorization: Bearer <access-token>
```

#### Scan QR Code
```http
POST /api/items/scan-qr
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "qrData": "{\"type\":\"e-waste-item\",\"itemId\":\"...\",\"trackingId\":\"ET123456789\",...}"
}
```

#### Track Item (Public)
```http
GET /track/:trackingId
```

### User Profile Endpoints

#### Get Profile
```http
GET /api/auth/profile
Authorization: Bearer <access-token>
```

#### Update Profile
```http
PUT /api/auth/profile
Authorization: Bearer <access-token>
```

#### Change Password
```http
PUT /api/auth/change-password
Authorization: Bearer <access-token>
```

### Verification Endpoints

#### Send Email Verification
```http
POST /api/auth/send-email-verification
Authorization: Bearer <access-token>
```

#### Verify Email
```http
POST /api/auth/verify-email
Authorization: Bearer <access-token>
```

**Request Body:**
```json
{
  "otp": "123456",
  "otpToken": "verification-token"
}
```

## 🔒 Authentication & Authorization

### User Roles

1. **Individual**: Regular users who submit e-waste items
2. **NGO**: Organizations that collect e-waste from users
3. **Driver**: Personnel who transport e-waste to processing centers
4. **Admin**: System administrators with full access

### JWT Token Structure

**Access Token Payload:**
```json
{
  "userId": "user-id",
  "email": "user@example.com",
  "role": "individual",
  "iat": 1234567890,
  "exp": 1234567890
}
```

### Protected Routes

All routes under `/api/` require authentication except:
- `/api/auth/register`
- `/api/auth/login`
- `/api/auth/refresh-token`
- `/track/:trackingId` (public tracking)

## 📊 Data Models

### User Model
```typescript
{
  email: string;
  password: string; // hashed
  role: 'individual' | 'ngo' | 'driver' | 'admin';
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  profile: {
    firstName: string;
    lastName: string;
    phone: string;
    address: Address;
    avatar?: string;
    organizationName?: string; // NGOs only
    licenseNumber?: string; // Drivers only
  };
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  statistics: {
    totalItemsSubmitted: number;
    totalCreditsEarned: number;
    totalCarbonFootprintReduced: number;
  };
}
```

### E-Waste Item Model
```typescript
{
  trackingId: string; // Auto-generated
  qrCode: string; // Base64 QR code
  submittedBy: ObjectId; // User ID
  assignedDriver?: ObjectId;
  assignedNGO?: ObjectId;
  deviceType: DeviceType;
  brand: string;
  model: string;
  condition: ItemCondition;
  estimatedWeight: number;
  actualWeight?: number;
  status: ItemStatus;
  location: {
    pickup: Location;
    current?: Location;
  };
  timeline: TimelineEntry[];
  estimatedCredits: number;
  actualCredits?: number;
  environmentalImpact: {
    carbonFootprintReduced: number;
    materialsRecovered: MaterialsRecovered;
  };
}
```

## 🎯 QR Code System

### QR Code Data Structure
```json
{
  "type": "e-waste-item",
  "itemId": "item-mongodb-id",
  "trackingId": "ET123456789",
  "deviceType": "smartphone",
  "brand": "Apple",
  "model": "iPhone 13",
  "status": "registered",
  "submittedAt": "2024-01-15T10:30:00.000Z",
  "estimatedCredits": 15,
  "verificationHash": "abc123..." // Security hash
}
```

### QR Code Features
- **Security**: Cryptographic verification hash
- **Multiple Formats**: Data URL, SVG, Buffer
- **Customizable**: Size, colors, error correction
- **Tracking URLs**: Public tracking links
- **Batch Generation**: Multiple QR codes at once

## 🚦 Status Flow

### Item Status Progression
```
registered → pickup_scheduled → picked_up → in_transit → 
at_sorting_center → being_processed → recycled/disposed
```

### User Status Flow
```
pending_verification → active (after email/phone verification)
```

## 🔧 Development

### Available Scripts

```bash
# Development with hot reload
npm run dev

# Build TypeScript
npm run build

# Start production server
npm start

# Run tests
npm test

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Project Structure

```
backend/
├── src/
│   ├── config/          # Database and app configuration
│   ├── controllers/     # Route controllers
│   ├── middleware/      # Express middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # Express routes
│   ├── types/           # TypeScript type definitions
│   ├── utils/           # Utility functions
│   └── server.ts        # Main server file
├── dist/                # Compiled JavaScript
├── uploads/             # File uploads
├── .env.example         # Environment variables template
├── package.json
├── tsconfig.json
└── README.md
```

## 🛡️ Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Access and refresh token system
- **Input Validation**: Joi schema validation
- **Rate Limiting**: Protection against abuse
- **CORS**: Configurable cross-origin requests
- **Helmet**: Security headers
- **Data Encryption**: Sensitive data encryption
- **QR Verification**: Cryptographic hash verification

## 🌍 Environment Impact

### Carbon Footprint Calculation
The system calculates environmental impact based on:
- Device type and estimated materials
- Weight-based carbon footprint reduction
- Material recovery tracking (metal, plastic, glass)

### Credits System
Users earn credits based on:
- Device type and condition
- Actual weight vs estimated
- Successful recycling completion

## 📈 Analytics & Monitoring

### Health Check
```http
GET /health
```

Returns server status, database connection, and system metrics.

### Dashboard Statistics
```http
GET /api/items/dashboard-stats
Authorization: Bearer <access-token>
```

Provides user-specific statistics including:
- Total items submitted
- Items in progress/completed
- Credits earned
- Carbon footprint reduced
- Recent activity

## 🚀 Deployment

### Production Checklist

1. **Environment Variables**: Set all production values
2. **Database**: Configure MongoDB production instance
3. **Security**: Enable HTTPS and security headers
4. **Monitoring**: Set up logging and monitoring
5. **Backup**: Configure database backups
6. **Scaling**: Consider load balancing and clustering

### Docker Support

```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 5000
CMD ["npm", "start"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Run linting and tests
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue on GitHub
- Contact the development team
- Check the documentation

## 🔄 Version History

### v1.0.0 (Current)
- Initial release
- Complete authentication system
- E-waste item management
- QR code generation and scanning
- Real-time tracking
- Analytics dashboard
- Role-based access control

---

**Built with ❤️ for a sustainable future** 🌱