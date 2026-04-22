// Package credential API endpoints for secret management.
//
// This package contains endpoints for managing secrets, including creation, retrieval,
// deletion, and listing for users and organizations.
package credential

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strings"
	"time"

	"backend/database"
	"backend/models"
	"backend/services"
	"backend/services/policy"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type CredentialService struct {
	db            *database.DB
	encryptionSvc *services.EncryptionService
	logger        *services.DatabaseLogger
	policySvc     *policy.Service
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
		policySvc:     policy.NewService(db),
	}, nil
}

func (s *CredentialService) countSecretsForScope(userID uuid.UUID, orgID *uuid.UUID) int64 {
	var count int64
	query := s.db.Model(&models.Secret{})
	if orgID != nil {
		query = query.Where("organization_id = ?", *orgID)
	} else {
		query = query.Where("created_by = ? AND organization_id IS NULL", userID)
	}
	_ = query.Count(&count).Error
	return count
}

func (s *CredentialService) authorizeSecretPolicy(c *gin.Context, actionKey string, orgID *uuid.UUID, meta map[string]interface{}, role policy.EndpointRole) bool {
	if s.policySvc == nil {
		return true
	}
	userID := c.GetString("user_id")
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return false
	}
	_, err = s.policySvc.AuthorizeAndMaybeConsume(policy.AuthorizeInput{
		UserID:          userUUID,
		OrganizationID:  orgID,
		ActionKey:       actionKey,
		RequireBillable: false,
		EndpointRole:    role,
		RequestMeta:     meta,
	})
	if err == nil {
		return true
	}
	switch err {
	case policy.ErrFeatureNotAllowed, policy.ErrRBACDenied, policy.ErrOrgMembershipRequired:
		c.JSON(http.StatusForbidden, gin.H{"error": err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, gin.H{"error": "policy check failed"})
	}
	return false
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

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}
	if !s.authorizeSecretPolicy(c, "secrets.write", req.OrganizationID, map[string]interface{}{
		"secret_count": s.countSecretsForScope(userUUID, req.OrganizationID),
	}, policy.EndpointRoleRun) {
		return
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
		query = query.Where("organization_id IS NULL AND created_by = ?", userUUID)
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
	logOpts := []services.LogOption{
		services.WithUserID(userUUID),
		services.WithIPAddress(c.ClientIP()),
		services.WithMetadata(map[string]interface{}{
			"app":             app,
			"name":            name,
			"has_description": req.Description != "",
		}),
	}
	if req.OrganizationID != nil {
		logOpts = append(logOpts, services.WithOrganizationID(*req.OrganizationID))
	}
	s.logger.LogSecrets(c.Request.Context(), models.LogLevelInfo, "CREATE",
		"Secret created successfully",
		logOpts...)

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

	userUUID, errUUID := uuid.Parse(userID)
	if errUUID != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var secret models.Secret
	err := s.db.Where("app = ? AND name = ? AND (created_by = ? OR organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = ? AND (role = 'owner' OR role = 'admin')))", app, name, userUUID, userUUID).First(&secret).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Secret not found"})
		return
	}

	// Check access control
	if !s.canAccessSecret(userID, &secret) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to secret"})
		return
	}
	if !s.authorizeSecretPolicy(c, "secrets.read", secret.OrganizationID, nil, policy.EndpointRoleView) {
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

	s.logger.LogSecrets(c.Request.Context(), models.LogLevelInfo, "READ",
		"Secret accessed: "+app+"/"+name,
		services.WithUserID(userUUID),
	)

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

	userUUID, errUUID := uuid.Parse(userID)
	if errUUID != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Check if secret exists
	var secret models.Secret
	err := s.db.Where("app = ? AND name = ? AND (created_by = ? OR organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = ? AND (role = 'owner' OR role = 'admin')))", app, name, userUUID, userUUID).First(&secret).Error
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Secret not found"})
		return
	}
	if !s.canAccessSecret(userID, &secret) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to secret"})
		return
	}
	if !s.authorizeSecretPolicy(c, "secrets.delete", secret.OrganizationID, nil, policy.EndpointRoleAdmin) {
		return
	}

	// Delete the secret
	if err := s.db.Delete(&secret).Error; err != nil {
		s.logger.LogSecrets(c.Request.Context(), models.LogLevelError, "DELETE_FAILED",
			"Failed to delete secret: "+app+"/"+name,
			services.WithUserID(userUUID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete secret"})
		return
	}

	s.logger.LogSecrets(c.Request.Context(), models.LogLevelInfo, "DELETE",
		"Secret deleted: "+app+"/"+name,
		services.WithUserID(userUUID),
	)

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
	if !s.authorizeSecretPolicy(c, "secrets.read", nil, map[string]interface{}{"app": app}, policy.EndpointRoleView) {
		return
	}

	// Get user's secrets and organization secrets they have access to
	var secrets []models.Secret
	err = s.db.Where("app = ? AND (created_by = ? OR organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = ? AND (role = 'owner' OR role = 'admin')))",
		app, userUUID, userUUID).Find(&secrets).Error
	if err != nil {
		s.logger.LogSecrets(c.Request.Context(), models.LogLevelError, "LIST_FAILED",
			"Failed to list secrets for app: "+app,
			services.WithUserID(userUUID),
		)
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
	if !s.authorizeSecretPolicy(c, "secrets.read", nil, map[string]interface{}{"app": app}, policy.EndpointRoleView) {
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
			s.logger.LogSecrets(c.Request.Context(), models.LogLevelError, "DECRYPT_FAILED",
				"Failed to decrypt secret: "+app+"/"+secret.Name,
				services.WithUserID(userUUID),
			)
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

	s.logger.LogSecrets(c.Request.Context(), models.LogLevelInfo, "LIST_WITH_VALUES",
		"Secrets with values accessed for app: "+app,
		services.WithUserID(userUUID),
	)

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
	if !s.authorizeSecretPolicy(c, "secrets.read", nil, nil, policy.EndpointRoleView) {
		return
	}

	// Get user's personal secrets and organization secrets they have access to
	var secrets []models.Secret
	err = s.db.Where("created_by = ? OR organization_id IN (SELECT organization_id FROM user_organizations WHERE user_id = ? AND (role = 'owner' OR role = 'admin'))",
		userUUID, userUUID).Find(&secrets).Error
	if err != nil {
		s.logger.LogSecrets(c.Request.Context(), models.LogLevelError, "LIST_USER_FAILED",
			"Failed to list user secrets",
			services.WithUserID(userUUID),
		)
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
	if !s.authorizeSecretPolicy(c, "secrets.read", &orgID, nil, policy.EndpointRoleView) {
		return
	}

	// Get all secrets for the organization
	var secrets []models.Secret
	err = s.db.Where("organization_id = ?", orgID).Find(&secrets).Error
	if err != nil {
		s.logger.LogSecrets(c.Request.Context(), models.LogLevelError, "LIST_ORG_FAILED",
			"Failed to list organization secrets",
			services.WithOrganizationID(orgID),
		)
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
		if !s.authorizeSecretPolicy(c, "secrets.write", item.OrganizationID, map[string]interface{}{
			"secret_count": s.countSecretsForScope(userUUID, item.OrganizationID),
		}, policy.EndpointRoleRun) {
			return
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
			query = query.Where("organization_id IS NULL AND created_by = ?", userUUID)
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

	s.logger.LogSecrets(c.Request.Context(), models.LogLevelInfo, "BULK_UPSERT",
		"Bulk upsert completed for app: "+app,
		services.WithUserID(userUUID),
		services.WithMetadata(map[string]interface{}{
			"created": len(created),
			"updated": len(updated),
		}),
	)

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
	if !s.authorizeSecretPolicy(c, "secrets.delete", nil, map[string]interface{}{"app": app}, policy.EndpointRoleAdmin) {
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
		s.logger.LogSecrets(c.Request.Context(), models.LogLevelError, "BULK_DELETE_FAILED",
			"Failed to bulk delete secrets for app: "+app,
			services.WithUserID(userUUID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete secrets"})
		return
	}

	s.logger.LogSecrets(c.Request.Context(), models.LogLevelInfo, "BULK_DELETE",
		"Bulk delete completed for app: "+app,
		services.WithUserID(userUUID),
		services.WithMetadata(map[string]interface{}{"deleted": len(ids)}),
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Deleted app secrets",
		"deleted": len(ids),
	})
}

type shopifyOAuthState struct {
	UserID         string `json:"user_id"`
	OrganizationID string `json:"organization_id,omitempty"`
	Shop           string `json:"shop"`
	ReturnURL      string `json:"return_url,omitempty"`
	ExpiresAt      int64  `json:"expires_at"`
	Nonce          string `json:"nonce"`
}

// ShopifyAuthorize builds a Shopify OAuth authorization URL for the authenticated user.
func (s *CredentialService) ShopifyAuthorize(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	shop := normalizeShopifyShop(c.Query("shop"))
	if shop == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or missing shop parameter"})
		return
	}

	redirectURI := c.Query("redirect_uri")
	if redirectURI == "" {
		redirectURI = os.Getenv("SHOPIFY_OAUTH_REDIRECT_URI")
	}
	if redirectURI == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing redirect_uri (query or SHOPIFY_OAUTH_REDIRECT_URI env)"})
		return
	}

	clientID := os.Getenv("SHOPIFY_CLIENT_ID")
	if clientID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "SHOPIFY_CLIENT_ID is not configured"})
		return
	}

	scopes := c.Query("scopes")
	if scopes == "" {
		scopes = os.Getenv("SHOPIFY_SCOPES")
	}
	if scopes == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing scopes (query or SHOPIFY_SCOPES env)"})
		return
	}

	var orgID *uuid.UUID
	if orgIDStr := c.Query("organization_id"); orgIDStr != "" {
		parsedOrgID, err := uuid.Parse(orgIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization_id"})
			return
		}
		if !s.userHasOrganizationAccess(userID, parsedOrgID.String()) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to organization"})
			return
		}
		orgID = &parsedOrgID
	}
	if !s.authorizeSecretPolicy(c, "secrets.write", orgID, map[string]interface{}{
		"secret_count": s.countSecretsForScope(userUUID, orgID),
	}, policy.EndpointRoleRun) {
		return
	}

	returnURL := strings.TrimSpace(c.Query("return_url"))
	if returnURL != "" {
		if _, err := url.ParseRequestURI(returnURL); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid return_url"})
			return
		}
	}

	state, err := s.buildShopifyState(userID, orgID, shop, returnURL)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to generate OAuth state"})
		return
	}

	params := url.Values{}
	params.Set("client_id", clientID)
	params.Set("scope", scopes)
	params.Set("redirect_uri", redirectURI)
	params.Set("state", state)

	authURL := fmt.Sprintf("https://%s/admin/oauth/authorize?%s", shop, params.Encode())

	s.logger.LogSecrets(c.Request.Context(), models.LogLevelInfo, "SHOPIFY_OAUTH_INITIATED",
		"Shopify OAuth flow initiated for shop: "+shop,
		services.WithUserID(userUUID),
	)

	c.JSON(http.StatusOK, gin.H{
		"authorization_url": authURL,
		"shop":              shop,
		"state":             state,
	})
}

