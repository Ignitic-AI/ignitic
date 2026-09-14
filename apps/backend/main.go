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
	"backend/api/credential/google_oauth"
	"backend/api/credits"
	"backend/api/logs"
	"backend/api/organization"
	"backend/api/todo"
	"backend/api/workflow"
	"backend/corsorigin"
	"backend/database"
	"backend/services"
	"backend/services/policy"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/gorm"

	_ "backend/docs"

	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

const agentsWebSocketPath = "/api/v1/agents/ws"

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
	policyService := policy.NewService(db)
	if err := policyService.EnsureSchemaAndSeed(); err != nil {
		log.Printf("⚠️ credits schema bootstrap warning: %v", err)
	}
	policyService.StartCycleResetScheduler()

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

	corsAllowList := buildCORSAllowList(cfg)
	log.Printf("CORS allowlist for agents REST + WebSocket: %v", corsAllowList)

	// 1. CLEAN ROUTER FOR WEBSOCKET → ZERO MIDDLEWARE (critical!)
	wsRouter := gin.New() // No middleware at all!

	// WebSocket endpoint - completely isolated
	wsRouter.GET(agentsWebSocketPath, agents.HandleWebSocket(agents.WSManager, corsAllowList))

	// CORS preflight for WebSocket (browser sends Origin of the frontend)
	wsRouter.OPTIONS(agentsWebSocketPath, websocketCORSPreflight(corsAllowList))

	// 2. MAIN API ROUTER → WITH ALL MIDDLEWARE
	apiRouter := gin.New()
	setupGlobalMiddleware(apiRouter, cfg, databaseLogger, corsAllowList)

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
	setupRoutes(apiRouter, db, cloudinaryService, cfg, corsAllowList)

	// 3. COMBINE ROUTERS USING http.ServeMux (correct path routing)
	mux := http.NewServeMux()

	// WebSocket routes first (exact match)
	mux.Handle(agentsWebSocketPath, wsRouter)
	mux.Handle(agentsWebSocketPath+"/", wsRouter) // in case of trailing slash

	// All other API routes
	mux.Handle("/", apiRouter)

	// 4. START SERVER
	addr := ":" + cfg.Server.Port
	log.Printf("Starting Backend Server on http://localhost%s", addr)
	log.Printf("WebSocket endpoint: ws://localhost%s%s", addr, agentsWebSocketPath)

	srv := &http.Server{
		Addr:    addr,
		Handler: mux,
	}

	go startUnverifiedUserCleanup(db.DB)

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal("Server failed to start:", err)
	}
}

func setupGlobalMiddleware(router *gin.Engine, cfg *Config, logger *services.DatabaseLogger, corsAllowList []string) {
	router.Use(RequestIDMiddleware())
	router.Use(logger.GinMiddleware())
	// Apply CORS middleware globally FIRST before other middleware
	// This ensures preflight OPTIONS requests are handled correctly
	router.Use(agents.StrictCORSMiddleware(corsAllowList))
	router.Use(RateLimiter(cfg.Security.RateLimitRPS))
	router.Use(SecurityHeaders())
	router.Use(ComplianceLogging())
	router.Use(gin.Logger())
	router.Use(gin.Recovery())
}

func setupRoutes(router *gin.Engine, db *database.DB, cloudinaryService *services.CloudinaryService, cfg *Config, corsAllowList []string) {
	// Public routes
	router.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))
	api.SetupHealthRoutes(router.Group(""))

	// Google OAuth callback must be public (Google redirects here)
	v1Public := router.Group("/api/v1")
	google_oauth.SetupPublicRoutes(v1Public, db, cfg.GoogleOAuth.ClientID, cfg.GoogleOAuth.ClientSecret, cfg.GoogleOAuth.RedirectURI)
	agents.SetupPublicRoutes(v1Public, db)

	// Auth-protected API routes
	v1 := router.Group("/api/v1")
	v1.Use(Auth(cfg.Security.JWTSecret))
	{
		auth.SetupRoutes(v1, db, cfg.Security.JWTSecret)
		organization.SetupRoutes(v1, db)
		credential.SetupRoutes(v1, db)
		google_oauth.SetupRoutes(v1, db, cfg.GoogleOAuth.ClientID, cfg.GoogleOAuth.ClientSecret, cfg.GoogleOAuth.RedirectURI)
		credits.SetupRoutes(v1, db)
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

// parseCommaSeparated splits a comma-separated env value into trimmed non-empty strings.
func parseCommaSeparated(s string) []string {
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// buildCORSAllowList merges CORS_ALLOWED_ORIGINS with FRONTEND_URL (from config) for agents REST + WebSocket.
// Origins are normalized (trim space, strip trailing '/') so FRONTEND_URL can match browser Origin exactly.
func buildCORSAllowList(cfg *Config) []string {
	raw := os.Getenv("CORS_ALLOWED_ORIGINS")
	if raw == "" {
		raw = "http://localhost:3000,http://localhost:5173"
	}
	list := parseCommaSeparated(raw)
	seen := make(map[string]struct{})
	out := make([]string, 0, len(list)+2)
	for _, o := range list {
		n := corsorigin.Normalize(o)
		if n == "" {
			continue
		}
		if _, dup := seen[n]; dup {
			continue
		}
		seen[n] = struct{}{}
		out = append(out, n)
	}
	if fe := corsorigin.Normalize(cfg.Email.FrontendURL); fe != "" {
		if _, dup := seen[fe]; !dup {
			seen[fe] = struct{}{}
			out = append(out, fe)
		}
	}
	return out
}

func websocketCORSPreflight(allowed []string) gin.HandlerFunc {
	allowedSet := make(map[string]struct{}, len(allowed))
	for _, o := range allowed {
		if n := corsorigin.Normalize(o); n != "" {
			allowedSet[n] = struct{}{}
		}
	}
	return func(c *gin.Context) {
		raw := c.GetHeader("Origin")
		if _, ok := allowedSet[corsorigin.Normalize(raw)]; ok && raw != "" {
			c.Header("Access-Control-Allow-Origin", raw)
			c.Header("Access-Control-Allow-Credentials", "true")
		}
		c.Header("Access-Control-Allow-Headers", "Authorization, Sec-WebSocket-Protocol, Sec-WebSocket-Key, Sec-WebSocket-Version")
		c.Header("Access-Control-Allow-Methods", "GET")
		c.Status(http.StatusOK)
	}
}
