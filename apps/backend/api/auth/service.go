package auth

import (
	"crypto/rand"
	"encoding/json"
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
		// Log failed login - user not found
		_ = s.logger.LogAuth(c.Request.Context(), models.LogLevelWarn, "LOGIN_FAILED",
			"Invalid credentials",
			services.WithAuthResult("UNAUTHORIZED"),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
			services.WithIPAddress(c.ClientIP()),
			services.WithStatusCode(http.StatusUnauthorized),
		)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid credentials"})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(loginData.Password)); err != nil {
		// Log failed login - bad password
		_ = s.logger.LogAuth(c.Request.Context(), models.LogLevelWarn, "LOGIN_FAILED",
			"Invalid credentials",
			services.WithUserID(user.ID),
			services.WithAuthResult("UNAUTHORIZED"),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
			services.WithIPAddress(c.ClientIP()),
			services.WithStatusCode(http.StatusUnauthorized),
		)
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
	_ = s.logger.LogAuth(c.Request.Context(), models.LogLevelInfo, "LOGIN_SUCCESS",
		"User logged in successfully",
		services.WithUserID(user.ID),
		services.WithAuthResult("SUCCESS"),
		services.WithEndpoint(c.FullPath()),
		services.WithMethod(c.Request.Method),
		services.WithIPAddress(c.ClientIP()),
		services.WithStatusCode(http.StatusOK),
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

// RefreshToken godoc
// @Summary      Refresh JWT token
// @Description  Refreshes the user's JWT token if it's still valid
// @Tags         auth
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]interface{}
// @Router       /api/v1/auth/refresh [post]
func (s *AuthService) RefreshToken(c *gin.Context) {
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

	// Find the user to ensure they still exist and are active
	var user models.User
	if err := s.db.Where("id = ? AND is_active = ?", userID, true).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found or inactive"})
		return
	}

	// Generate new JWT token
	token, err := s.generateToken(user.ID, user.Email, user.Role)
	if err != nil {
		s.logger.LogAuth(c.Request.Context(), models.LogLevelError, "REFRESH_TOKEN_GENERATION_FAILED",
			"Failed to generate new JWT token",
			services.WithUserID(user.ID),
			services.WithIPAddress(c.ClientIP()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate new token"})
		return
	}

	// Log successful token refresh
	_ = s.logger.LogAuth(c.Request.Context(), models.LogLevelInfo, "TOKEN_REFRESHED",
		"JWT token refreshed successfully",
		services.WithUserID(user.ID),
		services.WithAuthResult("SUCCESS"),
		services.WithEndpoint(c.FullPath()),
		services.WithMethod(c.Request.Method),
		services.WithIPAddress(c.ClientIP()),
		services.WithStatusCode(http.StatusOK))

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

// Logout godoc
// @Summary      User logout
// @Description  Logs out the user (client should discard the token)
// @Tags         auth
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Success      200  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]interface{}
// @Router       /api/v1/auth/logout [post]
func (s *AuthService) Logout(c *gin.Context) {
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

	// Update last login time (optional - could be done on login instead)
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err == nil {
		now := time.Now()
		user.LastLogin = &now
		s.db.Save(&user)
	}

	// Log successful logout
	_ = s.logger.LogAuth(c.Request.Context(), models.LogLevelInfo, "LOGOUT_SUCCESS",
		"User logged out successfully",
		services.WithUserID(userID),
		services.WithAuthResult("SUCCESS"),
		services.WithEndpoint(c.FullPath()),
		services.WithMethod(c.Request.Method),
		services.WithIPAddress(c.ClientIP()),
		services.WithStatusCode(http.StatusOK))

	c.JSON(http.StatusOK, gin.H{
		"message": "Logged out successfully",
	})
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

	onboardingRaw := json.RawMessage(nil)
	if len(user.OnboardingPersonal) > 0 {
		onboardingRaw = user.OnboardingPersonal
	}

	c.JSON(http.StatusOK, gin.H{
		"user": gin.H{
			"id":                   user.ID,
			"email":                user.Email,
			"first_name":           user.FirstName,
			"last_name":            user.LastName,
			"phone":                user.Phone,
			"company":              user.Company,
			"role":                 user.Role,
			"is_active":            user.IsActive,
			"last_login":           user.LastLogin,
			"organization_id":      user.OrganizationID,
			"email_verified":       user.EmailVerified,
			"onboarding_personal":  onboardingRaw,
			"created_at":           user.CreatedAt,
			"updated_at":           user.UpdatedAt,
		},
	})
}

// SavePersonalOnboarding stores wizard answers for users without a created organization (or who skipped org creation).
func (s *AuthService) SavePersonalOnboarding(c *gin.Context) {
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

	var body struct {
		HasOrganization          bool     `json:"has_organization"`
		CreatedOrganization      bool     `json:"created_organization"`
		OrgName                  string   `json:"org_name"`
		Platform                 string   `json:"platform"`
		WorkOnMultiplePlatforms  bool     `json:"work_on_multiple_platforms"`
		SelectedBrands           []string `json:"selected_brands"`
		SizeOfOrg                string   `json:"size_of_org"`
		YourRole                 string   `json:"your_role"`
		Country                  string   `json:"country"`
		WhereYouHearUs           string   `json:"where_you_hear_us"`
		PreferredAutomationIDs   []string `json:"preferred_automation_ids"`
		InvitedEmails            []string `json:"invited_emails"`
	}

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	raw, err := json.Marshal(body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to serialize onboarding data"})
		return
	}
	user.OnboardingPersonal = json.RawMessage(raw)

	if err := s.db.Save(&user).Error; err != nil {
		s.logger.LogAuth(c.Request.Context(), models.LogLevelError, "ONBOARDING_PERSONAL_SAVE_FAILED",
			"Failed to save personal onboarding",
			services.WithUserID(user.ID),
			services.WithIPAddress(c.ClientIP()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save onboarding preferences"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Onboarding preferences saved"})
}

// UpdateProfile godoc
// @Summary      Update user profile
// @Description  Updates the authenticated user's profile information
// @Tags         auth
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        profileData  body  map[string]interface{}  true  "Profile update data"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]interface{}
// @Failure      404  {object}  map[string]interface{}
// @Router       /api/v1/auth/profile [put]
func (s *AuthService) UpdateProfile(c *gin.Context) {
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

	var updateData struct {
		FirstName string `json:"first_name"`
		LastName  string `json:"last_name"`
		Phone     string `json:"phone"`
		Company   string `json:"company"`
	}

	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate phone number if provided
	if updateData.Phone != "" {
		if err := validatePhoneNumber(updateData.Phone); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	// Validate company name if provided
	if updateData.Company != "" {
		if err := validateCompanyName(updateData.Company); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
	}

	// Find the user
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Track what fields are being updated for logging
	updatedFields := make(map[string]interface{})
	oldValues := make(map[string]interface{})

	// Update fields only if they are provided and different
	if updateData.FirstName != "" && updateData.FirstName != user.FirstName {
		oldValues["first_name"] = user.FirstName
		user.FirstName = updateData.FirstName
		updatedFields["first_name"] = updateData.FirstName
	}

	if updateData.LastName != "" && updateData.LastName != user.LastName {
		oldValues["last_name"] = user.LastName
		user.LastName = updateData.LastName
		updatedFields["last_name"] = updateData.LastName
	}

	if updateData.Phone != "" && updateData.Phone != user.Phone {
		oldValues["phone"] = user.Phone
		user.Phone = updateData.Phone
		updatedFields["phone"] = updateData.Phone
	}

	if updateData.Company != "" && updateData.Company != user.Company {
		oldValues["company"] = user.Company
		user.Company = updateData.Company
		updatedFields["company"] = updateData.Company
	}

	// If no fields were actually updated
	if len(updatedFields) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message": "No changes detected",
			"user": gin.H{
				"id":              user.ID,
				"email":           user.Email,
				"first_name":      user.FirstName,
				"last_name":       user.LastName,
				"phone":           user.Phone,
				"company":         user.Company,
				"role":            user.Role,
				"is_active":       user.IsActive,
				"last_login":      user.LastLogin,
				"organization_id": user.OrganizationID,
				"email_verified":  user.EmailVerified,
				"created_at":      user.CreatedAt,
				"updated_at":      user.UpdatedAt,
			},
		})
		return
	}

	// Save the updated user
	if err := s.db.Save(&user).Error; err != nil {
		s.logger.LogAuth(c.Request.Context(), models.LogLevelError, "PROFILE_UPDATE_FAILED",
			"Failed to update user profile",
			services.WithUserID(user.ID),
			services.WithIPAddress(c.ClientIP()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile"})
		return
	}

	// Log successful profile update
	_ = s.logger.LogAuth(c.Request.Context(), models.LogLevelInfo, "PROFILE_UPDATED",
		"User profile updated successfully",
		services.WithUserID(user.ID),
		services.WithAuthResult("SUCCESS"),
		services.WithEndpoint(c.FullPath()),
		services.WithMethod(c.Request.Method),
		services.WithIPAddress(c.ClientIP()),
		services.WithStatusCode(http.StatusOK),
		services.WithMetadata(map[string]interface{}{
			"updated_fields": updatedFields,
			"old_values":     oldValues,
		}))

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated successfully",
		"user": gin.H{
			"id":              user.ID,
			"email":           user.Email,
			"first_name":      user.FirstName,
			"last_name":       user.LastName,
			"phone":           user.Phone,
			"company":         user.Company,
			"role":            user.Role,
			"is_active":       user.IsActive,
			"last_login":      user.LastLogin,
			"organization_id": user.OrganizationID,
			"email_verified":  user.EmailVerified,
			"created_at":      user.CreatedAt,
			"updated_at":      user.UpdatedAt,
		},
	})
}

