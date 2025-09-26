# Backend - eCommerce Automation Platform

A robust Go backend service built with Gin framework for managing comprehensive eCommerce automation workflows including marketing, customer support, advertisement management, social media, SEO, store operations, and analytics.

## 🛠️ Technology Stack

- **Language**: Go 1.21+
- **Framework**: Gin (HTTP web framework)
- **Database**: PostgreSQL with GORM ORM
- **Migrations**: Goose
- **Authentication**: JWT with bcrypt password hashing
- **Security**: JWT auth, rate limiting, security headers

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
- CORS protection
- JWT authentication middleware
- Security headers (XSS, CSRF protection)
- Rate limiting
- Request ID propagation
- Database logging middleware (see Logging section)

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

### **Secrets API** (\`/api/v1/secrets/\`)
```
GET    /:app/values        - List all secrets for an app WITH decrypted values
PUT    /:app               - Bulk upsert secrets for an app
DELETE /:app               - Bulk delete all secrets for an app
```

### **Agents API** (\`/api/v1/agents/\`)
```
GET    /status             - Agent system status
GET    /queues             - Queue sizes/info
POST   /chat               - Queue a chat request
GET    /chat/:request_id   - Fetch a chat request by id
WS     /ws                 - WebSocket for streaming
```

### **Logs API** (\`/api/v1/logs/\`)
```
GET    /logs                       - List recent logs (filters: section, level, user_id, organization_id)
GET    /logs/sections              - List distinct sections
GET    /logs/sections/:section     - List logs for a section (filter: level)
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
- **Database Logging**: Section-based structured logs with auth outcomes

## ▶️ Running Locally

Start backend:
```
go run *.go
```

Optional: start RabbitMQ for agents:
```
./start-rabbitmq.sh
```

## 🗄️ Data Management

### **Database**
- **Primary DB**: PostgreSQL with GORM ORM
- **Migrations**: Goose-based schema versioning
- **Models**: Structured data entities with relationships
- **Soft Deletes**: Logical deletion support

### **Logging Model (Section-based)**
- Table: `logs`
- Columns of interest:
  - `timestamp`, `level`
  - `section` (AUTH | ASSETS | SECRETS | AGENTS | ORGANIZATIONS | USERS | API | SYSTEM)
  - `auth_result` (SUCCESS | UNAUTHORIZED | FORBIDDEN | null)
  - `message`, `user_id`, `organization_id`, `endpoint`, `method`, `status_code`, `response_time_ms`, `metadata`
- Middleware records API requests except `/auth/*` to avoid duplicates.
- Auth service logs success/failure with `auth_result`.

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
