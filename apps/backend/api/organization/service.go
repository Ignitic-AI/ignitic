package organization

import (
	"net/http"
	"strconv"

	"backend/database"
	"backend/models"

	"github.com/gin-gonic/gin"
)

type OrganizationService struct {
	db *database.DB
}

// NewOrganizationService creates a new organization service instance
func NewOrganizationService(db *database.DB) *OrganizationService {
	return &OrganizationService{
		db: db,
	}
}

// CreateOrganization creates a new organization
func (s *OrganizationService) CreateOrganization(c *gin.Context) {
	var orgData struct {
		Name             string `json:"name" binding:"required"`
		Description      string `json:"description"`
		EmployeeCount    int    `json:"employee_count" binding:"required,min=1"`
		EcommerceDomain  string `json:"ecommerce_domain"`
		Industry         string `json:"industry"`
		CompanySize      string `json:"company_size"`
		Website          string `json:"website"`
		Country          string `json:"country"`
		City             string `json:"city"`
		Address          string `json:"address"`
		PhoneNumber      string `json:"phone_number"`
		SubscriptionPlan string `json:"subscription_plan"`
	}

	if err := c.ShouldBindJSON(&orgData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Create organization
	organization := models.Organization{
		Name:             orgData.Name,
		Description:      orgData.Description,
		EmployeeCount:    orgData.EmployeeCount,
		EcommerceDomain:  orgData.EcommerceDomain,
		Industry:         orgData.Industry,
		CompanySize:      orgData.CompanySize,
		Website:          orgData.Website,
		Country:          orgData.Country,
		City:             orgData.City,
		Address:          orgData.Address,
		PhoneNumber:      orgData.PhoneNumber,
		SubscriptionPlan: getOrDefault(orgData.SubscriptionPlan, "free"),
	}

	if err := s.db.Create(&organization).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create organization"})
		return
	}

	// Add creator as admin to the organization
	userIDInt, _ := strconv.Atoi(userID)
	userOrg := models.UserOrganization{
		UserID:         uint(userIDInt),
		OrganizationID: organization.ID,
		Role:           "admin",
		IsActive:       true,
	}

	if err := s.db.Create(&userOrg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign user to organization"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Organization created successfully",
		"organization": organization,
	})
}

// GetOrganization gets organization details
func (s *OrganizationService) GetOrganization(c *gin.Context) {
	orgID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var organization models.Organization
	if err := s.db.Where("id = ?", orgID).First(&organization).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	// Check if user is member of this organization
	userIDInt, _ := strconv.Atoi(userID)
	var userOrg models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true", userIDInt, orgID).First(&userOrg).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Get user's role in this organization
	c.JSON(http.StatusOK, gin.H{
		"organization": organization,
		"user_role":    userOrg.Role,
		"joined_at":    userOrg.JoinedAt,
	})
}

// UpdateOrganization updates organization details
func (s *OrganizationService) UpdateOrganization(c *gin.Context) {
	orgID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if user is admin of this organization
	userIDInt, _ := strconv.Atoi(userID)
	var userOrg models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND role = 'admin' AND is_active = true", userIDInt, orgID).First(&userOrg).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var updateData struct {
		Name             string `json:"name"`
		Description      string `json:"description"`
		EmployeeCount    int    `json:"employee_count"`
		EcommerceDomain  string `json:"ecommerce_domain"`
		Industry         string `json:"industry"`
		CompanySize      string `json:"company_size"`
		Website          string `json:"website"`
		Country          string `json:"country"`
		City             string `json:"city"`
		Address          string `json:"address"`
		PhoneNumber      string `json:"phone_number"`
		SubscriptionPlan string `json:"subscription_plan"`
	}

	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var organization models.Organization
	if err := s.db.Where("id = ?", orgID).First(&organization).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	// Update fields if provided
	if updateData.Name != "" {
		organization.Name = updateData.Name
	}
	if updateData.Description != "" {
		organization.Description = updateData.Description
	}
	if updateData.EmployeeCount > 0 {
		organization.EmployeeCount = updateData.EmployeeCount
	}
	if updateData.EcommerceDomain != "" {
		organization.EcommerceDomain = updateData.EcommerceDomain
	}
	if updateData.Industry != "" {
		organization.Industry = updateData.Industry
	}
	if updateData.CompanySize != "" {
		organization.CompanySize = updateData.CompanySize
	}
	if updateData.Website != "" {
		organization.Website = updateData.Website
	}
	if updateData.Country != "" {
		organization.Country = updateData.Country
	}
	if updateData.City != "" {
		organization.City = updateData.City
	}
	if updateData.Address != "" {
		organization.Address = updateData.Address
	}
	if updateData.PhoneNumber != "" {
		organization.PhoneNumber = updateData.PhoneNumber
	}
	if updateData.SubscriptionPlan != "" {
		organization.SubscriptionPlan = updateData.SubscriptionPlan
	}

	if err := s.db.Save(&organization).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update organization"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Organization updated successfully",
		"organization": organization,
	})
}

