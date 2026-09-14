package organization

import (
	"encoding/json"
	"net/http"
	"time"

	"backend/database"
	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type OrganizationService struct {
	db     *database.DB
	logger *services.DatabaseLogger
}

// NewOrganizationService creates a new organization service instance
func NewOrganizationService(db *database.DB) *OrganizationService {
	return &OrganizationService{
		db:     db,
		logger: services.NewDatabaseLogger(db),
	}
}

// CreateOrganization creates a new organization
// @Summary Create an organization
// @Description Creates a new organization and assigns the creator as an admin.
// @Tags organizations
// @Accept json
// @Produce json
// @Param organization body struct {
// @Param   name              string `json:"name" binding:"required"`
// @Param   description       string `json:"description"`
// @Param   employee_count    int    `json:"employee_count" binding:"required,min=1"`
// @Param   ecommerce_domain  string `json:"ecommerce_domain"`
// @Param   industry          string `json:"industry"`
// @Param   company_size      string `json:"company_size"`
// @Param   website           string `json:"website"`
// @Param   country           string `json:"country"`
// @Param   city              string `json:"city"`
// @Param   address           string `json:"address"`
// @Param   phone_number      string `json:"phone_number"`
// @Param   subscription_plan string `json:"subscription_plan"`
// } true "Organization data"
// @Success 201 {object} map[string]interface{} "Organization created successfully"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations [post]
func (s *OrganizationService) CreateOrganization(c *gin.Context) {
	var orgData struct {
		Name                    string   `json:"name" binding:"required"`
		Description             string   `json:"description"`
		EmployeeCount           int      `json:"employee_count"`
		EcommerceDomain         string   `json:"ecommerce_domain"`
		Industry                string   `json:"industry"`
		CompanySize             string   `json:"company_size"`
		Website                 string   `json:"website"`
		Country                 string   `json:"country"`
		City                    string   `json:"city"`
		Address                 string   `json:"address"`
		PhoneNumber             string   `json:"phone_number"`
		SubscriptionPlan        string   `json:"subscription_plan"`
		HearAboutUs             string   `json:"hear_about_us"`
		WorkOnMultiplePlatforms bool     `json:"work_on_multiple_platforms"`
		SelectedBrands          []string `json:"selected_brands"`
		CreatorJobTitle         string   `json:"creator_job_title"`
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

	// Parse userID to UUID
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	// Verify user exists
	var user models.User
	if err := s.db.Where("id = ?", userUUID).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User not found"})
		return
	}

	employeeCount := orgData.EmployeeCount
	if employeeCount < 1 {
		employeeCount = employeeCountFromCompanySize(orgData.CompanySize)
	}
	if employeeCount < 1 {
		employeeCount = 1
	}

	// Create organization
	organization := models.Organization{
		Name:                    orgData.Name,
		Description:             orgData.Description,
		EmployeeCount:           employeeCount,
		EcommerceDomain:         orgData.EcommerceDomain,
		Industry:                orgData.Industry,
		CompanySize:             orgData.CompanySize,
		Website:                 orgData.Website,
		Country:                 orgData.Country,
		City:                    orgData.City,
		Address:                 orgData.Address,
		PhoneNumber:             orgData.PhoneNumber,
		SubscriptionPlan:        getOrDefault(orgData.SubscriptionPlan, "free"),
		HearAboutUs:             orgData.HearAboutUs,
		WorkOnMultiplePlatforms: orgData.WorkOnMultiplePlatforms,
		SelectedBrands:          stringSliceToJSONRaw(orgData.SelectedBrands),
		PreferredAutomationIDs:  json.RawMessage("[]"),
		CreatedBy:               userUUID,
	}

	if err := s.db.Create(&organization).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create organization"})
		return
	}

	// Add creator as admin to the organization
	userOrg := models.UserOrganization{
		UserID:             userUUID,
		OrganizationID:     organization.ID,
		Role:               "admin",
		OnboardingJobTitle: orgData.CreatorJobTitle,
		IsActive:           true,
	}

	if err := s.db.Create(&userOrg).Error; err != nil {
		// Log error
		s.logger.LogUser(c.Request.Context(), models.LogLevelError, "ORGANIZATION_CREATE_FAILED",
			"Failed to assign user to organization",
			services.WithUserID(userUUID),
			services.WithOrganizationID(organization.ID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to assign user to organization"})
		return
	}

	// Log successful organization creation
	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORGANIZATION_CREATE",
		"Organization created successfully",
		services.WithUserID(userUUID),
		services.WithOrganizationID(organization.ID),
	)

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Organization created successfully",
		"organization": organization,
	})
}

