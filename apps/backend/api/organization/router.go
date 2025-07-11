package organization

import (
	"backend/database"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(rg *gin.RouterGroup, db *database.DB) {
	service := NewOrganizationService(db)

	org := rg.Group("/organizations")
	{
		// Organization CRUD
		org.POST("", service.CreateOrganization)    // Create organization
		org.GET("", service.ListOrganizations)      // List user's organizations
		org.GET("/:id", service.GetOrganization)    // Get organization details
		org.PUT("/:id", service.UpdateOrganization) // Update organization (admin only)

		// Organization membership
		org.POST("/:id/join", service.JoinOrganization)   // Join organization
		org.POST("/:id/leave", service.LeaveOrganization) // Leave organization
	}
}
