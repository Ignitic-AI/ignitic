// Package credential API endpoints for secret management.
//
// This package contains endpoints for managing secrets, including creation, retrieval,
// deletion, and listing for users and organizations.
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
	logger        *services.DatabaseLogger
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
		logger:        services.NewDatabaseLogger(db),
	}, nil
}

// PutSecret creates or updates a secret
// @Summary Create or update a secret
// @Description Stores a new secret or updates an existing one for the given application and name.
// @Tags secrets
// @Accept json
// @Produce json
// @Param app path string true "Application name"
// @Param name path string true "Secret name"
// @Param body body models.SecretRequest true "Secret data"
// @Success 200 {object} map[string]interface{} "Secret updated successfully"
// @Success 201 {object} map[string]interface{} "Secret created successfully"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Server error"
// @Router /secrets/{app}/{name} [put]
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
		s.logger.LogSecrets(c.Request.Context(), models.LogLevelError, "CREATE_FAILED",
			"Failed to create secret in database",
			services.WithUserID(userUUID),
			services.WithIPAddress(c.ClientIP()),
			services.WithMetadata(map[string]interface{}{
				"app":   app,
				"name":  name,
				"error": err.Error(),
			}))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create secret"})
		return
	}

	// Log successful secret creation
	s.logger.LogSecrets(c.Request.Context(), models.LogLevelInfo, "CREATE",
		"Secret created successfully",
		services.WithUserID(userUUID),
		services.WithOrganizationID(*req.OrganizationID),
		services.WithIPAddress(c.ClientIP()),
		services.WithMetadata(map[string]interface{}{
			"app":             app,
			"name":            name,
			"has_description": req.Description != "",
		}))

	c.JSON(http.StatusCreated, gin.H{
		"message": "Secret created successfully",
		"app":     app,
		"name":    name,
	})
}

// GetSecret retrieves and decrypts a secret
// @Summary Get a secret
// @Description Retrieves and decrypts the specified secret.
// @Tags secrets
// @Produce json
// @Param app path string true "Application name"
// @Param name path string true "Secret name"
// @Success 200 {object} map[string]interface{} "Decrypted secret"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 404 {object} map[string]string "Secret not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /secrets/{app}/{name} [get]
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
// @Summary Delete a secret
// @Description Deletes the specified secret by application and name.
// @Tags secrets
// @Produce json
// @Param app path string true "Application name"
// @Param name path string true "Secret name"
// @Success 200 {object} map[string]interface{} "Secret deleted successfully"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 404 {object} map[string]string "Secret not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /secrets/{app}/{name} [delete]
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
// @Summary List secrets for an app
// @Description Lists all secrets for the given app the user has access to, without returning their values.
// @Tags secrets
// @Produce json
// @Param app path string true "Application name"
// @Success 200 {object} map[string]interface{} "List of secrets"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Server error"
// @Router /secrets/{app} [get]
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

