// @title           IgniticAI API
// @version         1.0
// @description     API documentation for IgniticAI backend
// @host            localhost:8080
// @BasePath        /

package main

import (
	"backend/api"
	"backend/api/agents"
	"backend/api/asset"
	"backend/api/auth"
	"backend/api/credential"
	"backend/api/logs"
	"backend/api/organization"
	"backend/database"
	"backend/services"
	"log"
	"time"

	"gorm.io/gorm"

	"github.com/gin-gonic/gin"

	// Swagger imports
	_ "backend/docs"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	// Load configuration
	cfg, err := Load()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	// Convert config to database config
	dbConfig := database.DatabaseConfig{
		Host:     cfg.Database.Host,
		Port:     cfg.Database.Port,
		User:     cfg.Database.User,
		Password: cfg.Database.Password,
		Database: cfg.Database.Database,
		SSLMode:  cfg.Database.SSLMode,
	}

	// Initialize database
	db, err := database.Initialize(dbConfig)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	// Initialize database logger
	databaseLogger := services.NewDatabaseLogger(db)

	// Start log cleanup scheduler
	databaseLogger.StartCleanupScheduler()

	// Set Gin mode based on environment
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize Gin router
	router := gin.Default()

	// Swagger docs endpoint
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	// Setup middleware
	setupMiddleware(router, cfg, databaseLogger)

	// Initialize Cloudinary service
	cloudinaryService, err := services.NewCloudinaryService(
		cfg.Cloudinary.CloudName,
		cfg.Cloudinary.APIKey,
		cfg.Cloudinary.APISecret,
	)
	if err != nil {
		log.Fatal("Failed to initialize Cloudinary:", err)
	}

	// Setup API routes
	setupRoutes(router, db, cloudinaryService, cfg)

	// Start server
	addr := ":" + cfg.Server.Port
	log.Printf("Starting Backend Server on port %s", cfg.Server.Port)
	if err := router.Run(addr); err != nil {
		log.Fatal("Server failed to start:", err)
	}

	// Start background cleanup for unverified users
	go startUnverifiedUserCleanup(db.DB)
}

func setupMiddleware(router *gin.Engine, cfg *Config, logger *services.DatabaseLogger) {
	// Request ID middleware
	router.Use(RequestIDMiddleware())

	// Database logging middleware
	router.Use(logger.GinMiddleware())

	// CORS middleware
	router.Use(CORS())

	// Rate limiting middleware
	router.Use(RateLimiter(cfg.Security.RateLimitRPS))

	// Security headers middleware
	router.Use(SecurityHeaders())

	// Compliance logging middleware
	router.Use(ComplianceLogging())

	// Authentication middleware for protected routes
	router.Use(Auth(cfg.Security.JWTSecret))

	// Built-in middleware
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
}

func setupRoutes(router *gin.Engine, db *database.DB, cloudinaryService *services.CloudinaryService, cfg *Config) {
	// Setup health routes
	api.SetupHealthRoutes(router.Group(""))

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Setup module routes
		auth.SetupRoutes(v1, db, cfg.Security.JWTSecret)
		organization.SetupRoutes(v1, db)
		credential.SetupRoutes(v1, db)
		logs.SetupRoutes(v1, db)
		asset.SetupRoutes(v1, db, cloudinaryService)
		agents.SetupRoutes(v1, db)
	}
}

func startUnverifiedUserCleanup(gormDB *gorm.DB) {
	for {
		deleteBefore := time.Now().Add(-1 * time.Minute)
		result := gormDB.Exec("DELETE FROM users WHERE email_verified = false AND created_at < ?", deleteBefore)
		if result.Error != nil {
			log.Printf("[CLEANUP] Failed to delete unverified users: %v", result.Error)
		} else if result.RowsAffected > 0 {
			log.Printf("[CLEANUP] Deleted %d unverified users older than 1 minute", result.RowsAffected)
		}
		time.Sleep(1 * time.Minute)
	}
}
