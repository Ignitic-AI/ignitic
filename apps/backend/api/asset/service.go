package asset

import (
	"backend/database"
	"backend/models"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AssetService struct {
	db *database.DB
}

func NewAssetService(db *database.DB) *AssetService {
	return &AssetService{db: db}
}

// checkAccess verifies if user has access to create/modify/view assets
func (s *AssetService) checkAccess(userID uuid.UUID, orgID *uuid.UUID, requireAdmin bool) bool {
	if orgID == nil {
		// For personal assets, user always has access
		return true
	}

	var userOrg models.UserOrganization
	err := s.db.Where("user_id = ? AND organization_id = ?", userID, orgID).First(&userOrg).Error
	if err != nil {
		// User is not a member of the organization
		return false
	}

	if requireAdmin {
		// For operations that require admin privileges
		return userOrg.Role == "admin"
	}

	// For read operations, being a member is enough
	return true
}

// GetCategories returns all available asset categories
func (s *AssetService) GetCategories(c *gin.Context) {
	categories := []struct {
		ID          string `json:"id"`
		Name        string `json:"name"`
		Description string `json:"description"`
	}{
		{
			ID:          string(models.BusinessProfile),
			Name:        "Business Profile",
			Description: "Documents and assets related to business profile and company information",
		},
		{
			ID:          string(models.BrandAssets),
			Name:        "Brand Assets",
			Description: "Logos, brand guidelines, and other brand-related assets",
		},
		{
			ID:          string(models.MarketingAssets),
			Name:        "Marketing Assets",
			Description: "Marketing materials, campaigns, and promotional content",
		},
		{
			ID:          string(models.AnalyticsReports),
			Name:        "Analytics & Reports",
			Description: "Business analytics, performance reports, and data analysis",
		},
		{
			ID:          string(models.PolicyDocuments),
			Name:        "Policy Documents",
			Description: "Company policies, guidelines, and legal documents",
		},
		{
			ID:          string(models.MediaDocuments),
			Name:        "Media & Documents",
			Description: "General media files and miscellaneous documents",
		},
	}

	c.JSON(http.StatusOK, categories)
}

// UploadAsset handles file upload and creates asset record
func (s *AssetService) UploadAsset(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req models.AssetUploadRequest
	if err := c.ShouldBind(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate category
	category := models.AssetCategory(req.Category)
	if !category.IsValid() {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category. Must be one of: business_profile, brand_assets, marketing_assets, analytics_reports, policy_documents, media_documents"})
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}
	defer file.Close()

	// Check if user has admin access for organization assets
	if !s.checkAccess(userID, req.OrganizationID, true) {
		if req.OrganizationID != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only organization admins can upload assets"})
		} else {
			c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to upload assets"})
		}
		return
	}

	// Setup paths
	baseDir := "assets"
	var ownerType, ownerID string
	if req.OrganizationID != nil {
		ownerType = "organizations"
		ownerID = req.OrganizationID.String()
	} else {
		ownerType = "users"
		ownerID = userID.String()
	}

	// Create directory
	assetDir := filepath.Join(baseDir, ownerType, ownerID)
	if err := os.MkdirAll(assetDir, 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create asset directory"})
		return
	}

	// Generate unique filename
	fileExt := filepath.Ext(header.Filename)
	fileName := fmt.Sprintf("%s%s", uuid.New().String(), fileExt)
	filePath := filepath.Join(assetDir, fileName)

	// Save file
	dst, err := os.Create(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create file"})
		return
	}
	defer dst.Close()

	if _, err = io.Copy(dst, file); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Auto-generate title if not provided
	title := req.Title
	if title == "" {
		title = strings.TrimSuffix(header.Filename, fileExt)
	}

	// Create asset record
	asset := models.Asset{
		OrganizationID:  req.OrganizationID,
		UserID:          &userID,
		Category:        string(category),
		Title:           title,
		StorageProvider: "local",
		Path:            filePath,
		URL:             fmt.Sprintf("/assets/%s/%s/%s", ownerType, ownerID, fileName),
		MimeType:        header.Header.Get("Content-Type"),
		FileExt:         strings.TrimPrefix(fileExt, "."),
		SizeBytes:       header.Size,
		Tags:            req.Tags,
		Metadata:        req.Metadata,
		CreatedBy:       userID,
	}

	if err := s.db.Create(&asset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create asset record"})
		return
	}

	c.JSON(http.StatusCreated, s.toAssetResponse(asset))
}

// GetAsset retrieves asset details
func (s *AssetService) GetAsset(c *gin.Context) {
	assetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}

	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var asset models.Asset
	if err := s.db.First(&asset, "id = ?", assetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}

	// Members can view assets
	if !s.checkAccess(userID, asset.OrganizationID, false) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to access this asset"})
		return
	}

	c.JSON(http.StatusOK, s.toAssetResponse(asset))
}

