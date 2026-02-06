// @title           IgniticAI API
// @version         1.0
// @description     API documentation for IgniticAI backend
// @host            localhost:8080
// @BasePath        /

package main

import (
	"backend/api"
	"backend/api/agents"
	"backend/api/analytics"
	"backend/api/asset"
	"backend/api/auth"
	"backend/api/credential"
	"backend/api/logs"
	"backend/api/organization"
	"backend/api/todo"
	"backend/api/workflow"
	"backend/database"
	"backend/services"
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/gorm"

	_ "backend/docs"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

func main() {
	// Load .env
	if err := godotenv.Load(); err != nil {
		log.Println("Warning: .env file not found, using OS environment variables.")
	}

	// Load config
	cfg, err := Load()
	if err != nil {
		log.Fatal("Failed to load configuration:", err)
	}

	// Setup DB
	dbConfig := database.DatabaseConfig{
		Host:     cfg.Database.Host,
		Port:     cfg.Database.Port,
		User:     cfg.Database.User,
		Password: cfg.Database.Password,
		Database: cfg.Database.Database,
		SSLMode:  cfg.Database.SSLMode,
	}

	db, err := database.Initialize(dbConfig)
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}
	defer db.Close()

	databaseLogger := services.NewDatabaseLogger(db)
	databaseLogger.StartCleanupScheduler()

	if cfg.Server.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	// Initialize RabbitMQ on startup
	log.Println("🔗 Initializing RabbitMQ connection...")
	if err := agents.InitializeRabbitMQ(); err != nil {
		log.Printf("⚠️  RabbitMQ initialization warning: %v", err)
		log.Println("⚠️  RabbitMQ will be attempted on first use")
	} else {
		log.Println("✅ RabbitMQ initialized successfully")
	}

	// 1. CLEAN ROUTER FOR WEBSOCKET → ZERO MIDDLEWARE (critical!)
	wsRouter := gin.New() // No middleware at all!

	// WebSocket endpoint - completely isolated
	wsRouter.GET("/api/v1/agents/ws", agents.HandleWebSocket(agents.WSManager))

	// Optional: CORS preflight for WebSocket
	wsRouter.OPTIONS("/api/v1/agents/ws", func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "http://localhost:3000")
		c.Header("Access-Control-Allow-Headers", "Authorization, Sec-WebSocket-Protocol, Sec-WebSocket-Key, Sec-WebSocket-Version")
		c.Header("Access-Control-Allow-Methods", "GET")
		c.Status(http.StatusOK)
	})

	// 2. MAIN API ROUTER → WITH ALL MIDDLEWARE
	apiRouter := gin.New()
	setupGlobalMiddleware(apiRouter, cfg, databaseLogger)

	// Setup Cloudinary
	cloudinaryService, err := services.NewCloudinaryService(
		cfg.Cloudinary.CloudName,
		cfg.Cloudinary.APIKey,
		cfg.Cloudinary.APISecret,
	)
	if err != nil {
		log.Fatal("Failed to initialize Cloudinary service:", err)
	}

	// Register all REST API routes (with full middleware stack)
	setupRoutes(apiRouter, db, cloudinaryService, cfg)

	// 3. COMBINE ROUTERS USING http.ServeMux (correct path routing)
	mux := http.NewServeMux()

	// WebSocket routes first (exact match)
	mux.Handle("/api/v1/agents/ws", wsRouter)
	mux.Handle("/api/v1/agents/ws/", wsRouter) // in case of trailing slash

	// All other API routes
	mux.Handle("/", apiRouter)

	// 4. START SERVER
	addr := ":" + cfg.Server.Port
	log.Printf("Starting Backend Server on http://localhost%s", addr)
	log.Printf("WebSocket endpoint: ws://localhost%s/api/v1/agents/ws", addr)

	srv := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	go startUnverifiedUserCleanup(db.DB)

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal("Server failed to start:", err)
	}
}

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

func setupRoutes(router *gin.Engine, db *database.DB, cloudinaryService *services.CloudinaryService, cfg *Config) {
	// Public routes
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	api.SetupHealthRoutes(router.Group(""))

	// Auth-protected API routes
	v1 := router.Group("/api/v1")
	v1.Use(Auth(cfg.Security.JWTSecret))
	{
		auth.SetupRoutes(v1, db, cfg.Security.JWTSecret)
		organization.SetupRoutes(v1, db)
		credential.SetupRoutes(v1, db)
		logs.SetupRoutes(v1, db)
		asset.SetupRoutes(v1, db, cloudinaryService)
		agents.SetupRoutes(v1, db)
		workflow.SetupRoutes(v1, db)
		analytics.SetupRoutes(v1, db)
		todo.SetupRoutes(v1, db)
	}
}

func startUnverifiedUserCleanup(gormDB *gorm.DB) {
	for {
		deleteBefore := time.Now().Add(-1 * time.Minute)
		result := gormDB.Exec(
			"DELETE FROM users WHERE email_verified = false AND created_at < ?",
			deleteBefore,
		)
		if result.Error != nil {
			log.Printf("[CLEANUP] Failed to delete unverified users: %v", result.Error)
		} else if result.RowsAffected > 0 {
			log.Printf("[CLEANUP] Deleted %d unverified users older than 1 minute", result.RowsAffected)
		}
		time.Sleep(1 * time.Minute)
	}
}
