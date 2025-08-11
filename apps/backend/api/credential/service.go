package credential

import (
	"net/http"
	"time"

	"backend/database"
	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CredentialService struct {
	db            *database.DB
	encryptionSvc *services.EncryptionService
}

// userHasOrganizationAccess checks if user has access to organization
func (s *CredentialService) userHasOrganizationAccess(userID string, orgID string) bool {
	var count int64
	err := s.db.Table("user_organizations").
		Where("organization_id = ? AND user_id = ? AND (role = 'owner' OR role = 'admin')", orgID, userID).
		Count(&count).Error

	return err == nil && count > 0
}

// canAccessSecret checks if user can access a specific secret
func (s *CredentialService) canAccessSecret(userID string, secret *models.Secret) bool {
	// Parse userID to UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return false
	}

	// User can always access their own secrets
	if secret.CreatedBy == userUUID {
		return true
	}

	// If secret belongs to organization, check if user has admin/owner access
	if secret.OrganizationID != nil {
		return s.userHasOrganizationAccess(userID, secret.OrganizationID.String())
	}

	// Personal secrets can only be accessed by creator
	return false
}

// NewCredentialService creates a new credential service instance
func NewCredentialService(db *database.DB) (*CredentialService, error) {
	encryptionSvc, err := services.NewEncryptionService()
	if err != nil {
		return nil, err
	}

	return &CredentialService{
		db:            db,
		encryptionSvc: encryptionSvc,
	}, nil
}

// PutSecret creates or updates a secret
// PUT /secrets/{app}/{name}
func (s *CredentialService) PutSecret(c *gin.Context) {
	app := c.Param("app")
	name := c.Param("name")

	// Get user ID from JWT context
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var req models.SecretRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// If organization_id is provided, verify user has access to it
	if req.OrganizationID != nil {
		if !s.userHasOrganizationAccess(userID, req.OrganizationID.String()) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to organization"})
			return
		}
	}

	// Encrypt the secret value
	ciphertext, iv, err := s.encryptionSvc.Encrypt(app, name, req.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt secret"})
		return
	}

	// Check if secret already exists (considering organization)
	var existingSecret models.Secret
	query := s.db.Where("app = ? AND name = ?", app, name)
	if req.OrganizationID != nil {
		query = query.Where("organization_id = ?", *req.OrganizationID)
	} else {
		query = query.Where("organization_id IS NULL")
	}
	err = query.First(&existingSecret).Error

	if err == nil {
		// Update existing secret
		existingSecret.Ciphertext = ciphertext
		existingSecret.IV = iv
		existingSecret.Description = &req.Description
		existingSecret.UpdatedAt = time.Now()

		if err := s.db.Save(&existingSecret).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update secret"})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"message": "Secret updated successfully",
			"app":     app,
			"name":    name,
		})
		return
	}

	// Parse userID to UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Create new secret
	secret := models.Secret{
		App:            &app,
		Name:           name,
		Description:    &req.Description,
		Ciphertext:     ciphertext,
		IV:             iv,
		Algo:           "AES-256-GCM",
		CreatedBy:      userUUID,
		OrganizationID: req.OrganizationID,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := s.db.Create(&secret).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create secret"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Secret created successfully",
		"app":     app,
		"name":    name,
	})
}

// GetSecret retrieves and decrypts a secret
// GET /secrets/{app}/{name}
func (s *CredentialService) GetSecret(c *gin.Context) {
	app := c.Param("app")
	name := c.Param("name")

	// Get user ID from JWT context
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var secret models.Secret
	err := s.db.Where("app = ? AND name = ?", app, name).First(&secret).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Secret not found"})
		return
	}

	// Check access control
	if !s.canAccessSecret(userID, &secret) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to secret"})
		return
	}

	// Decrypt the secret value
	plaintext, err := s.encryptionSvc.Decrypt(app, name, secret.IV, secret.Ciphertext)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt secret"})
		return
	}

	// Update last accessed time
	secret.UpdatedAt = time.Now()
	s.db.Save(&secret)

	// Return the decrypted value
	c.JSON(http.StatusOK, gin.H{
		"app":             app,
		"name":            name,
		"value":           plaintext,
		"algo":            secret.Algo,
		"created_by":      secret.CreatedBy,
		"organization_id": secret.OrganizationID,
		"created_at":      secret.CreatedAt,
		"updated_at":      secret.UpdatedAt,
	})
}

