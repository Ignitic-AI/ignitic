package analytics

import (
	"backend/database"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(rg *gin.RouterGroup, db *database.DB) {
	SetLogger(db)

	analytics := rg.Group("/analytics")
	{
		analytics.GET("/agent/runs", GetAgentRuns())
		analytics.GET("/agent/usage", GetAgentUsage())
	}
}
