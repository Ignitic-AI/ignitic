package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// SetupHealthRoutes sets up health check routes
func SetupHealthRoutes(rg *gin.RouterGroup) {
	health := rg.Group("/health")
	{
		health.GET("", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{
				"status":  "healthy",
				"service": "backend",
				"version": "1.0.0",
			})
		})
	}
} 