// ListSecretsWithValues lists all secrets for an app with decrypted values
// @Summary List secrets for an app with values
// @Description Lists all secrets for the given app the user has access to, returning decrypted values.
// @Tags secrets
// @Produce json
// @Param app path string true "Application name"
// @Success 200 {object} map[string]interface{} "List of secrets with values"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Server error"
// @Router /secrets/{app}/values [get]
func (s *CredentialService) ListSecretsWithValues(c *gin.Context) {
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

	// Get user's secrets and organization secrets they have access to for the app
	var secrets []models.Secret
	err = s.db.Where("app = ? AND (created_by = ? OR organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = ? AND (role = 'owner' OR role = 'admin')))",
		app, userUUID, userUUID).Find(&secrets).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch secrets"})
		return
	}

	// Response item with decrypted value
	type secretWithValue struct {
		App            string     `json:"app"`
		Name           string     `json:"name"`
		Value          string     `json:"value"`
		CreatedBy      uuid.UUID  `json:"created_by"`
		OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
		CreatedAt      time.Time  `json:"created_at"`
		UpdatedAt      time.Time  `json:"updated_at"`
	}

	var response []secretWithValue
	for _, secret := range secrets {
		appName := ""
		if secret.App != nil {
			appName = *secret.App
		}

		// Decrypt the secret value
		plaintext, decErr := s.encryptionSvc.Decrypt(app, secret.Name, secret.IV, secret.Ciphertext)
		if decErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to decrypt secret"})
			return
		}

		response = append(response, secretWithValue{
			App:            appName,
			Name:           secret.Name,
			Value:          plaintext,
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

// ListUserSecrets lists all secrets for a user
// @Summary List all user secrets
// @Description Lists all personal and organization secrets the user has access to.
// @Tags secrets
// @Produce json
// @Success 200 {object} map[string]interface{} "List of secrets"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Server error"
// @Router /secrets/user/all [get]
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

// ListOrganizationSecrets lists all secrets for an organization
// @Summary List organization secrets
// @Description Lists all secrets for the specified organization (admin/owner only).
// @Tags secrets
// @Produce json
// @Param orgId path string true "Organization ID"
// @Success 200 {object} map[string]interface{} "List of secrets"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Server error"
// @Router /secrets/organization/{orgId} [get]
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

// BulkUpsertSecrets creates or updates multiple secrets for an app
// @Summary Bulk create or update secrets for an app
// @Description Creates or updates multiple secrets for the given app. Each item supports optional organization scoping.
// @Tags secrets
// @Accept json
// @Produce json
// @Param app path string true "Application name"
// @Param body body object true "Bulk secrets payload"
// @Success 200 {object} map[string]interface{} "Bulk upsert result"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Server error"
// @Router /secrets/{app} [put]
func (s *CredentialService) BulkUpsertSecrets(c *gin.Context) {
	app := c.Param("app")

	// Get user ID from JWT context
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse userID to UUID for CreatedBy
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Request payload
	type bulkItem struct {
		Name           string     `json:"name" binding:"required"`
		Value          string     `json:"value" binding:"required"`
		Description    string     `json:"description"`
		OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
	}
	var payload struct {
		Secrets []bulkItem `json:"secrets" binding:"required,dive,required"`
	}

	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updated := make([]string, 0)
	created := make([]string, 0)

	for _, item := range payload.Secrets {
		// If organization_id is provided, verify access
		if item.OrganizationID != nil {
			if !s.userHasOrganizationAccess(userID, item.OrganizationID.String()) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to organization"})
				return
			}
		}

		// Encrypt value
		ciphertext, iv, encErr := s.encryptionSvc.Encrypt(app, item.Name, item.Value)
		if encErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt secret"})
			return
		}

		// Upsert by (app, name, organization_id)
		var existing models.Secret
		query := s.db.Where("app = ? AND name = ?", app, item.Name)
		if item.OrganizationID != nil {
			query = query.Where("organization_id = ?", *item.OrganizationID)
		} else {
			query = query.Where("organization_id IS NULL")
		}

		err = query.First(&existing).Error
		now := time.Now()
		if err == nil {
			existing.Ciphertext = ciphertext
			existing.IV = iv
			existing.Description = &item.Description
			existing.UpdatedAt = now
			if saveErr := s.db.Save(&existing).Error; saveErr != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update secret"})
				return
			}
			updated = append(updated, item.Name)
			continue
		}

		// Create new secret
		sec := models.Secret{
			App:            &app,
			Name:           item.Name,
			Description:    &item.Description,
			Ciphertext:     ciphertext,
			IV:             iv,
			Algo:           "AES-256-GCM",
			CreatedBy:      userUUID,
			OrganizationID: item.OrganizationID,
			CreatedAt:      now,
			UpdatedAt:      now,
		}
		if createErr := s.db.Create(&sec).Error; createErr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create secret"})
			return
		}
		created = append(created, item.Name)
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Bulk upsert completed",
		"created": created,
		"updated": updated,
		"count":   len(created) + len(updated),
	})
}

// BulkDeleteAppSecrets deletes all secrets for an app that the user can manage
// @Summary Bulk delete all secrets for an app
// @Description Deletes all secrets for the given app that belong to the user or to organizations where the user is owner/admin.
// @Tags secrets
// @Produce json
// @Param app path string true "Application name"
// @Success 200 {object} map[string]interface{} "Bulk delete result"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Server error"
// @Router /secrets/{app} [delete]
func (s *CredentialService) BulkDeleteAppSecrets(c *gin.Context) {
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

	// First, select IDs to be deleted (only those user can manage)
	var secrets []models.Secret
	if err := s.db.Where("app = ? AND (created_by = ? OR organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = ? AND (role = 'owner' OR role = 'admin')))",
		app, userUUID, userUUID).Find(&secrets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch secrets for deletion"})
		return
	}

	if len(secrets) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "No secrets to delete", "deleted": 0})
		return
	}

	// Delete in bulk by IDs
	ids := make([]uuid.UUID, 0, len(secrets))
	for _, sct := range secrets {
		ids = append(ids, sct.ID)
	}

	if err := s.db.Where("id IN ?", ids).Delete(&models.Secret{}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete secrets"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Deleted app secrets",
		"deleted": len(ids),
	})
}