// GetOrganization gets organization details
// @Summary Get an organization
// @Description Retrieves details of a specific organization if the user is a member.
// @Tags organizations
// @Produce json
// @Param id path string true "Organization ID"
// @Success 200 {object} map[string]interface{} "Organization details with user role"
// @Failure 400 {object} map[string]string "Invalid organization ID format"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Access denied"
// @Failure 404 {object} map[string]string "Organization not found"
// @Router /organizations/{id} [get]
func (s *OrganizationService) GetOrganization(c *gin.Context) {
	orgID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse organization ID
	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID format"})
		return
	}

	var organization models.Organization
	if err := s.db.Where("id = ?", orgUUID).First(&organization).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	// Check if user is member of this organization
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}
	var userOrg models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true", userUUID, orgUUID).First(&userOrg).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORGANIZATION_GET",
		"Organization retrieved",
		services.WithUserID(userUUID),
		services.WithOrganizationID(orgUUID),
	)

	// Get user's role in this organization
	c.JSON(http.StatusOK, gin.H{
		"organization": organization,
		"user_role":    userOrg.Role,
		"joined_at":    userOrg.JoinedAt,
	})
}

// UpdateOrganization updates organization details
// @Summary Update an organization
// @Description Updates the details of a specific organization (admin access required).
// @Tags organizations
// @Accept json
// @Produce json
// @Param id path string true "Organization ID"
// @Param organization body struct {
// @Param   name              string `json:"name"`
// @Param   description       string `json:"description"`
// @Param   employee_count    int    `json:"employee_count"`
// @Param   ecommerce_domain  string `json:"ecommerce_domain"`
// @Param   industry          string `json:"industry"`
// @Param   company_size      string `json:"company_size"`
// @Param   website           string `json:"website"`
// @Param   country           string `json:"country"`
// @Param   city              string `json:"city"`
// @Param   address           string `json:"address"`
// @Param   phone_number      string `json:"phone_number"`
// @Param   subscription_plan string `json:"subscription_plan"`
// } true "Updated organization data"
// @Success 200 {object} map[string]interface{} "Organization updated successfully"
// @Failure 400 {object} map[string]string "Invalid request or ID format"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Admin access required"
// @Failure 404 {object} map[string]string "Organization not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id} [put]
func (s *OrganizationService) UpdateOrganization(c *gin.Context) {
	orgID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse IDs
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID format"})
		return
	}

	// Check if user is admin of this organization
	var userOrg models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND role = 'admin' AND is_active = true", userUUID, orgUUID).First(&userOrg).Error; err != nil {
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

		HearAboutUs              *string   `json:"hear_about_us"`
		WorkOnMultiplePlatforms  *bool     `json:"work_on_multiple_platforms"`
		SelectedBrands           *[]string `json:"selected_brands"`
		PreferredAutomationIDs   *[]string `json:"preferred_automation_ids"`
	}

	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var organization models.Organization
	if err := s.db.Where("id = ?", orgUUID).First(&organization).Error; err != nil {
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
	if updateData.HearAboutUs != nil {
		organization.HearAboutUs = *updateData.HearAboutUs
	}
	if updateData.WorkOnMultiplePlatforms != nil {
		organization.WorkOnMultiplePlatforms = *updateData.WorkOnMultiplePlatforms
	}
	if updateData.SelectedBrands != nil {
		organization.SelectedBrands = stringSliceToJSONRaw(*updateData.SelectedBrands)
	}
	if updateData.PreferredAutomationIDs != nil {
		organization.PreferredAutomationIDs = stringSliceToJSONRaw(*updateData.PreferredAutomationIDs)
	}

	if err := s.db.Save(&organization).Error; err != nil {
		s.logger.LogUser(c.Request.Context(), models.LogLevelError, "ORGANIZATION_UPDATE_FAILED",
			"Failed to update organization",
			services.WithUserID(userUUID),
			services.WithOrganizationID(orgUUID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update organization"})
		return
	}

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORGANIZATION_UPDATE",
		"Organization updated successfully",
		services.WithUserID(userUUID),
		services.WithOrganizationID(orgUUID),
	)

	c.JSON(http.StatusOK, gin.H{
		"message":      "Organization updated successfully",
		"organization": organization,
	})
}

// DeleteOrganization deletes an organization
// @Summary Delete an organization
// @Description Deletes a specific organization. Only organization admins can perform this action.
// @Tags organizations
// @Produce json
// @Param id path string true "Organization ID"
// @Success 200 {object} map[string]string "Organization deleted successfully"
// @Failure 400 {object} map[string]string "Invalid user or organization ID format"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Admin access required"
// @Failure 404 {object} map[string]string "Organization not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id} [delete]
func (s *OrganizationService) DeleteOrganization(c *gin.Context) {
	orgID := c.Param("id")
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

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID format"})
		return
	}

	var organization models.Organization
	if err := s.db.Where("id = ?", orgUUID).First(&organization).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	var adminCheck models.UserOrganization
	if err := s.db.Where(
		"user_id = ? AND organization_id = ? AND role = 'admin' AND is_active = true",
		userUUID,
		orgUUID,
	).First(&adminCheck).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	if err := s.db.Delete(&organization).Error; err != nil {
		s.logger.LogUser(c.Request.Context(), models.LogLevelError, "ORGANIZATION_DELETE_FAILED",
			"Failed to delete organization",
			services.WithUserID(userUUID),
			services.WithOrganizationID(orgUUID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete organization"})
		return
	}

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORGANIZATION_DELETE",
		"Organization deleted successfully",
		services.WithUserID(userUUID),
		services.WithOrganizationID(orgUUID),
	)

	c.JSON(http.StatusOK, gin.H{"message": "Organization deleted successfully"})
}

// ListOrganizations lists user's organizations
// @Summary List organizations
// @Description Retrieves all active organizations the authenticated user belongs to.
// @Tags organizations
// @Produce json
// @Success 200 {object} map[string]interface{} "List of user's organizations"
// @Failure 400 {object} map[string]string "Invalid user ID format"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations [get]
func (s *OrganizationService) ListOrganizations(c *gin.Context) {
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
	var userOrgs []models.UserOrganization

	if err := s.db.Preload("Organization").Where("user_id = ? AND is_active = true", userUUID).Find(&userOrgs).Error; err != nil {
		s.logger.LogUser(c.Request.Context(), models.LogLevelError, "ORGANIZATION_LIST_FAILED",
			"Failed to list organizations for user",
			services.WithUserID(userUUID),
		)
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
// @Summary Join an organization
// @Description Allows a user to join an organization by ID. If already a member but inactive, reactivates membership.
// @Tags organizations
// @Accept json
// @Produce json
// @Param id path string true "Organization ID"
// @Param joinData body struct {
// @Param   role string `json:"role"`
// } false "Role to assign (defaults to 'member')"
// @Success 200 {object} map[string]interface{} "Successfully joined organization"
// @Failure 400 {object} map[string]string "Invalid request or ID format"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 404 {object} map[string]string "Organization not found"
// @Failure 409 {object} map[string]string "User is already a member"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id}/join [post]
func (s *OrganizationService) JoinOrganization(c *gin.Context) {
	orgID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse IDs
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID format"})
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
	if err := s.db.Where("id = ?", orgUUID).First(&organization).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	// Check if user is already a member
	var existingUserOrg models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ?", userUUID, orgUUID).First(&existingUserOrg).Error; err == nil {
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
			UserID:         userUUID,
			OrganizationID: organization.ID,
			Role:           joinData.Role,
			IsActive:       true,
		}

		if err := s.db.Create(&userOrg).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join organization"})
			return
		}
	}

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORGANIZATION_JOIN",
		"User joined organization",
		services.WithUserID(userUUID),
		services.WithOrganizationID(orgUUID),
	)

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
// @Summary Leave an organization
// @Description Allows a user to leave an organization they are currently a member of.
// @Tags organizations
// @Produce json
// @Param id path string true "Organization ID"
// @Success 200 {object} map[string]interface{} "Successfully left organization"
// @Failure 400 {object} map[string]string "Invalid request or ID format"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 404 {object} map[string]string "User is not a member"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id}/leave [post]
func (s *OrganizationService) LeaveOrganization(c *gin.Context) {
	orgID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse IDs
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID format"})
		return
	}

	var userOrg models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true", userUUID, orgUUID).First(&userOrg).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User is not a member of this organization"})
		return
	}

	// Deactivate membership
	userOrg.IsActive = false
	if err := s.db.Save(&userOrg).Error; err != nil {
		s.logger.LogUser(c.Request.Context(), models.LogLevelError, "ORGANIZATION_LEAVE_FAILED",
			"Failed to leave organization",
			services.WithUserID(userUUID),
			services.WithOrganizationID(orgUUID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to leave organization"})
		return
	}

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORGANIZATION_LEAVE",
		"User left organization",
		services.WithUserID(userUUID),
		services.WithOrganizationID(orgUUID),
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Successfully left organization",
	})
}