// ShopifyCallback exchanges the OAuth code for an access token and stores it as encrypted secrets.
func (s *CredentialService) ShopifyCallback(c *gin.Context) {
	shop := normalizeShopifyShop(c.Query("shop"))
	code := c.Query("code")
	stateRaw := c.Query("state")
	hmacHex := c.Query("hmac")

	if shop == "" || code == "" || stateRaw == "" || hmacHex == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing required query params: shop, code, state, hmac"})
		return
	}

	if !verifyShopifyCallbackHMAC(c.Request.URL.Query(), os.Getenv("SHOPIFY_CLIENT_SECRET")) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid Shopify callback signature"})
		return
	}

	state, err := s.parseShopifyState(stateRaw)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired OAuth state"})
		return
	}

	if state.Shop != shop {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Shop mismatch in OAuth state"})
		return
	}

	userUUID, err := uuid.Parse(state.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user in OAuth state"})
		return
	}

	var orgID *uuid.UUID
	if state.OrganizationID != "" {
		parsedOrgID, err := uuid.Parse(state.OrganizationID)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization in OAuth state"})
			return
		}
		if !s.userHasOrganizationAccess(state.UserID, parsedOrgID.String()) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to organization"})
			return
		}
		orgID = &parsedOrgID
	}

	tokenResp, err := exchangeShopifyToken(c, shop, code)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": err.Error()})
		return
	}

	// Build oauthTokenData JSON in n8n format
	tokenData := map[string]interface{}{
		"access_token": tokenResp.AccessToken,
		"scope":        tokenResp.Scope,
		"token_type":   "bearer",
	}
	tokenDataJSON, err := json.Marshal(tokenData)
	if err != nil {
		s.shopifyCallbackError(c, state.ReturnURL, shop, "Failed to serialize token data", http.StatusInternalServerError)
		return
	}

	shopSubdomain := strings.TrimSuffix(shop, ".myshopify.com")
	const shopifyApp = "shopifyOAuth2Api"

	if err := s.upsertOAuthSecret(shopifyApp, "clientId", os.Getenv("SHOPIFY_CLIENT_ID"), "Shopify OAuth client ID", userUUID, orgID); err != nil {
		s.shopifyCallbackError(c, state.ReturnURL, shop, "Failed to store Shopify client ID", http.StatusInternalServerError)
		return
	}
	if err := s.upsertOAuthSecret(shopifyApp, "clientSecret", os.Getenv("SHOPIFY_CLIENT_SECRET"), "Shopify OAuth client secret", userUUID, orgID); err != nil {
		s.shopifyCallbackError(c, state.ReturnURL, shop, "Failed to store Shopify client secret", http.StatusInternalServerError)
		return
	}
	if err := s.upsertOAuthSecret(shopifyApp, "shopSubdomain", shopSubdomain, "Shopify shop subdomain", userUUID, orgID); err != nil {
		s.shopifyCallbackError(c, state.ReturnURL, shop, "Failed to store Shopify shop subdomain", http.StatusInternalServerError)
		return
	}
	if err := s.upsertOAuthSecret(shopifyApp, "oauthTokenData", string(tokenDataJSON), "Shopify OAuth token data", userUUID, orgID); err != nil {
		s.shopifyCallbackError(c, state.ReturnURL, shop, "Failed to store Shopify OAuth token data", http.StatusInternalServerError)
		return
	}
	if err := s.upsertOAuthSecret(shopifyApp, "sendAdditionalBodyProperties", "false", "Send additional body properties", userUUID, orgID); err != nil {
		s.shopifyCallbackError(c, state.ReturnURL, shop, "Failed to store Shopify sendAdditionalBodyProperties", http.StatusInternalServerError)
		return
	}
	if err := s.upsertOAuthSecret(shopifyApp, "additionalBodyProperties", "{}", "Additional body properties", userUUID, orgID); err != nil {
		s.shopifyCallbackError(c, state.ReturnURL, shop, "Failed to store Shopify additionalBodyProperties", http.StatusInternalServerError)
		return
	}

	s.logger.LogSecrets(context.Background(), models.LogLevelInfo, "SHOPIFY_OAUTH_CONNECTED",
		"Shopify OAuth connected for shop: "+shop,
		services.WithUserID(userUUID),
		services.WithMetadata(map[string]interface{}{"shop": shop, "scope": tokenResp.Scope}),
	)

	if s.shopifyCallbackRedirect(c, state.ReturnURL, shop, tokenResp.Scope, orgID) {
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":         "Shopify OAuth connected successfully",
		"shop":            shop,
		"scope":           tokenResp.Scope,
		"associated_user": state.UserID,
		"organization_id": orgID,
		"stored_secrets": []string{
			"clientId",
			"clientSecret",
			"shopSubdomain",
			"oauthTokenData",
			"sendAdditionalBodyProperties",
			"additionalBodyProperties",
		},
	})
}

