package workflow

import (
	"backend/database"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(router *gin.RouterGroup, db *database.DB) {
	SetLogger(db)
	SetDB(db)

	workflow := router.Group("/workflow-template/n8n")
	{
		workflow.POST("/import", importWorkflowFromJSON())

		workflow.GET("/", getWorkflowTemplates())

		workflow.GET("/:id", getWorkflowTemplate())

		workflow.DELETE("/:id", deleteWorkflowTemplate())
	}
}