// AddMember allows admins to add members to organization
// @Summary Add a member to an organization
// @Description Allows an admin to add a user to an organization by email with a specified role.
// @Tags organizations
// @Accept json
// @Produce json
// @Param id path string true "Organization ID"
// @Param memberData body struct {
// @Param   email string `json:"email" binding:"required,email"`
// @Param   role  string `json:"role" binding:"required"`
// } true "Member data"
// @Success 201 {object} map[string]interface{} "Member added successfully"
// @Failure 400 {object} map[string]string "Invalid request or role"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Admin access required"
// @Failure 404 {object} map[string]string "User or organization not found"
// @Failure 409 {object} map[string]string "User is already a member"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id}/members [post]
func (s *OrganizationService) AddMember(c *gin.Context) {
	orgID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse IDs
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID format"})
		return
	}

	// Check if current user is admin of this organization
	var adminCheck models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND role = 'admin' AND is_active = true", userUUID, orgUUID).First(&adminCheck).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var memberData struct {
		Email string `json:"email" binding:"required,email"`
		Role  string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&memberData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate role
	if memberData.Role != "admin" && memberData.Role != "member" && memberData.Role != "viewer" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Must be 'admin', 'member', or 'viewer'"})
		return
	}

	// Check if organization exists first
	var organization models.Organization
	if err := s.db.Where("id = ?", orgUUID).First(&organization).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	// Find user by email
	var user models.User
	if err := s.db.Where("email = ?", memberData.Email).First(&user).Error; err != nil {
		// User doesn't exist, create an invitation instead
		invitationService := NewInvitationService(s.db)

		// Check if there's already a pending invitation
		var existingInvitation models.OrganizationInvitation
		if err := s.db.Where("email = ? AND organization_id = ? AND status = 'pending'", memberData.Email, orgUUID).First(&existingInvitation).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "An invitation is already pending for this email"})
			return
		}

		// Create invitation (expires in 7 days)
		invitation := models.OrganizationInvitation{
			OrganizationID: orgUUID,
			Email:          memberData.Email,
			Role:           memberData.Role,
			Status:         "pending",
			InvitedBy:      userUUID,
			ExpiresAt:      time.Now().AddDate(0, 0, 7), // 7 days from now
		}

		if err := s.db.Create(&invitation).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invitation"})
			return
		}

		// Send invitation email
		go invitationService.sendInvitationEmail(invitation, organization)

		c.JSON(http.StatusCreated, gin.H{
			"message": "User not found, invitation sent instead",
			"invitation": gin.H{
				"id":         invitation.ID,
				"email":      invitation.Email,
				"role":       invitation.Role,
				"status":     invitation.Status,
				"expires_at": invitation.ExpiresAt,
			},
		})
		return
	}

	// Check if user is already a member
	var existingMember models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ?", user.ID, orgUUID).First(&existingMember).Error; err == nil {
		if existingMember.IsActive {
			c.JSON(http.StatusConflict, gin.H{"error": "User is already a member of this organization"})
			return
		}
		// Reactivate existing membership
		existingMember.IsActive = true
		existingMember.Role = memberData.Role
		if err := s.db.Save(&existingMember).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to reactivate membership"})
			return
		}
	} else {
		// Create new membership
		newMember := models.UserOrganization{
			UserID:         user.ID,
			OrganizationID: organization.ID,
			Role:           memberData.Role,
			IsActive:       true,
		}

		if err := s.db.Create(&newMember).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to add member"})
			return
		}
	}

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORGANIZATION_MEMBER_ADD",
		"Member added to organization",
		services.WithUserID(userUUID),
		services.WithOrganizationID(orgUUID),
		services.WithMetadata(map[string]interface{}{"member_email": memberData.Email, "role": memberData.Role}),
	)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Member added successfully",
		"member": gin.H{
			"id":         user.ID,
			"email":      user.Email,
			"first_name": user.FirstName,
			"last_name":  user.LastName,
			"role":       memberData.Role,
		},
		"organization": gin.H{
			"id":   organization.ID,
			"name": organization.Name,
		},
	})
}

