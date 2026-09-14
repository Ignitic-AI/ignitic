package organization

import (
	"backend/database"
	"backend/models"
	"backend/services"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/lib/pq"
)

type OrgBusinessProfileService struct {
	db     *database.DB
	logger *services.DatabaseLogger
}

func NewOrgBusinessProfileService(db *database.DB) *OrgBusinessProfileService {
	return &OrgBusinessProfileService{db: db, logger: services.NewDatabaseLogger(db)}
}

func (s *OrgBusinessProfileService) checkIsAdmin(userID, orgID uuid.UUID) bool {
	var userOrg models.UserOrganization
	err := s.db.Where("user_id = ? AND organization_id = ? AND role = ?", userID, orgID, "admin").First(&userOrg).Error
	return err == nil
}

// CreateOrUpdateOrgBusinessProfile creates or updates organization business profile
// @Summary Create or update organization business profile
// @Description Creates a new organization business profile if it doesn’t exist, otherwise updates the existing profile. Only organization admins can perform this action.
// @Tags organization-business-profile
// @Accept json
// @Produce json
// @Param id path string true "Organization ID"
// @Param profile body struct {
// @Param   business_hours          string              `json:"business_hours"`
// @Param   primary_markets         []string            `json:"primary_markets"`
// @Param   default_currency        string              `json:"default_currency"`
// @Param   supported_languages     []string            `json:"supported_languages"`
// @Param   support_email           string              `json:"support_email"`
// @Param   support_channels        []string            `json:"support_channels"`
// @Param   social_links            map[string]string   `json:"social_links"`
// @Param   fulfillment_method      string              `json:"fulfillment_method"`
// @Param   shipping_carriers       []string            `json:"shipping_carriers"`
// @Param   returns_policy_url      string              `json:"returns_policy_url"`
// @Param   payment_gateways        []string            `json:"payment_gateways"`
// @Param   tax_identifiers         map[string]string   `json:"tax_identifiers"`
// @Param   primary_contacts        []object            `json:"primary_contacts"`
// @Param   compliance_contacts     []object            `json:"compliance_contacts"`
// @Param   ecommerce_platforms     []object            `json:"ecommerce_platforms"`
// @Param   key_systems             []string            `json:"key_systems"`
// @Param   holiday_blackout_dates  []string            `json:"holiday_blackout_dates"`
// @Param   data_processing_addenda string              `json:"data_processing_addenda"`
// } true "Organization business profile data"
// @Success 200 {object} models.OrganizationBusinessProfileResponse "Business profile created or updated successfully"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden – Only admin can modify business profile"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id}/business-profile [post]
func (s *OrgBusinessProfileService) CreateOrUpdateOrgBusinessProfile(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		return
	}

	// Get user ID from context (set by auth middleware)
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

	// Check if user is admin
	if !s.checkIsAdmin(userID, orgID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admin can modify organization business profile"})
		return
	}

	var req models.OrganizationBusinessProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check if business profile already exists
	var profile models.OrganizationBusinessProfile
	result := s.db.First(&profile, "organization_id = ?", orgID)

	if result.Error != nil {
		// Create new business profile
		profile = models.OrganizationBusinessProfile{
			OrganizationID:        orgID,
			BusinessHours:         req.BusinessHours,
			PrimaryMarkets:        pq.StringArray(req.PrimaryMarkets),
			DefaultCurrency:       req.DefaultCurrency,
			SupportedLanguages:    pq.StringArray(req.SupportedLanguages),
			SupportEmail:          req.SupportEmail,
			SupportChannels:       pq.StringArray(req.SupportChannels),
			SocialLinks:           models.StringMap(req.SocialLinks),
			FulfillmentMethod:     req.FulfillmentMethod,
			ShippingCarriers:      pq.StringArray(req.ShippingCarriers),
			ReturnsPolicyURL:      req.ReturnsPolicyURL,
			PaymentGateways:       pq.StringArray(req.PaymentGateways),
			TaxIdentifiers:        models.StringMap(req.TaxIdentifiers),
			PrimaryContacts:       models.ContactArray(req.PrimaryContacts),
			ComplianceContacts:    models.ContactArray(req.ComplianceContacts),
			EcommercePlatforms:    models.PlatformArray(req.EcommercePlatforms),
			KeySystems:            pq.StringArray(req.KeySystems),
			HolidayBlackoutDates:  pq.StringArray(req.HolidayBlackoutDates),
			DataProcessingAddenda: req.DataProcessingAddenda,
		}
		if err := s.db.Create(&profile).Error; err != nil {
			s.logger.LogUser(c.Request.Context(), models.LogLevelError, "ORG_BUSINESS_PROFILE_CREATE_FAILED",
				"Failed to create organization business profile",
				services.WithUserID(userID),
				services.WithOrganizationID(orgID),
			)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create organization business profile"})
			return
		}
		s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORG_BUSINESS_PROFILE_CREATE",
			"Organization business profile created",
			services.WithUserID(userID),
			services.WithOrganizationID(orgID),
		)
	} else {
		// Update existing business profile
		profile.BusinessHours = req.BusinessHours
		profile.PrimaryMarkets = pq.StringArray(req.PrimaryMarkets)
		profile.DefaultCurrency = req.DefaultCurrency
		profile.SupportedLanguages = pq.StringArray(req.SupportedLanguages)
		profile.SupportEmail = req.SupportEmail
		profile.SupportChannels = pq.StringArray(req.SupportChannels)
		profile.SocialLinks = models.StringMap(req.SocialLinks)
		profile.FulfillmentMethod = req.FulfillmentMethod
		profile.ShippingCarriers = pq.StringArray(req.ShippingCarriers)
		profile.ReturnsPolicyURL = req.ReturnsPolicyURL
		profile.PaymentGateways = pq.StringArray(req.PaymentGateways)
		profile.TaxIdentifiers = models.StringMap(req.TaxIdentifiers)
		profile.PrimaryContacts = models.ContactArray(req.PrimaryContacts)
		profile.ComplianceContacts = models.ContactArray(req.ComplianceContacts)
		profile.EcommercePlatforms = models.PlatformArray(req.EcommercePlatforms)
		profile.KeySystems = pq.StringArray(req.KeySystems)
		profile.HolidayBlackoutDates = pq.StringArray(req.HolidayBlackoutDates)
		profile.DataProcessingAddenda = req.DataProcessingAddenda

		if err := s.db.Save(&profile).Error; err != nil {
			s.logger.LogUser(c.Request.Context(), models.LogLevelError, "ORG_BUSINESS_PROFILE_UPDATE_FAILED",
				"Failed to update organization business profile",
				services.WithUserID(userID),
				services.WithOrganizationID(orgID),
			)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update organization business profile"})
			return
		}
		s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORG_BUSINESS_PROFILE_UPDATE",
			"Organization business profile updated",
			services.WithUserID(userID),
			services.WithOrganizationID(orgID),
		)
	}

	c.JSON(http.StatusOK, toBusinessProfileResponse(profile))
}

