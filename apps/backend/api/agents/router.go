package agents

import (
	"backend/database"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(router *gin.RouterGroup, db *database.DB) {
	// ADDED: CORS Middleware Configuration
	// This allows your frontend (e.g., from http://localhost:3000) to connect.
	router.Use(cors.New(cors.Config{
		// Replace with your frontend's actual origin
		AllowOrigins: []string{"http://localhost:3000"},
		AllowMethods: []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"},
		AllowHeaders: []string{"Origin",
			"Content-Length",
			"Content-Type",
			"Authorization",
			"Sec-WebSocket-Key",
			"Sec-WebSocket-Version",
			"Sec-WebSocket-Extensions",
			"Sec-WebSocket-Protocol"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		AllowOriginFunc: func(origin string) bool {
			return true // Be careful with this in production
		},
		MaxAge: 12 * time.Hour,
	}))

	SetLogger(db)
	SetDB(db)
	agent := router.Group("/agents")
	{
		// Authenticated REST endpoints only
		agent.POST("/chat", createAgentChatRequest())
		agent.GET("/chat/:request_id", getAgentChatStatus())
		agent.GET("/status", getAgentSystemStatus())
		agent.GET("/queues", getQueueInfo())
		agent.GET("/", listAgents())
		agent.GET("/:agent/tools", listAgentTools())
		agent.GET("/chats", listChats())
		agent.GET("/chats/:chat_id", getChat())
		agent.GET("/chats/:chat_id/messages", getChatMessages())
	}
}

func SetupWSRoutes(router *gin.RouterGroup, db *database.DB) {
	SetLogger(db)
	SetDB(db)
	agent := router.Group("/agents")
	{
		agent.OPTIONS("/ws", func(c *gin.Context) { c.Status(http.StatusOK) })
		agent.GET("/ws", handleWebSocket())
	}
}
