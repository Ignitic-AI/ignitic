package asset

import (
	"backend/database"
	"backend/models"
	"backend/services"
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type AssetService struct {
	db         *database.DB
	cloudinary *services.CloudinaryService
}

func NewAssetService(db *database.DB, cloudinary *services.CloudinaryService) *AssetService {
	return &AssetService{
		db:         db,
		cloudinary: cloudinary,
	}
}

// checkAccess verifies if a user has access to create/modify/view assets
// @Summary Check user access
// @Description Verifies if a user has access to personal or organization assets, with optional admin requirement.
// @Tags access
// @Param user_id path string true "User ID (UUID)"
// @Param org_id query string false "Organization ID (UUID)"
// @Param require_admin query bool false "Require admin privileges"
// @Success 200 {object} map[string]bool "true if user has access, false otherwise"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Router /access/check [get]
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
// @Summary List asset categories
// @Description Retrieves a list of all supported asset categories with ID, name, and description.
// @Tags assets
// @Produce json
// @Success 200 {array} map[string]interface{} "List of categories"
// @Failure 500 {object} map[string]string "Server error"
// @Router /assets/categories [get]
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

// UploadAsset handles file upload and creates an asset record
// @Summary Upload an asset
// @Description Uploads a file to Cloudinary and creates a corresponding asset record in the database.
// @Tags assets
// @Accept multipart/form-data
// @Produce json
// @Param user_id header string true "User ID (from authentication middleware)"
// @Param file formData file true "File to upload"
// @Param category formData string true "Asset category (business_profile, brand_assets, marketing_assets, analytics_reports, policy_documents, media_documents)"
// @Param title formData string false "Asset title (auto-generated from filename if not provided)"
// @Param organization_id formData string false "Organization ID (UUID)"
// @Param tags formData []string false "Tags associated with the asset"
// @Param metadata formData object false "Additional metadata as JSON"
// @Success 201 {object} models.Asset "Asset created successfully"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Server error"
// @Router /assets [post]
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

	// Manually parse form fields to avoid UUID binding issues
	var req models.AssetUploadRequest

	// Parse organization_id
	if orgIDStr := c.PostForm("organization_id"); orgIDStr != "" {
		orgID, err := uuid.Parse(orgIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID format"})
			return
		}
		req.OrganizationID = &orgID
	}

	// Parse other fields
	req.Category = c.PostForm("category")
	req.Title = c.PostForm("title")

	// Parse tags (handle array format)
	if tagsStr := c.PostFormArray("tags"); len(tagsStr) > 0 {
		req.Tags = tagsStr
	}

	// Parse metadata if present
	if metadataStr := c.PostForm("metadata"); metadataStr != "" {
		var metadata interface{}
		if err := json.Unmarshal([]byte(metadataStr), &metadata); err == nil {
			req.Metadata = metadata
		}
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

	// Setup Cloudinary folder path
	var folderPath string
	if req.OrganizationID != nil {
		folderPath = fmt.Sprintf("organizations/%s", req.OrganizationID.String())
	} else {
		folderPath = fmt.Sprintf("users/%s", userID.String())
	}

	// Use original filename - Cloudinary will handle uniqueness if needed
	fileName := header.Filename

	// Upload to Cloudinary
	uploadResult, err := s.cloudinary.UploadFile(file, fileName, folderPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to upload file to Cloudinary"})
		return
	}

	// Auto-generate title if not provided
	fileExt := filepath.Ext(header.Filename)
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
		StorageProvider: "cloudinary",
		Path:            uploadResult.PublicID,
		URL:             uploadResult.SecureURL,
		MimeType:        header.Header.Get("Content-Type"),
		FileExt:         strings.TrimPrefix(fileExt, "."),
		SizeBytes:       header.Size,
		Tags:            req.Tags,
		Metadata:        req.Metadata,
		CreatedBy:       userID,
	}

	if err := s.db.Create(&asset).Error; err != nil {
		// If database save fails, try to delete the uploaded file from Cloudinary
		_ = s.cloudinary.DeleteFile(uploadResult.PublicID)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create asset record"})
		return
	}

	c.JSON(http.StatusCreated, s.toAssetResponse(asset))
}

// GetAsset retrieves asset details
// @Summary Get asset details
// @Description Retrieves detailed information about a specific asset, including secure URL if stored in Cloudinary.
// @Tags assets
// @Produce json
// @Param id path string true "Asset ID (UUID)"
// @Success 200 {object} models.AssetResponse "Asset details"
// @Failure 400 {object} map[string]string "Invalid asset ID"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 404 {object} map[string]string "Asset not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /assets/{id} [get]
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

	// Refresh secure URL for Cloudinary assets
	if asset.StorageProvider == "cloudinary" {
		if newURL, err := s.cloudinary.GetSignedURL(asset.Path); err == nil {
			asset.URL = newURL
		}
	}

	c.JSON(http.StatusOK, s.toAssetResponse(asset))
}

// ListAssets lists assets for user or organization
// @Summary List assets
// @Description Lists all assets belonging to a user or organization, with optional category filter.
// @Tags assets
// @Produce json
// @Param organization_id query string false "Organization ID (UUID)"
// @Param category query string false "Asset category filter (business_profile, brand_assets, marketing_assets, analytics_reports, policy_documents, media_documents)"
// @Success 200 {array} models.AssetResponse "List of assets"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 500 {object} map[string]string "Server error"
// @Router /assets [get]
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
// @Summary Delete an asset
// @Description Deletes an asset record and removes its file from Cloudinary if applicable. Only organization admins can delete organization assets.
// @Tags assets
// @Produce json
// @Param id path string true "Asset ID (UUID)"
// @Success 200 {object} map[string]string "Asset deleted successfully"
// @Failure 400 {object} map[string]string "Invalid asset ID"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden"
// @Failure 404 {object} map[string]string "Asset not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /assets/{id} [delete]
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

	// Delete file from storage
	if asset.StorageProvider == "cloudinary" {
		if err := s.cloudinary.DeleteFile(asset.Path); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete file from Cloudinary"})
			return
		}
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
