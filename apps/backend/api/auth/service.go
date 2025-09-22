package auth

import (
	"crypto/rand"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"backend/database"
	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	db           *database.DB
	emailService *services.EmailService
	logger       *services.DatabaseLogger
	jwtSecret    string
}

// NewAuthService creates a new auth service instance
func NewAuthService(db *database.DB, jwtSecret string) *AuthService {
	return &AuthService{
		db:           db,
		emailService: services.NewEmailService(),
		logger:       services.NewDatabaseLogger(db),
		jwtSecret:    jwtSecret,
	}
}

// Login godoc
// @Summary      User login
// @Description  Authenticates a user and returns a JWT token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        loginData  body  map[string]interface{}  true  "Login data"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]interface{}
// @Router       /api/v1/auth/login [post]
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
		s.logger.LogAuth(c.Request.Context(), models.LogLevelError, "TOKEN_GENERATION_FAILED",
			"Failed to generate JWT token",
			services.WithUserID(user.ID),
			services.WithIPAddress(c.ClientIP()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate token"})
		return
	}

	// Log successful login
	s.logger.LogAuth(c.Request.Context(), models.LogLevelInfo, "LOGIN_SUCCESS",
		"User logged in successfully",
		services.WithUserID(user.ID),
		services.WithIPAddress(c.ClientIP()),
		services.WithMetadata(map[string]interface{}{
			"email": user.Email,
			"role":  user.Role,
		}))

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

// Register godoc
// @Summary      Register a new user
// @Description  Registers a new user and sends a verification email
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        userData  body  map[string]interface{}  true  "User registration data"
// @Success      201  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      409  {object}  map[string]interface{}
// @Router       /api/v1/auth/register [post]
func (s *AuthService) Register(c *gin.Context) {
	var userData struct {
		FirstName string `json:"first_name" binding:"required"`
		LastName  string `json:"last_name" binding:"required"`
		Email     string `json:"email" binding:"required,email"`
		Password  string `json:"password" binding:"required,min=10"`
	}

	if err := c.ShouldBindJSON(&userData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate password strength
	if err := validatePasswordStrength(userData.Password); err != nil {
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

	// Generate verification code (6 digits)
	verificationToken := generateVerificationCode()

	// Create user
	user := models.User{
		FirstName:         userData.FirstName,
		LastName:          userData.LastName,
		Email:             userData.Email,
		Password:          string(hashedPassword),
		Role:              "user",
		EmailVerified:     false,
		VerificationToken: verificationToken,
	}

	if err := s.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create user"})
		return
	}

	// Send verification email
	if err := s.emailService.SendVerificationEmail(user.Email, user.FirstName, verificationToken); err != nil {
		// Log error but don't fail registration
		fmt.Printf("Failed to send verification email: %v\n", err)
	}

	// Print verification code to console for testing
	fmt.Printf("🔑 VERIFICATION CODE for %s: %s\n", user.Email, verificationToken)

	c.JSON(http.StatusCreated, gin.H{
		"message": "User created successfully. Please check your email to verify your account.",
		"user": gin.H{
			"id":             user.ID,
			"email":          user.Email,
			"first_name":     user.FirstName,
			"last_name":      user.LastName,
			"role":           user.Role,
			"email_verified": user.EmailVerified,
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

// GetProfile godoc
// @Summary      Get user profile
// @Description  Returns the authenticated user's profile
// @Tags         auth
// @Security     BearerAuth
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]interface{}
// @Router       /api/v1/auth/profile [get]
func (s *AuthService) GetProfile(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
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

// VerifyEmail godoc
// @Summary      Verify email
// @Description  Verifies a user's email using a code
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        verifyData  body  map[string]interface{}  true  "Verification code"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Router       /api/v1/auth/verify-email [post]
func (s *AuthService) VerifyEmail(c *gin.Context) {
	var verifyData struct {
		Token string `json:"token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&verifyData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user by verification token
	var user models.User
	if err := s.db.Where("verification_token = ? AND verification_token != ''", verifyData.Token).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired verification token"})
		return
	}

	// Check if already verified
	if user.EmailVerified {
		c.JSON(http.StatusOK, gin.H{"message": "Email already verified"})
		return
	}

	// Update user as verified
	user.EmailVerified = true
	user.VerificationToken = "" // Clear the token
	if err := s.db.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify email"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Email verified successfully",
		"user": gin.H{
			"id":             user.ID,
			"email":          user.Email,
			"first_name":     user.FirstName,
			"last_name":      user.LastName,
			"role":           user.Role,
			"email_verified": user.EmailVerified,
		},
	})
}

// Helper function to generate JWT token
func (s *AuthService) generateToken(userID uuid.UUID, email, role string) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID.String(),
		"email":   email,
		"role":    role,
		"exp":     time.Now().Add(time.Hour * 24).Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.jwtSecret))
}

// Helper function to generate 6-digit verification code
func generateVerificationCode() string {
	bytes := make([]byte, 3)
	rand.Read(bytes)

	// Convert to 6-digit number
	code := 0
	for i := 0; i < 3; i++ {
		code = code*256 + int(bytes[i])
	}

	// Ensure it's 6 digits (100000-999999)
	code = (code % 900000) + 100000

	return fmt.Sprintf("%06d", code)
}

// validatePasswordStrength validates password complexity
func validatePasswordStrength(password string) error {
	var errors []string

	// Minimum length check
	if len(password) < 10 {
		errors = append(errors, "Password must be at least 10 characters long")
	}

	// Maximum length check (prevent extremely long passwords)
	if len(password) > 128 {
		errors = append(errors, "Password must be less than 128 characters long")
	}

	// Check for uppercase letter
	hasUpper := regexp.MustCompile(`[A-Z]`).MatchString(password)
	if !hasUpper {
		errors = append(errors, "Password must contain at least one uppercase letter")
	}

	// Check for lowercase letter
	hasLower := regexp.MustCompile(`[a-z]`).MatchString(password)
	if !hasLower {
		errors = append(errors, "Password must contain at least one lowercase letter")
	}

	// Check for number
	hasNumber := regexp.MustCompile(`[0-9]`).MatchString(password)
	if !hasNumber {
		errors = append(errors, "Password must contain at least one number")
	}

	// Check for special character
	hasSpecial := regexp.MustCompile(`[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~` + "`" + `]`).MatchString(password)
	if !hasSpecial {
		errors = append(errors, "Password must contain at least one special character")
	}

	// Check against common passwords
	commonPasswords := []string{
		"password", "123456", "123456789", "12345678", "12345",
		"1234567", "password123", "admin", "qwerty", "abc123",
		"Password123", "password1", "welcome", "letmein", "monkey",
		"dragon", "master", "shadow", "sunshine", "football",
	}

	passwordLower := strings.ToLower(password)
	for _, common := range commonPasswords {
		if passwordLower == strings.ToLower(common) {
			errors = append(errors, "Password is too common, please choose a stronger password")
			break
		}
	}

	// Check for repeated characters (more than 3 consecutive)
	if hasConsecutiveRepeatedChars(password, 4) {
		errors = append(errors, "Password cannot contain more than 3 consecutive identical characters")
	}

	// Check for sequential characters
	if hasSequentialChars(password) {
		errors = append(errors, "Password cannot contain sequential characters (e.g., 1234, abcd)")
	}

	if len(errors) > 0 {
		return fmt.Errorf("password validation failed: %s", strings.Join(errors, "; "))
	}

	return nil
}

// hasConsecutiveRepeatedChars checks if password has consecutive repeated characters
func hasConsecutiveRepeatedChars(password string, maxRepeats int) bool {
	if len(password) < maxRepeats {
		return false
	}

	count := 1
	for i := 1; i < len(password); i++ {
		if password[i] == password[i-1] {
			count++
			if count >= maxRepeats {
				return true
			}
		} else {
			count = 1
		}
	}
	return false
}

// hasSequentialChars checks for sequential characters in password
func hasSequentialChars(password string) bool {
	sequences := []string{
		"0123456789", "abcdefghijklmnopqrstuvwxyz", "qwertyuiop", "asdfghjkl", "zxcvbnm",
		"9876543210", "zyxwvutsrqponmlkjihgfedcba",
	}

	passwordLower := strings.ToLower(password)

	for _, seq := range sequences {
		for i := 0; i <= len(seq)-4; i++ {
			if strings.Contains(passwordLower, seq[i:i+4]) {
				return true
			}
		}
	}

	return false
}
