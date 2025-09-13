package agents

import (
	"github.com/gin-gonic/gin"
)

func SetupRoutes(router *gin.RouterGroup) {
	agent := router.Group("/agents")
	{
		// WebSocket endpoint for real-time agent communication
		agent.GET("/ws", handleWebSocket())

		// Keep REST endpoints for compatibility
		agent.POST("/chat", createAgentChatRequest())
		agent.GET("/chat/:request_id", getAgentChatStatus())
		agent.GET("/status", getAgentSystemStatus())
		agent.GET("/queues", getQueueInfo())
	}
}
