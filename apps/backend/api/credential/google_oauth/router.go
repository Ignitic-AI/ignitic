package google_oauth

import (
	"os"

	"backend/api/credential"
	"backend/database"

	"github.com/gin-gonic/gin"
)

// http://localhost:8080/api/v1/google-oauth/callback
func SetupPublicRoutes(rg *gin.RouterGroup, db *database.DB, clientID, clientSecret, redirectURI string) {
	credentialSvc, err := credential.NewCredentialService(db)
	if err != nil {
		panic("Failed to create Credential service for Google OAuth: " + err.Error())
	}

	frontendURL := os.Getenv("FRONTEND_URL")

	service, err := NewGoogleOAuthService(db, credentialSvc, clientID, clientSecret, redirectURI, frontendURL)
	if err != nil {
		panic("Failed to create Google OAuth service: " + err.Error())
	}

	oauth := rg.Group("/google-oauth")
	{
		// Handle OAuth callback (public - Google redirects here)
		// GET /api/v1/google-oauth/callback?code=...&state=...
		oauth.GET("/callback", service.HandleCallback)
	}
}

// SetupRoutes sets up protected routes (auth required).
func SetupRoutes(rg *gin.RouterGroup, db *database.DB, clientID, clientSecret, redirectURI string) {
	credentialSvc, err := credential.NewCredentialService(db)
	if err != nil {
		panic("Failed to create Credential service for Google OAuth: " + err.Error())
	}

	frontendURL := os.Getenv("FRONTEND_URL")

	service, err := NewGoogleOAuthService(db, credentialSvc, clientID, clientSecret, redirectURI, frontendURL)
	if err != nil {
		panic("Failed to create Google OAuth service: " + err.Error())
	}

	oauth := rg.Group("/google-oauth")
	{

		oauth.POST("/auth/google", service.InitiateAuth)

		oauth.GET("/oauth/tokens", service.GetOAuthTokens)

		oauth.GET("/popup-tokens", service.GetPopupTokens)

		oauth.GET("/user/info", service.GetUserInfo)

		oauth.POST("/logout", service.Logout)
	}
}