// ShopifyStatus returns whether a shop is connected for the current user/org scope.
func (s *CredentialService) ShopifyStatus(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	shop := normalizeShopifyShop(c.Query("shop"))
	if shop == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or missing shop parameter"})
		return
	}
	orgID, ok := s.getOptionalShopifyOrgScope(c, userID)
	if !ok {
		return
	}
	if !s.authorizeSecretPolicy(c, "secrets.read", orgID, nil, policy.EndpointRoleView) {
		return
	}

	const shopifyApp = "shopifyOAuth2Api"
	tokenSecret, err := s.findScopedSecret(shopifyApp, "oauthTokenData", userUUID, orgID)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"connected":       false,
			"shop":            shop,
			"organization_id": orgID,
		})
		return
	}

	scopeValue := ""
	if appName := derefString(tokenSecret.App); appName != "" {
		if tokenJSON, decErr := s.encryptionSvc.Decrypt(appName, tokenSecret.Name, tokenSecret.IV, tokenSecret.Ciphertext); decErr == nil {
			var tokenData map[string]interface{}
			if jsonErr := json.Unmarshal([]byte(tokenJSON), &tokenData); jsonErr == nil {
				if s, ok := tokenData["scope"].(string); ok {
					scopeValue = s
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"connected":       true,
		"shop":            shop,
		"organization_id": orgID,
		"scope":           scopeValue,
		"updated_at":      tokenSecret.UpdatedAt,
	})
}

// ShopifyDisconnect deletes stored Shopify OAuth secrets for a given shop.
func (s *CredentialService) ShopifyDisconnect(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	shop := normalizeShopifyShop(c.Query("shop"))
	if shop == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid or missing shop parameter"})
		return
	}
	orgID, ok := s.getOptionalShopifyOrgScope(c, userID)
	if !ok {
		return
	}
	if !s.authorizeSecretPolicy(c, "secrets.delete", orgID, nil, policy.EndpointRoleAdmin) {
		return
	}

	const shopifyApp = "shopifyOAuth2Api"
	names := []string{
		"clientId",
		"clientSecret",
		"shopSubdomain",
		"oauthTokenData",
		"sendAdditionalBodyProperties",
		"additionalBodyProperties",
	}

	q := s.db.Where("app = ? AND name IN ?", shopifyApp, names)
	if orgID != nil {
		q = q.Where("organization_id = ?", *orgID)
	} else {
		q = q.Where("organization_id IS NULL AND created_by = ?", userUUID)
	}

	res := q.Delete(&models.Secret{})
	if res.Error != nil {
		s.logger.LogSecrets(c.Request.Context(), models.LogLevelError, "SHOPIFY_DISCONNECT_FAILED",
			"Failed to disconnect Shopify for shop: "+shop,
			services.WithUserID(userUUID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to disconnect Shopify"})
		return
	}

	s.logger.LogSecrets(c.Request.Context(), models.LogLevelInfo, "SHOPIFY_DISCONNECTED",
		"Shopify disconnected for shop: "+shop,
		services.WithUserID(userUUID),
		services.WithMetadata(map[string]interface{}{"shop": shop, "deleted": res.RowsAffected}),
	)

	c.JSON(http.StatusOK, gin.H{
		"message":         "Shopify disconnected",
		"shop":            shop,
		"organization_id": orgID,
		"deleted":         res.RowsAffected,
	})
}

func (s *CredentialService) upsertOAuthSecret(app, name, value, description string, userID uuid.UUID, orgID *uuid.UUID) error {
	ciphertext, iv, err := s.encryptionSvc.Encrypt(app, name, value)
	if err != nil {
		return err
	}

	var existing models.Secret
	query := s.db.Where("app = ? AND name = ?", app, name)
	if orgID != nil {
		query = query.Where("organization_id = ?", *orgID)
	} else {
		query = query.Where("organization_id IS NULL AND created_by = ?", userID)
	}

	now := time.Now()
	if err := query.First(&existing).Error; err == nil {
		existing.Ciphertext = ciphertext
		existing.IV = iv
		existing.Description = &description
		existing.UpdatedAt = now
		return s.db.Save(&existing).Error
	}

	secret := models.Secret{
		App:            &app,
		Name:           name,
		Description:    &description,
		Ciphertext:     ciphertext,
		IV:             iv,
		Algo:           "AES-256-GCM",
		CreatedBy:      userID,
		OrganizationID: orgID,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	return s.db.Create(&secret).Error
}

func (s *CredentialService) buildShopifyState(userID string, orgID *uuid.UUID, shop, returnURL string) (string, error) {
	state := shopifyOAuthState{
		UserID:    userID,
		Shop:      shop,
		ReturnURL: returnURL,
		ExpiresAt: time.Now().Add(10 * time.Minute).Unix(),
		Nonce:     uuid.NewString(),
	}
	if orgID != nil {
		state.OrganizationID = orgID.String()
	}

	payload, err := json.Marshal(state)
	if err != nil {
		return "", err
	}
	sig := signShopifyState(payload)
	return base64.RawURLEncoding.EncodeToString(payload) + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

func (s *CredentialService) parseShopifyState(raw string) (*shopifyOAuthState, error) {
	parts := strings.Split(raw, ".")
	if len(parts) != 2 {
		return nil, fmt.Errorf("invalid state format")
	}

	payload, err := base64.RawURLEncoding.DecodeString(parts[0])
	if err != nil {
		return nil, err
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, err
	}
	if !hmac.Equal(sig, signShopifyState(payload)) {
		return nil, fmt.Errorf("invalid state signature")
	}

	var state shopifyOAuthState
	if err := json.Unmarshal(payload, &state); err != nil {
		return nil, err
	}
	if state.ExpiresAt < time.Now().Unix() {
		return nil, fmt.Errorf("expired state")
	}
	return &state, nil
}

func (s *CredentialService) shopifyCallbackRedirect(c *gin.Context, returnURL, shop, scope string, orgID *uuid.UUID) bool {
	target := strings.TrimSpace(returnURL)
	if target == "" {
		target = strings.TrimSpace(os.Getenv("SHOPIFY_OAUTH_FRONTEND_SUCCESS_URL"))
	}
	if target == "" {
		return false
	}
	u, err := url.Parse(target)
	if err != nil {
		return false
	}
	q := u.Query()
	q.Set("status", "success")
	q.Set("provider", "shopify")
	q.Set("shop", shop)
	if scope != "" {
		q.Set("scope", scope)
	}
	if orgID != nil {
		q.Set("organization_id", orgID.String())
	}
	u.RawQuery = q.Encode()
	c.Redirect(http.StatusFound, u.String())
	return true
}

func (s *CredentialService) shopifyCallbackError(c *gin.Context, returnURL, shop, msg string, code int) {
	target := strings.TrimSpace(returnURL)
	if target == "" {
		target = strings.TrimSpace(os.Getenv("SHOPIFY_OAUTH_FRONTEND_ERROR_URL"))
	}
	if target != "" {
		if u, err := url.Parse(target); err == nil {
			q := u.Query()
			q.Set("status", "error")
			q.Set("provider", "shopify")
			if shop != "" {
				q.Set("shop", shop)
			}
			q.Set("message", msg)
			u.RawQuery = q.Encode()
			c.Redirect(http.StatusFound, u.String())
			return
		}
	}
	c.JSON(code, gin.H{"error": msg})
}

func signShopifyState(payload []byte) []byte {
	secret := os.Getenv("SHOPIFY_OAUTH_STATE_SECRET")
	if secret == "" {
		secret = os.Getenv("JWT_SECRET")
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(payload)
	return mac.Sum(nil)
}

func normalizeShopifyShop(shop string) string {
	shop = strings.ToLower(strings.TrimSpace(shop))
	shop = strings.TrimPrefix(shop, "https://")
	shop = strings.TrimPrefix(shop, "http://")
	shop = strings.TrimSuffix(shop, "/")
	if shop == "" || strings.Contains(shop, "/") {
		return ""
	}
	if !strings.HasSuffix(shop, ".myshopify.com") {
		return ""
	}
	return shop
}

func sanitizeShopifyShopKey(shop string) string {
	return strings.NewReplacer(".", "_", "-", "_").Replace(shop)
}

func (s *CredentialService) getOptionalShopifyOrgScope(c *gin.Context, userID string) (*uuid.UUID, bool) {
	orgIDStr := strings.TrimSpace(c.Query("organization_id"))
	if orgIDStr == "" {
		return nil, true
	}
	orgID, err := uuid.Parse(orgIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization_id"})
		return nil, false
	}
	if !s.userHasOrganizationAccess(userID, orgID.String()) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied to organization"})
		return nil, false
	}
	return &orgID, true
}

func (s *CredentialService) findScopedSecret(app, name string, userUUID uuid.UUID, orgID *uuid.UUID) (*models.Secret, error) {
	var secret models.Secret
	q := s.db.Where("app = ? AND name = ?", app, name)
	if orgID != nil {
		q = q.Where("organization_id = ?", *orgID)
	} else {
		q = q.Where("organization_id IS NULL AND created_by = ?", userUUID)
	}
	if err := q.First(&secret).Error; err != nil {
		return nil, err
	}
	return &secret, nil
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// SaveGoogleOAuthCredentials stores Google OAuth token data and additional properties as secrets.
// Used by the Google OAuth callback (redirect flow) to persist tokens server-side.
func (s *CredentialService) SaveGoogleOAuthCredentials(app string, oauthTokenDataJSON, additionalPropsJSON string, userID uuid.UUID, orgID *uuid.UUID) error {
	desc := "Google OAuth token data"
	if err := s.upsertOAuthSecret(app, "oauthTokenData", oauthTokenDataJSON, desc, userID, orgID); err != nil {
		return err
	}
	if additionalPropsJSON != "" {
		if err := s.upsertOAuthSecret(app, "additionalBodyProperties", additionalPropsJSON, "Google OAuth additional properties", userID, orgID); err != nil {
			return err
		}
		if err := s.upsertOAuthSecret(app, "sendAdditionalBodyProperties", "true", "Send additional body properties", userID, orgID); err != nil {
			return err
		}
	}
	return nil
}

func verifyShopifyCallbackHMAC(query url.Values, clientSecret string) bool {
	if clientSecret == "" {
		return false
	}
	got := query.Get("hmac")
	if got == "" {
		return false
	}

	keys := make([]string, 0, len(query))
	for k := range query {
		if k == "hmac" || k == "signature" {
			continue
		}
		keys = append(keys, k)
	}
	sort.Strings(keys)

	parts := make([]string, 0, len(keys))
	for _, k := range keys {
		vals := append([]string(nil), query[k]...)
		sort.Strings(vals)
		for _, v := range vals {
			parts = append(parts, k+"="+v)
		}
	}

	mac := hmac.New(sha256.New, []byte(clientSecret))
	mac.Write([]byte(strings.Join(parts, "&")))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(strings.ToLower(expected)), []byte(strings.ToLower(got)))
}

type shopifyTokenExchangeResponse struct {
	AccessToken string `json:"access_token"`
	Scope       string `json:"scope"`
}

func exchangeShopifyToken(c *gin.Context, shop, code string) (*shopifyTokenExchangeResponse, error) {
	clientID := os.Getenv("SHOPIFY_CLIENT_ID")
	clientSecret := os.Getenv("SHOPIFY_CLIENT_SECRET")
	if clientID == "" || clientSecret == "" {
		return nil, fmt.Errorf("SHOPIFY_CLIENT_ID/SHOPIFY_CLIENT_SECRET are not configured")
	}

	body, _ := json.Marshal(map[string]string{
		"client_id":     clientID,
		"client_secret": clientSecret,
		"code":          code,
	})

	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodPost, fmt.Sprintf("https://%s/admin/oauth/access_token", shop), strings.NewReader(string(body)))
	if err != nil {
		return nil, fmt.Errorf("failed to create token request")
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("shopify token exchange failed")
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 32*1024))
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("shopify token exchange returned %d", resp.StatusCode)
	}

	var parsed shopifyTokenExchangeResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("failed to parse Shopify token response")
	}
	if parsed.AccessToken == "" {
		return nil, fmt.Errorf("Shopify token response missing access_token")
	}
	return &parsed, nil
}
