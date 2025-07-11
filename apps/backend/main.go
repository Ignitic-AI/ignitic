package main

import (
	"backend/api"
	"backend/api/auth"
	"backend/api/organization"
	"backend/database"
	"log"

	"github.com/gin-gonic/gin"
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

	// Set Gin mode based on environment
	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize Gin router
	router := gin.Default()

	// Setup middleware
	setupMiddleware(router, cfg)

	// Setup API routes
	setupRoutes(router, db, cfg)

	// Start server
	addr := ":" + cfg.Server.Port
	log.Printf("Starting Backend Server on port %s", cfg.Server.Port)
	if err := router.Run(addr); err != nil {
		log.Fatal("Server failed to start:", err)
	}
}

func setupMiddleware(router *gin.Engine, cfg *Config) {
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

func setupRoutes(router *gin.Engine, db *database.DB, cfg *Config) {
	// Setup health routes
	api.SetupHealthRoutes(router.Group(""))

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Setup module routes
		auth.SetupRoutes(v1, db, cfg.Security.JWTSecret)
		organization.SetupRoutes(v1, db)
	}
}
