package agents

import (
	"backend/database"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// Only REST routes — CORS is OK here because these are normal HTTP APIs
func SetupRoutes(router *gin.RouterGroup, db *database.DB) {
	// CORS only for REST APIs (safe)
	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
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
		agent.DELETE("/:agent", deleteCustomAgent())
		agent.GET("/:agent/get-agent", getAgent())
		agent.PUT("/:agent/update-agent", updateAgent())
		agent.GET("/:agent/tools", listAgentTools())
	}
}
