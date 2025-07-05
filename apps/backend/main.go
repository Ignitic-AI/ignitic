package main

import (
	"backend/api/auth"
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

	// Initialize database
	db, err := database.Initialize(cfg.Database)
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
	setupRoutes(router, db)

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

func setupRoutes(router *gin.Engine, db *database.DB) {
	// Health check endpoint
	router.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "healthy",
			"service": "backend",
			"version": "1.0.0",
		})
	})

	// API v1 routes
	v1 := router.Group("/api/v1")
	{
		// Setup module routes
		auth.SetupRoutes(v1, db)
	}
}
