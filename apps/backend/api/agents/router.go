package agents

import (
	"backend/database"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(router *gin.RouterGroup, db *database.DB) {
	SetLogger(db)
	SetDB(db)
	agent := router.Group("/agents")
	{
		agent.GET("/ws", handleWebSocket())

		agent.POST("/chat", createAgentChatRequest())
		agent.GET("/chat/:request_id", getAgentChatStatus())
		agent.GET("/status", getAgentSystemStatus())
		agent.GET("/queues", getQueueInfo())
	}
}
