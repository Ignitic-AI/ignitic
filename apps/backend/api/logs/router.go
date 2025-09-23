package logs

import (
	"backend/database"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(rg *gin.RouterGroup, db *database.DB) {
	svc := NewLogService(db)

	logs := rg.Group("/logs")
	{
		logs.GET("", svc.ListLogs())
		logs.GET("/sections/:section", svc.ListLogsBySection())
		logs.GET("/sections", svc.ListSections())
	}
}