// DeleteSecret deletes a secret
// DELETE /secrets/{app}/{name}
func (s *CredentialService) DeleteSecret(c *gin.Context) {
	app := c.Param("app")
	name := c.Param("name")

	// Get user ID from JWT context
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if secret exists
	var secret models.Secret
	err := s.db.Where("app = ? AND name = ?", app, name).First(&secret).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Secret not found"})
		return
	}

	// Delete the secret
	if err := s.db.Delete(&secret).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete secret"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Secret deleted successfully",
		"app":     app,
		"name":    name,
	})
}

// ListSecrets lists all secrets for an app (without decryption)
// GET /secrets/{app}
func (s *CredentialService) ListSecrets(c *gin.Context) {
	app := c.Param("app")

	// Get user ID from JWT context
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse userID to UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Get user's secrets and organization secrets they have access to
	var secrets []models.Secret
	err = s.db.Where("app = ? AND (created_by = ? OR organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = ? AND (role = 'owner' OR role = 'admin')))",
		app, userUUID, userUUID).Find(&secrets).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch secrets"})
		return
	}

	// Convert to response format (without sensitive data)
	var response []models.SecretResponse
	for _, secret := range secrets {
		description := ""
		if secret.Description != nil {
			description = *secret.Description
		}

		appName := ""
		if secret.App != nil {
			appName = *secret.App
		}

		response = append(response, models.SecretResponse{
			App:            appName,
			Name:           secret.Name,
			Description:    description,
			CreatedBy:      secret.CreatedBy,
			OrganizationID: secret.OrganizationID,
			CreatedAt:      secret.CreatedAt,
			UpdatedAt:      secret.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"secrets": response,
		"count":   len(response),
	})
}

// ListUserSecrets lists all secrets for a user (personal + organization secrets they have access to)
// GET /secrets/user/all
func (s *CredentialService) ListUserSecrets(c *gin.Context) {
	// Get user ID from JWT context
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse userID to UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Get user's personal secrets and organization secrets they have access to
	var secrets []models.Secret
	err = s.db.Where("created_by = ? OR organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = ? AND (role = 'owner' OR role = 'admin'))",
		userUUID, userUUID).Find(&secrets).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch secrets"})
		return
	}

	// Convert to response format (without sensitive data)
	var response []models.SecretResponse
	for _, secret := range secrets {
		description := ""
		if secret.Description != nil {
			description = *secret.Description
		}

		appName := ""
		if secret.App != nil {
			appName = *secret.App
		}

		response = append(response, models.SecretResponse{
			App:            appName,
			Name:           secret.Name,
			Description:    description,
			CreatedBy:      secret.CreatedBy,
			OrganizationID: secret.OrganizationID,
			CreatedAt:      secret.CreatedAt,
			UpdatedAt:      secret.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"secrets": response,
		"count":   len(response),
	})
}

// ListOrganizationSecrets lists all secrets for an organization (only for admin/owner)
// GET /secrets/organization/{orgId}
func (s *CredentialService) ListOrganizationSecrets(c *gin.Context) {
	orgIDStr := c.Param("orgId")

	// Get user ID from JWT context
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse organization ID to UUID
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID format"})
		return
	}

	// Check if user has access to organization
	if !s.userHasOrganizationAccess(userID, orgID.String()) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to organization"})
		return
	}

	// Get all secrets for the organization
	var secrets []models.Secret
	err = s.db.Where("organization_id = ?", orgID).Find(&secrets).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch organization secrets"})
		return
	}

	// Convert to response format (without sensitive data)
	var response []models.SecretResponse
	for _, secret := range secrets {
		description := ""
		if secret.Description != nil {
			description = *secret.Description
		}

		appName := ""
		if secret.App != nil {
			appName = *secret.App
		}

		response = append(response, models.SecretResponse{
			App:            appName,
			Name:           secret.Name,
			Description:    description,
			CreatedBy:      secret.CreatedBy,
			OrganizationID: secret.OrganizationID,
			CreatedAt:      secret.CreatedAt,
			UpdatedAt:      secret.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"secrets": response,
		"count":   len(response),
	})
}