// RemoveMember removes a member from an organization
// @Summary Remove a member
// @Description Allows an admin to remove a member from an organization. Prevents removing yourself if you are the only admin.
// @Tags organizations
// @Produce json
// @Param id path string true "Organization ID"
// @Param memberId path string true "Member User ID"
// @Success 200 {object} map[string]interface{} "Member removed successfully"
// @Failure 400 {object} map[string]string "Invalid request or ID format"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Admin access required"
// @Failure 404 {object} map[string]string "Member not found in organization"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id}/members/{memberId} [delete]
func (s *OrganizationService) RemoveMember(c *gin.Context) {
	orgID := c.Param("id")
	memberID := c.Param("memberId")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse IDs
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID format"})
		return
	}

	memberUUID, err := uuid.Parse(memberID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID format"})
		return
	}

	// Check if current user is admin of this organization
	var adminCheck models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND role = 'admin' AND is_active = true", userUUID, orgUUID).First(&adminCheck).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	// Find the member to remove
	var memberToRemove models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true", memberUUID, orgUUID).First(&memberToRemove).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found in organization"})
		return
	}

	// Prevent self-removal if user is the only admin
	if memberUUID == userUUID {
		var adminCount int64
		s.db.Model(&models.UserOrganization{}).Where("organization_id = ? AND role = 'admin' AND is_active = true", orgUUID).Count(&adminCount)
		if adminCount <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot remove yourself as the only admin"})
			return
		}
	}

	// Remove member (deactivate)
	memberToRemove.IsActive = false
	if err := s.db.Save(&memberToRemove).Error; err != nil {
		s.logger.LogUser(c.Request.Context(), models.LogLevelError, "ORGANIZATION_MEMBER_REMOVE_FAILED",
			"Failed to remove member from organization",
			services.WithUserID(userUUID),
			services.WithOrganizationID(orgUUID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove member"})
		return
	}

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORGANIZATION_MEMBER_REMOVE",
		"Member removed from organization",
		services.WithUserID(userUUID),
		services.WithOrganizationID(orgUUID),
		services.WithMetadata(map[string]interface{}{"removed_member_id": memberUUID.String()}),
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Member removed successfully",
	})
}

