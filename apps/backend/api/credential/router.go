package credential

import (
	"backend/database"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(rg *gin.RouterGroup, db *database.DB) {
	service, err := NewCredentialService(db)
	if err != nil {
		panic("Failed to create credential service: " + err.Error())
	}

	// Group for secrets management
	secrets := rg.Group("/secrets")
	{
		// List all user's secrets
		secrets.GET("/user/all", service.ListUserSecrets)

		// List all organization secrets
		secrets.GET("/organization/:orgId", service.ListOrganizationSecrets)

		// PUT /secrets/{app}/{name} - Create or update secret
		secrets.PUT("/:app/:name", service.PutSecret)

		// GET /secrets/{app}/{name} - Get specific secret
		secrets.GET("/:app/:name", service.GetSecret)

		// DELETE /secrets/{app}/{name} - Delete secret
		secrets.DELETE("/:app/:name", service.DeleteSecret)

		// GET /secrets/{app} - List all secrets for an app
		secrets.GET("/:app", service.ListSecrets)
	}
}
