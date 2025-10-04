package asset

import (
	"backend/database"
	"backend/services"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(rg *gin.RouterGroup, db *database.DB, cloudinary *services.CloudinaryService) {
	service := NewAssetService(db, cloudinary)

	assets := rg.Group("/assets")
	{
		// Asset Categories
		assets.GET("/categories", service.GetCategories) // Get all available categories

		// Asset CRUD
		assets.POST("", service.UploadAsset)       // Upload new asset
		assets.GET("", service.ListAssets)         // List assets (with optional org_id query param)
		assets.GET("/:id", service.GetAsset)       // Get asset details
		assets.PUT("/:id", service.UpdateAsset)    // Update asset
		assets.DELETE("/:id", service.DeleteAsset) // Delete asset
	}
}