// ListAssets lists assets for user or organization
func (s *AssetService) ListAssets(c *gin.Context) {
	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var orgID *uuid.UUID
	if orgIDStr := c.Query("organization_id"); orgIDStr != "" {
		parsedOrgID, err := uuid.Parse(orgIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
			return
		}
		orgID = &parsedOrgID
	}

	// Members can list assets
	if !s.checkAccess(userID, orgID, false) {
		c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to list these assets"})
		return
	}

	var assets []models.Asset
	query := s.db.Order("created_at DESC")

	if orgID != nil {
		query = query.Where("organization_id = ?", orgID)
	} else {
		query = query.Where("user_id = ?", userID)
	}

	if category := c.Query("category"); category != "" {
		if !models.AssetCategory(category).IsValid() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid category filter"})
			return
		}
		query = query.Where("category = ?", category)
	}

	if err := query.Find(&assets).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to list assets"})
		return
	}

	response := make([]models.AssetResponse, len(assets))
	for i, asset := range assets {
		response[i] = s.toAssetResponse(asset)
	}

	c.JSON(http.StatusOK, response)
}

// DeleteAsset deletes an asset
func (s *AssetService) DeleteAsset(c *gin.Context) {
	assetID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid asset ID"})
		return
	}

	userIDStr, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}
	userID, err := uuid.Parse(userIDStr.(string))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var asset models.Asset
	if err := s.db.First(&asset, "id = ?", assetID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Asset not found"})
		return
	}

	// Only admins can delete organization assets
	if !s.checkAccess(userID, asset.OrganizationID, true) {
		if asset.OrganizationID != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "Only organization admins can delete assets"})
		} else {
			c.JSON(http.StatusForbidden, gin.H{"error": "You don't have permission to delete this asset"})
		}
		return
	}

	// Delete file
	if err := os.Remove(asset.Path); err != nil {
		// Log error but continue with database deletion
		fmt.Printf("Failed to delete file: %v\n", err)
	}

	// Delete record
	if err := s.db.Delete(&asset).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete asset"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Asset deleted successfully"})
}

// Helper function to convert Asset to AssetResponse
func (s *AssetService) toAssetResponse(asset models.Asset) models.AssetResponse {
	return models.AssetResponse{
		ID:              asset.ID,
		OrganizationID:  asset.OrganizationID,
		UserID:          asset.UserID,
		Category:        asset.Category,
		Title:           asset.Title,
		StorageProvider: asset.StorageProvider,
		Path:            asset.Path,
		URL:             asset.URL,
		MimeType:        asset.MimeType,
		FileExt:         asset.FileExt,
		SizeBytes:       asset.SizeBytes,
		Tags:            asset.Tags,
		Metadata:        asset.Metadata,
		CreatedBy:       asset.CreatedBy,
		CreatedAt:       asset.CreatedAt,
		UpdatedAt:       asset.UpdatedAt,
	}
}
