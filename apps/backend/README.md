# Backend - eCommerce Automation Platform

A robust Go backend service built with Gin framework for managing comprehensive eCommerce automation workflows including marketing, customer support, advertisement management, social media, SEO, store operations, and analytics.

## 🛠️ Technology Stack

- **Language**: Go 1.21+
- **Framework**: Gin (HTTP web framework)
- **Database**: PostgreSQL with GORM ORM
- **Migrations**: Goose
- **Authentication**: JWT with bcrypt password hashing
- **Security**: SOC2 Type 2 and GDPR compliance features

## 📁 Project Architecture

```
backend/
├── main.go                 # Application entry point
├── config.go              # Configuration management  
├── middleware.go          # Security & auth middleware
├── api/                   # API modules and routes
│   ├── routes.go          # Health check endpoints
│   └── auth/              # Authentication module
├── database/              # Database layer with migrations
├── models/                # Data models (User, etc.)
├── utils/                 # Utility functions
└── services/             # Business logic services
```

## 🎯 Core Modules

### **Authentication Module** (\`api/auth/\`)
Complete user authentication and authorization system
- User registration and login
- JWT token management
- Password reset and email verification
- Profile management
- Role-based access control

### **Database Layer** (\`database/\`)
PostgreSQL integration with automated migrations
- GORM ORM for database operations
- Goose migration system
- Connection pooling and management
- Version tracking in \`goose_db_version\` table

### **Models** (\`models/\`)
Data structure definitions
- **User Model**: Complete user entity with authentication fields
- GORM struct tags for database mapping
- Soft delete support
- Automatic timestamps

### **Security & Middleware** (\`middleware.go\`)
Comprehensive security implementation
- CORS protection
- JWT authentication middleware
- Security headers (XSS, CSRF protection)
- Rate limiting
- Compliance logging for SOC2/GDPR

## 🌐 API Overview

### **Health Check**
```
GET /health - Application health status
```

### **Authentication API** (\`/api/v1/auth/\`)
```
POST   /login              - User authentication
POST   /register           - User registration  
POST   /refresh            - JWT token refresh
POST   /logout             - User logout
GET    /profile            - Get user profile
PUT    /profile            - Update user profile
POST   /change-password    - Change user password
POST   /forgot-password    - Request password reset
POST   /reset-password     - Reset password with token
POST   /verify-email       - Email verification
```

## 🔧 Services Architecture

### **Current Services**
- **AuthService**: Handles all authentication operations
  - User login/registration logic
  - JWT token generation and validation
  - Password hashing with bcrypt
  - Profile management operations

### **Planned Service Modules**
- **WorkflowService**: Automation workflow management
- **MarketingService**: Campaign and email sequence management  
- **SupportService**: Customer support and ticketing system
- **AdsService**: Advertisement campaign optimization
- **SocialService**: Social media management and scheduling
- **SEOService**: Website analysis and optimization
- **StoreService**: Product and inventory management
- **AnalyticsService**: Business intelligence and reporting

## 🛡️ Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Security**: bcrypt hashing with salt
- **CORS Protection**: Configurable cross-origin policies
- **Security Headers**: XSS, CSRF, and content-type protection
- **Rate Limiting**: Request rate limiting middleware
- **SQL Injection Prevention**: GORM parameterized queries
- **Compliance Logging**: SOC2/GDPR audit trail

## 🗄️ Data Management

### **Database**
- **Primary DB**: PostgreSQL with GORM ORM
- **Migrations**: Goose-based schema versioning
- **Models**: Structured data entities with relationships
- **Soft Deletes**: Logical deletion support

### **User Management**
Complete user lifecycle management with fields for:
- Authentication (email, password, tokens)
- Profile (name, phone, company, role)
- Security (verification, reset tokens, activity tracking)
- Audit (created/updated/deleted timestamps)

## �� Development Status

### **✅ Implemented**
- Project structure and configuration
- Database connection and migrations
- User authentication system
- JWT token management
- Security middleware
- Health monitoring

### **🚧 In Development**
- Additional API modules (workflows, marketing, support, etc.)
- Business logic services
- Advanced security features
- Comprehensive testing

---

**Built with Go + Gin Framework for scalable eCommerce automation**