// ListOrganizations lists user's organizations
func (s *OrganizationService) ListOrganizations(c *gin.Context) {
	userID := c.GetString("user_id")
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDInt, _ := strconv.Atoi(userID)
	var userOrgs []models.UserOrganization

	if err := s.db.Preload("Organization").Where("user_id = ? AND is_active = true", userIDInt).Find(&userOrgs).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch organizations"})
		return
	}

	var organizations []gin.H
	for _, userOrg := range userOrgs {
		organizations = append(organizations, gin.H{
			"id":                userOrg.Organization.ID,
			"name":              userOrg.Organization.Name,
			"description":       userOrg.Organization.Description,
			"employee_count":    userOrg.Organization.EmployeeCount,
			"ecommerce_domain":  userOrg.Organization.EcommerceDomain,
			"industry":          userOrg.Organization.Industry,
			"company_size":      userOrg.Organization.CompanySize,
			"website":           userOrg.Organization.Website,
			"country":           userOrg.Organization.Country,
			"city":              userOrg.Organization.City,
			"subscription_plan": userOrg.Organization.SubscriptionPlan,
			"user_role":         userOrg.Role,
			"joined_at":         userOrg.JoinedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"organizations": organizations,
	})
}

// JoinOrganization allows user to join an organization
func (s *OrganizationService) JoinOrganization(c *gin.Context) {
	orgID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	var joinData struct {
		Role string `json:"role"`
	}

	if err := c.ShouldBindJSON(&joinData); err != nil {
		joinData.Role = "member" // Default role
	}

	// Check if organization exists
	var organization models.Organization
	if err := s.db.Where("id = ?", orgID).First(&organization).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	// Check if user is already a member
	userIDInt, _ := strconv.Atoi(userID)
	var existingUserOrg models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ?", userIDInt, orgID).First(&existingUserOrg).Error; err == nil {
		if existingUserOrg.IsActive {
			c.JSON(http.StatusConflict, gin.H{"error": "User is already a member of this organization"})
			return
		}
		// Reactivate membership
		existingUserOrg.IsActive = true
		existingUserOrg.Role = joinData.Role
		if err := s.db.Save(&existingUserOrg).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to rejoin organization"})
			return
		}
	} else {
		// Create new membership
		userOrg := models.UserOrganization{
			UserID:         uint(userIDInt),
			OrganizationID: organization.ID,
			Role:           joinData.Role,
			IsActive:       true,
		}

		if err := s.db.Create(&userOrg).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join organization"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully joined organization",
		"organization": gin.H{
			"id":   organization.ID,
			"name": organization.Name,
		},
		"role": joinData.Role,
	})
}

// LeaveOrganization allows user to leave an organization
func (s *OrganizationService) LeaveOrganization(c *gin.Context) {
	orgID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	userIDInt, _ := strconv.Atoi(userID)
	var userOrg models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true", userIDInt, orgID).First(&userOrg).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User is not a member of this organization"})
		return
	}

	// Deactivate membership
	userOrg.IsActive = false
	if err := s.db.Save(&userOrg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to leave organization"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully left organization",
	})
}

// Helper function
func getOrDefault(value, defaultValue string) string {
	if value == "" {
		return defaultValue
	}
	return value
}
