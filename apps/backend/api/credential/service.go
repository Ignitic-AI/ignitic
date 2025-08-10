package credential

import (
	"net/http"
	"time"

	"backend/database"
	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
)

type CredentialService struct {
	db            *database.DB
	encryptionSvc *services.EncryptionService
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

	// Encrypt the secret value
	ciphertext, iv, err := s.encryptionSvc.Encrypt(app, name, req.Value)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to encrypt secret"})
		return
	}

	// Check if secret already exists
	var existingSecret models.Secret
	err = s.db.Where("app = ? AND name = ?", app, name).First(&existingSecret).Error

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
		App:         &app,
		Name:        name,
		Description: &req.Description,
		Ciphertext:  ciphertext,
		IV:          iv,
		Algo:        "AES-256-GCM",
		CreatedBy:   userID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
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
		"app":        app,
		"name":       name,
		"value":      plaintext,
		"algo":       secret.Algo,
		"created_by": secret.CreatedBy,
		"created_at": secret.CreatedAt,
		"updated_at": secret.UpdatedAt,
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

	var secrets []models.Secret
	err := s.db.Where("app = ?", app).Find(&secrets).Error
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
			App:         appName,
			Name:        secret.Name,
			Description: description,
			CreatedBy:   secret.CreatedBy,
			CreatedAt:   secret.CreatedAt,
			UpdatedAt:   secret.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"secrets": response,
		"count":   len(response),
	})
}
