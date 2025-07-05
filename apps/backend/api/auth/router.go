package auth

import (
	"backend/database"

	"github.com/gin-gonic/gin"
)

// SetupRoutes sets up authentication routes
func SetupRoutes(rg *gin.RouterGroup, db *database.DB) {
	service := NewAuthService(db)

	auth := rg.Group("/auth")
	{
		auth.POST("/login", service.Login)
		auth.POST("/register", service.Register)
		auth.POST("/refresh", service.RefreshToken)
		auth.POST("/logout", service.Logout)
		auth.GET("/profile", service.GetProfile)
		auth.PUT("/profile", service.UpdateProfile)
		auth.POST("/change-password", service.ChangePassword)
		auth.POST("/forgot-password", service.ForgotPassword)
		auth.POST("/reset-password", service.ResetPassword)
		auth.POST("/verify-email", service.VerifyEmail)
	}
}
