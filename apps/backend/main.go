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

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/gorm"

	// Swagger imports
	_ "backend/docs"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	// Load environment variables from .env file
	err := godotenv.Load()
	if err != nil {
		log.Println("Warning: .env file not found, using environment variables from OS")
	}

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
	router := gin.New()

	// Apply non-auth middleware globally
	setupGlobalMiddleware(router, cfg, databaseLogger)
	// Initialize Cloudinary service
	cloudinaryService, err := services.NewCloudinaryService(cfg.Cloudinary.CloudName, cfg.Cloudinary.APIKey, cfg.Cloudinary.APISecret)
	if err != nil {
		log.Fatal("Failed to initialize Cloudinary service:", err)
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

// NEW FUNCTION for middleware that applies to ALL routes
func setupGlobalMiddleware(router *gin.Engine, cfg *Config, logger *services.DatabaseLogger) {
	router.Use(RequestIDMiddleware())
	router.Use(logger.GinMiddleware())
	router.Use(CORS())
	router.Use(RateLimiter(cfg.Security.RateLimitRPS))
	router.Use(SecurityHeaders())
	router.Use(ComplianceLogging())
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
}

// MODIFIED setupRoutes to handle WebSocket and REST API separately
func setupRoutes(router *gin.Engine, db *database.DB, cloudinaryService *services.CloudinaryService, cfg *Config) {
	// Swagger docs and Health routes are public
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	api.SetupHealthRoutes(router.Group(""))

	// --- WebSocket Route ---
	// This group does NOT have the Auth middleware.
	// The handleWebSocket function performs its own token validation from the URL.
	wsGroup := router.Group("/api/v1")
	{
		agents.SetupWSRoutes(wsGroup, db)
	}

	// --- Authenticated REST API Routes ---
	// This group DOES have the Auth middleware.
	v1 := router.Group("/api/v1")
	v1.Use(Auth(cfg.Security.JWTSecret))
	{
		auth.SetupRoutes(v1, db, cfg.Security.JWTSecret)
		organization.SetupRoutes(v1, db)
		credential.SetupRoutes(v1, db)
		logs.SetupRoutes(v1, db)
		asset.SetupRoutes(v1, db, cloudinaryService)
		agents.SetupRoutes(v1, db)
	}
}

// startUnverifiedUserCleanup remains the same
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