// UpdateMemberRole updates a member's role in an organization
// @Summary Update member role
// @Description Allows an admin to update a member's role. Prevents demoting yourself if you are the only admin.
// @Tags organizations
// @Accept json
// @Produce json
// @Param id path string true "Organization ID"
// @Param memberId path string true "Member User ID"
// @Param roleData body struct {
// @Param   role string `json:"role" binding:"required" example:"member"`
// } true "New role (admin, member, viewer)"
// @Success 200 {object} map[string]interface{} "Member role updated successfully"
// @Failure 400 {object} map[string]string "Invalid request, role, or ID format"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Admin access required"
// @Failure 404 {object} map[string]string "Member not found in organization"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id}/members/{memberId}/role [put]
func (s *OrganizationService) UpdateMemberRole(c *gin.Context) {
	orgID := c.Param("id")
	memberID := c.Param("memberId")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse IDs
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID format"})
		return
	}

	memberUUID, err := uuid.Parse(memberID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid member ID format"})
		return
	}

	// Check if current user is admin of this organization
	var adminCheck models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND role = 'admin' AND is_active = true", userUUID, orgUUID).First(&adminCheck).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	var roleData struct {
		Role string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&roleData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate role
	if roleData.Role != "admin" && roleData.Role != "member" && roleData.Role != "viewer" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Must be 'admin', 'member', or 'viewer'"})
		return
	}

	// Find the member to update
	var memberToUpdate models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true", memberUUID, orgUUID).First(&memberToUpdate).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Member not found in organization"})
		return
	}

	// Prevent demoting yourself if you're the only admin
	if memberUUID == userUUID && roleData.Role != "admin" {
		var adminCount int64
		s.db.Model(&models.UserOrganization{}).Where("organization_id = ? AND role = 'admin' AND is_active = true", orgUUID).Count(&adminCount)
		if adminCount <= 1 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cannot demote yourself as the only admin"})
			return
		}
	}

	// Update role
	memberToUpdate.Role = roleData.Role
	if err := s.db.Save(&memberToUpdate).Error; err != nil {
		s.logger.LogUser(c.Request.Context(), models.LogLevelError, "ORGANIZATION_MEMBER_ROLE_UPDATE_FAILED",
			"Failed to update member role",
			services.WithUserID(userUUID),
			services.WithOrganizationID(orgUUID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update member role"})
		return
	}

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORGANIZATION_MEMBER_ROLE_UPDATE",
		"Member role updated",
		services.WithUserID(userUUID),
		services.WithOrganizationID(orgUUID),
		services.WithMetadata(map[string]interface{}{"member_id": memberUUID.String(), "new_role": roleData.Role}),
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Member role updated successfully",
		"member": gin.H{
			"user_id": memberToUpdate.UserID,
			"role":    memberToUpdate.Role,
		},
	})
}