// GetOrgBusinessProfile gets organization business profile
// @Summary Get organization business profile
// @Description Retrieves the business profile of an organization. Only organization admins can view it.
// @Tags organization-business-profile
// @Produce json
// @Param id path string true "Organization ID"
// @Success 200 {object} models.OrganizationBusinessProfileResponse "Organization business profile retrieved successfully"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden – Only admin can view business profile"
// @Failure 404 {object} map[string]string "Business profile not found"
// @Router /organizations/{id}/business-profile [get]
func (s *OrgBusinessProfileService) GetOrgBusinessProfile(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		return
	}

	// Get user ID from context
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

	// Check if user is admin
	if !s.checkIsAdmin(userID, orgID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admin can view organization business profile"})
		return
	}

	var profile models.OrganizationBusinessProfile
	if err := s.db.First(&profile, "organization_id = ?", orgID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization business profile not found"})
		return
	}

	c.JSON(http.StatusOK, toBusinessProfileResponse(profile))
}

// DeleteOrgBusinessProfile deletes organization business profile
// @Summary Delete organization business profile
// @Description Deletes an organization's business profile. Only organization admins can perform this action.
// @Tags organization-business-profile
// @Param id path string true "Organization ID"
// @Success 200 {object} map[string]string "Organization business profile deleted successfully"
// @Failure 400 {object} map[string]string "Invalid request"
// @Failure 401 {object} map[string]string "Unauthorized"
// @Failure 403 {object} map[string]string "Forbidden – Only admin can delete business profile"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id}/business-profile [delete]
func (s *OrgBusinessProfileService) DeleteOrgBusinessProfile(c *gin.Context) {
	orgID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid organization ID"})
		return
	}

	// Get user ID from context
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

	// Check if user is admin
	if !s.checkIsAdmin(userID, orgID) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admin can delete organization business profile"})
		return
	}

	if err := s.db.Delete(&models.OrganizationBusinessProfile{}, "organization_id = ?", orgID).Error; err != nil {
		s.logger.LogUser(c.Request.Context(), models.LogLevelError, "ORG_BUSINESS_PROFILE_DELETE_FAILED",
			"Failed to delete organization business profile",
			services.WithUserID(userID),
			services.WithOrganizationID(orgID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete organization business profile"})
		return
	}

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "ORG_BUSINESS_PROFILE_DELETE",
		"Organization business profile deleted",
		services.WithUserID(userID),
		services.WithOrganizationID(orgID),
	)

	c.JSON(http.StatusOK, gin.H{"message": "Organization business profile deleted successfully"})
}

// Helper function to convert OrganizationBusinessProfile to OrganizationBusinessProfileResponse
func toBusinessProfileResponse(profile models.OrganizationBusinessProfile) models.OrganizationBusinessProfileResponse {
	return models.OrganizationBusinessProfileResponse{
		ID:                    profile.ID,
		OrganizationID:        profile.OrganizationID,
		BusinessHours:         profile.BusinessHours,
		PrimaryMarkets:        []string(profile.PrimaryMarkets),
		DefaultCurrency:       profile.DefaultCurrency,
		SupportedLanguages:    []string(profile.SupportedLanguages),
		SupportEmail:          profile.SupportEmail,
		SupportChannels:       []string(profile.SupportChannels),
		SocialLinks:           map[string]string(profile.SocialLinks),
		FulfillmentMethod:     profile.FulfillmentMethod,
		ShippingCarriers:      []string(profile.ShippingCarriers),
		ReturnsPolicyURL:      profile.ReturnsPolicyURL,
		PaymentGateways:       []string(profile.PaymentGateways),
		TaxIdentifiers:        map[string]string(profile.TaxIdentifiers),
		PrimaryContacts:       []models.OrgContact(profile.PrimaryContacts),
		ComplianceContacts:    []models.OrgContact(profile.ComplianceContacts),
		EcommercePlatforms:    []models.OrgPlatform(profile.EcommercePlatforms),
		KeySystems:            []string(profile.KeySystems),
		HolidayBlackoutDates:  []string(profile.HolidayBlackoutDates),
		DataProcessingAddenda: profile.DataProcessingAddenda,
		CreatedAt:             profile.CreatedAt,
		UpdatedAt:             profile.UpdatedAt,
	}
}
