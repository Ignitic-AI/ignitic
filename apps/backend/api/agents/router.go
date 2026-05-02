package agents

import (
	"backend/database"
	"backend/corsorigin"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// Only REST routes — CORS is OK here because these are normal HTTP APIs
func SetupRoutes(router *gin.RouterGroup, db *database.DB, allowedOrigins []string) {
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{"http://localhost:3000"}
	}
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		if n := corsorigin.Normalize(o); n != "" {
			allowed[n] = struct{}{}
		}
	}
	// Strict allowlist (required when AllowCredentials is true — cannot use "*").
	// AllowOriginFunc compares normalized origins so FRONTEND_URL with trailing slash still matches the browser.
	router.Use(cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			_, ok := allowed[corsorigin.Normalize(origin)]
			return ok
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization", "Sec-WebSocket-Protocol"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	SetLogger(db)
	SetDB(db)

	agent := router.Group("/agents")
	{
		agent.POST("/chat", createAgentChatRequest())
		agent.GET("/chat/:request_id", getAgentChatStatus())
		agent.GET("/status", getAgentSystemStatus())
		agent.GET("/queues", getQueueInfo())
		agent.GET("/available-tools", availableCustomAgentTools())
		agent.POST("/", createCustomAgent())
		agent.GET("/", listAgents())
		agent.GET("/chats", listChats())
		agent.GET("/chats/:chat_id", getChat())
		agent.GET("/chats/:chat_id/messages", getChatMessages())
		agent.POST("/chats/:chat_id/share", createChatShare())
		agent.DELETE("/chats/:chat_id", deleteChat())
		agent.DELETE("/:agent", deleteCustomAgent())
		agent.GET("/:agent/get-agent", getAgent())
		agent.PUT("/:agent/update-agent", updateAgent())
		agent.GET("/:agent/tools", listAgentTools())
		agent.GET("/:agent/tool-calls", listAgentToolCalls())
	}
}

// SetupPublicRoutes exposes read-only unauthenticated routes.
func SetupPublicRoutes(router *gin.RouterGroup, db *database.DB) {
	SetLogger(db)
	SetDB(db)

	publicAgents := router.Group("/public/agents")
	{
		publicAgents.GET("/chats/shared/:token", getSharedChat())
	}
}