// ListMembers lists all members of an organization
// @Summary List organization members
// @Description Retrieves all active members of an organization, including role and basic user info.
// @Tags organizations
// @Produce json
// @Param id path string true "Organization ID"
// @Success 200 {object} map[string]interface{} "List of organization members"
// @Failure 400 {object} map[string]string "Invalid organization ID format"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Access denied"
// @Failure 500 {object} map[string]string "Failed to fetch members"
// @Router /organizations/{id}/members [get]
func (s *OrganizationService) ListMembers(c *gin.Context) {
	orgID := c.Param("id")
	userID := c.GetString("user_id")

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse IDs
	userUUID, err := uuid.Parse(userID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID format"})
		return
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID format"})
		return
	}

	// Check if user is member of this organization
	var userOrg models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true", userUUID, orgUUID).First(&userOrg).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Get all active members
	var members []models.UserOrganization
	if err := s.db.Preload("User").Where("organization_id = ? AND is_active = true", orgUUID).Find(&members).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch members"})
		return
	}

	var memberList []gin.H
	for _, member := range members {
		memberList = append(memberList, gin.H{
			"id":         member.User.ID,
			"email":      member.User.Email,
			"first_name": member.User.FirstName,
			"last_name":  member.User.LastName,
			"role":       member.Role,
			"joined_at":  member.JoinedAt,
			"is_active":  member.IsActive,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"members": memberList,
		"total":   len(memberList),
	})
}

// Helper function
func getOrDefault(value, defaultValue string) string {
	if value == "" {
		return defaultValue
	}
	return value
}
