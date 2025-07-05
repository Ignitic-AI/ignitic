package auth

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"time"

	"backend/database"
	"backend/models"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	db *database.DB
}

// NewAuthService creates a new auth service instance
func NewAuthService(db *database.DB) *AuthService {
	return &AuthService{db: db}
}

// Login handles user login
func (s *AuthService) Login(c *gin.Context) {
	var loginData struct {
		Email    string `json:"email" binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}

	if err := c.ShouldBindJSON(&loginData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := s.db.Where("email = ?", loginData.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(loginData.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	// Generate JWT token
	token, err := s.generateToken(user.ID, user.Email, user.Role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token": token,
		"user": gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"first_name": user.FirstName,
			"last_name":  user.LastName,
			"role":       user.Role,
		},
	})
}

// Register handles user registration
func (s *AuthService) Register(c *gin.Context) {
	var userData struct {
		FirstName string `json:"first_name" binding:"required"`
		LastName  string `json:"last_name" binding:"required"`
		Email     string `json:"email" binding:"required,email"`
		Password  string `json:"password" binding:"required,min=8"`
	}

	if err := c.ShouldBindJSON(&userData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if user already exists
	var existingUser models.User
	if err := s.db.Where("email = ?", userData.Email).First(&existingUser).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "User already exists"})
		return
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(userData.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash password"})
		return
	}

	// Create user
	user := models.User{
		FirstName: userData.FirstName,
		LastName:  userData.LastName,
		Email:     userData.Email,
		Password:  string(hashedPassword),
		Role:      "user",
	}

	if err := s.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User created successfully",
		"user": gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"first_name": user.FirstName,
			"last_name":  user.LastName,
			"role":       user.Role,
		},
	})
}

// RefreshToken handles token refresh
func (s *AuthService) RefreshToken(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Refresh token endpoint - to be implemented"})
}

// Logout handles user logout
func (s *AuthService) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Logout endpoint - to be implemented"})
}

// GetProfile gets user profile
func (s *AuthService) GetProfile(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"first_name": user.FirstName,
			"last_name":  user.LastName,
			"role":       user.Role,
		},
	})
}

// UpdateProfile updates user profile
func (s *AuthService) UpdateProfile(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Update profile endpoint - to be implemented"})
}

// ChangePassword handles password change
func (s *AuthService) ChangePassword(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Change password endpoint - to be implemented"})
}

// ForgotPassword handles password reset request
func (s *AuthService) ForgotPassword(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Forgot password endpoint - to be implemented"})
}

// ResetPassword handles password reset
func (s *AuthService) ResetPassword(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Reset password endpoint - to be implemented"})
}

// VerifyEmail handles email verification
func (s *AuthService) VerifyEmail(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Verify email endpoint - to be implemented"})
}

// Helper function to generate JWT token
func (s *AuthService) generateToken(userID uint, email, role string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"email":   email,
		"role":    role,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte("your-secret-key-change-this"))
}

// Helper function to generate random string
func generateRandomString(length int) string {
	bytes := make([]byte, length)
	rand.Read(bytes)
	return hex.EncodeToString(bytes)
}
