package agents

import (
	"backend/corsorigin"
	"backend/database"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// StrictCORSMiddleware applies credentialed CORS with an explicit origin allowlist (normalized).
// Use it on every /api/v1 RouterGroup that must accept browser cross-origin calls (public + JWT routes).
func StrictCORSMiddleware(allowedOrigins []string) gin.HandlerFunc {
	if len(allowedOrigins) == 0 {
		allowedOrigins = []string{"http://localhost:3000"}
	}
	allowed := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		if n := corsorigin.Normalize(o); n != "" {
			allowed[n] = struct{}{}
		}
	}
	return cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			_, ok := allowed[corsorigin.Normalize(origin)]
			return ok
		},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Requested-With", "Sec-WebSocket-Protocol"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}

// SetupRoutes registers agent API routes (CORS is applied on the parent /api/v1 group in main.go).
func SetupRoutes(router *gin.RouterGroup, db *database.DB) {
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
