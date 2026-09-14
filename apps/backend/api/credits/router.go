package credits

import (
	"backend/database"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(rg *gin.RouterGroup, db *database.DB) {
	service := NewCreditsService(db)
	group := rg.Group("/credits")
	{
		group.GET("/overview", service.Overview)
		group.GET("/records", service.Records)
		group.GET("/entitlements", service.Entitlements)
	}
}