// ChangePassword godoc
// @Summary      Change user password
// @Description  Changes the authenticated user's password after verifying current password
// @Tags         auth
// @Security     BearerAuth
// @Accept       json
// @Produce      json
// @Param        passwordData  body  map[string]interface{}  true  "Password change data"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]interface{}
// @Router       /api/v1/auth/change-password [post]
func (s *AuthService) ChangePassword(c *gin.Context) {
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

	var passwordData struct {
		CurrentPassword string `json:"current_password" binding:"required"`
		NewPassword     string `json:"new_password" binding:"required,min=10"`
	}

	if err := c.ShouldBindJSON(&passwordData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate new password strength
	if err := validatePasswordStrength(passwordData.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if new password is different from current password
	if passwordData.CurrentPassword == passwordData.NewPassword {
		c.JSON(http.StatusBadRequest, gin.H{"error": "New password must be different from current password"})
		return
	}

	// Find the user
	var user models.User
	if err := s.db.Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	// Verify current password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(passwordData.CurrentPassword)); err != nil {
		// Log failed password change attempt
		_ = s.logger.LogAuth(c.Request.Context(), models.LogLevelWarn, "PASSWORD_CHANGE_FAILED",
			"Invalid current password provided",
			services.WithUserID(user.ID),
			services.WithAuthResult("UNAUTHORIZED"),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
			services.WithIPAddress(c.ClientIP()),
			services.WithStatusCode(http.StatusUnauthorized),
		)
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Current password is incorrect"})
		return
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(passwordData.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		s.logger.LogAuth(c.Request.Context(), models.LogLevelError, "PASSWORD_HASH_FAILED",
			"Failed to hash new password",
			services.WithUserID(user.ID),
			services.WithIPAddress(c.ClientIP()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to hash new password"})
		return
	}

	// Update password
	user.Password = string(hashedPassword)
	if err := s.db.Save(&user).Error; err != nil {
		s.logger.LogAuth(c.Request.Context(), models.LogLevelError, "PASSWORD_UPDATE_FAILED",
			"Failed to update user password",
			services.WithUserID(user.ID),
			services.WithIPAddress(c.ClientIP()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	// Log successful password change
	_ = s.logger.LogAuth(c.Request.Context(), models.LogLevelInfo, "PASSWORD_CHANGED",
		"User password changed successfully",
		services.WithUserID(user.ID),
		services.WithAuthResult("SUCCESS"),
		services.WithEndpoint(c.FullPath()),
		services.WithMethod(c.Request.Method),
		services.WithIPAddress(c.ClientIP()),
		services.WithStatusCode(http.StatusOK))

	c.JSON(http.StatusOK, gin.H{
		"message": "Password changed successfully",
	})
}

// ForgotPassword godoc
// @Summary      Request password reset
// @Description  Sends a password reset token to the user's email
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        resetData  body  map[string]interface{}  true  "Password reset request data"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      404  {object}  map[string]interface{}
// @Router       /api/v1/auth/forgot-password [post]
func (s *AuthService) ForgotPassword(c *gin.Context) {
	var resetData struct {
		Email string `json:"email" binding:"required,email"`
	}

	if err := c.ShouldBindJSON(&resetData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user by email
	var user models.User
	if err := s.db.Where("email = ?", resetData.Email).First(&user).Error; err != nil {
		// For security, don't reveal if email exists or not
		// Log the attempt for security monitoring
		_ = s.logger.LogAuth(c.Request.Context(), models.LogLevelInfo, "PASSWORD_RESET_REQUESTED",
			"Password reset requested for non-existent email",
			services.WithAuthResult("NOT_FOUND"),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
			services.WithIPAddress(c.ClientIP()),
			services.WithStatusCode(http.StatusOK),
			services.WithMetadata(map[string]interface{}{
				"email": resetData.Email,
			}))

		// Return success even if email doesn't exist (security best practice)
		c.JSON(http.StatusOK, gin.H{
			"message": "If the email exists, a password reset link has been sent",
		})
		return
	}

	// Generate reset token (32 character random string)
	resetToken := generateResetToken()
	expiryTime := time.Now().Add(time.Hour * 1) // Token expires in 1 hour

	// Update user with reset token
	user.ResetToken = resetToken
	user.ResetTokenExpiry = &expiryTime
	if err := s.db.Save(&user).Error; err != nil {
		s.logger.LogAuth(c.Request.Context(), models.LogLevelError, "RESET_TOKEN_SAVE_FAILED",
			"Failed to save reset token",
			services.WithUserID(user.ID),
			services.WithIPAddress(c.ClientIP()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process reset request"})
		return
	}

	// Send reset email
	if err := s.emailService.SendPasswordResetEmail(user.Email, user.FirstName, resetToken); err != nil {
		// Log error but don't fail the request
		s.logger.LogAuth(c.Request.Context(), models.LogLevelError, "RESET_EMAIL_FAILED",
			"Failed to send password reset email",
			services.WithUserID(user.ID),
			services.WithIPAddress(c.ClientIP()))

		// Print reset token to console for testing
		fmt.Printf("🔑 RESET TOKEN for %s: %s\n", user.Email, resetToken)
	} else {
		// Log successful email send
		_ = s.logger.LogAuth(c.Request.Context(), models.LogLevelInfo, "RESET_EMAIL_SENT",
			"Password reset email sent successfully",
			services.WithUserID(user.ID),
			services.WithAuthResult("SUCCESS"),
			services.WithEndpoint(c.FullPath()),
			services.WithMethod(c.Request.Method),
			services.WithIPAddress(c.ClientIP()),
			services.WithStatusCode(http.StatusOK),
			services.WithMetadata(map[string]interface{}{
				"email": user.Email,
			}))
	}

	// Print reset token to console for testing
	fmt.Printf("🔑 RESET TOKEN for %s: %s\n", user.Email, resetToken)

	c.JSON(http.StatusOK, gin.H{
		"message": "If the email exists, a password reset link has been sent",
	})
}

// ResetPassword godoc
// @Summary      Reset password with token
// @Description  Resets user password using a valid reset token
// @Tags         auth
// @Accept       json
// @Produce      json
// @Param        resetData  body  map[string]interface{}  true  "Password reset data"
// @Success      200  {object}  map[string]interface{}
// @Failure      400  {object}  map[string]interface{}
// @Failure      401  {object}  map[string]interface{}
// @Router       /api/v1/auth/reset-password [post]
func (s *AuthService) ResetPassword(c *gin.Context) {
	var resetData struct {
		Token       string `json:"token" binding:"required"`
		NewPassword string `json:"new_password" binding:"required,min=10"`
	}

	if err := c.ShouldBindJSON(&resetData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate new password strength
	if err := validatePasswordStrength(resetData.NewPassword); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Find user by reset token
	var user models.User
	if err := s.db.Where("reset_token = ? AND reset_token != ''", resetData.Token).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or expired reset token"})
		return
	}

	// Check if token has expired
	if user.ResetTokenExpiry == nil || time.Now().After(*user.ResetTokenExpiry) {
		// Clear expired token
		user.ResetToken = ""
		user.ResetTokenExpiry = nil
		s.db.Save(&user)

		c.JSON(http.StatusBadRequest, gin.H{"error": "Reset token has expired"})
		return
	}

	// Hash new password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(resetData.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		s.logger.LogAuth(c.Request.Context(), models.LogLevelError, "RESET_PASSWORD_HASH_FAILED",
			"Failed to hash new password during reset",
			services.WithUserID(user.ID),
			services.WithIPAddress(c.ClientIP()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to process password reset"})
		return
	}

	// Update password and clear reset token
	user.Password = string(hashedPassword)
	user.ResetToken = ""
	user.ResetTokenExpiry = nil

	if err := s.db.Save(&user).Error; err != nil {
		s.logger.LogAuth(c.Request.Context(), models.LogLevelError, "RESET_PASSWORD_SAVE_FAILED",
			"Failed to save new password during reset",
			services.WithUserID(user.ID),
			services.WithIPAddress(c.ClientIP()))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update password"})
		return
	}

	// Log successful password reset
	_ = s.logger.LogAuth(c.Request.Context(), models.LogLevelInfo, "PASSWORD_RESET_SUCCESS",
		"User password reset successfully",
		services.WithUserID(user.ID),
		services.WithAuthResult("SUCCESS"),
		services.WithEndpoint(c.FullPath()),
		services.WithMethod(c.Request.Method),
		services.WithIPAddress(c.ClientIP()),
		services.WithStatusCode(http.StatusOK))

	c.JSON(http.StatusOK, gin.H{
		"message": "Password reset successfully. You can now login with your new password.",
	})
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

// validatePhoneNumber validates phone number format
func validatePhoneNumber(phone string) error {
	// Remove all non-digit characters for validation
	cleaned := regexp.MustCompile(`\D`).ReplaceAllString(phone, "")

	// Check if phone number has valid length (7-15 digits)
	if len(cleaned) < 7 || len(cleaned) > 15 {
		return fmt.Errorf("phone number must be between 7 and 15 digits")
	}

	// Check if phone number contains only valid characters (digits, spaces, hyphens, parentheses, plus)
	validPhonePattern := regexp.MustCompile(`^[\d\s\-\(\)\+]+$`)
	if !validPhonePattern.MatchString(phone) {
		return fmt.Errorf("phone number contains invalid characters")
	}

	return nil
}

func validateCompanyName(company string) error {
	if len(strings.TrimSpace(company)) < 2 {
		return fmt.Errorf("company name must be at least 2 characters long")
	}

	if len(company) > 100 {
		return fmt.Errorf("company name must be less than 100 characters long")
	}

	validCompanyPattern := regexp.MustCompile(`^[a-zA-Z0-9\s\-'\.&,()]+$`)
	if !validCompanyPattern.MatchString(company) {
		return fmt.Errorf("company name contains invalid characters")
	}

	invalidPatterns := []string{
		"test", "testing", "sample", "example", "demo", "dummy",
		"company", "corp", "inc", "llc", "ltd", "co",
	}

	companyLower := strings.ToLower(strings.TrimSpace(company))
	for _, pattern := range invalidPatterns {
		if companyLower == pattern {
			return fmt.Errorf("please provide a valid company name")
		}
	}

	return nil
}

// generateResetToken generates a secure random reset token
func generateResetToken() string {
	// Generate 32 random bytes
	bytes := make([]byte, 32)
	rand.Read(bytes)

	// Convert to hex string
	return fmt.Sprintf("%x", bytes)
}
