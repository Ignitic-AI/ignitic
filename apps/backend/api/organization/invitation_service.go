package organization

import (
	"context"
	"net/http"
	"time"

	"backend/database"
	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type InvitationService struct {
	db     *database.DB
	logger *services.DatabaseLogger
}

// NewInvitationService creates a new invitation service instance
func NewInvitationService(db *database.DB) *InvitationService {
	return &InvitationService{
		db:     db,
		logger: services.NewDatabaseLogger(db),
	}
}

// InviteMember invites a new member to an organization
// @Summary Invite a member to an organization
// @Description Sends an invitation to a user via email to join an organization with a specified role. Only organization admins can send invitations.
// @Tags invitations
// @Param id path string true "Organization ID"
// @Param inviteData body struct{Email string; Role string} true "Invitation request payload"
// @Success 201 {object} map[string]interface{} "Invitation sent successfully"
// @Failure 400 {object} map[string]string "Invalid request or ID format"
// @Failure 401 {object} map[string]string "Unauthorized – user not authenticated"
// @Failure 403 {object} map[string]string "Forbidden – only admins can invite members"
// @Failure 404 {object} map[string]string "Organization not found"
// @Failure 409 {object} map[string]string "Conflict – user already a member or pending invitation exists"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id}/invite [post]
func (s *InvitationService) InviteMember(c *gin.Context) {
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

	var inviteData struct {
		Email string `json:"email" binding:"required,email"`
		Role  string `json:"role" binding:"required"`
	}

	if err := c.ShouldBindJSON(&inviteData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate role
	if inviteData.Role != "admin" && inviteData.Role != "member" && inviteData.Role != "viewer" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Must be 'admin', 'member', or 'viewer'"})
		return
	}

	// Check if organization exists
	var organization models.Organization
	if err := s.db.Where("id = ?", orgUUID).First(&organization).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	// Check if the invited user is already a member (by email)
	var existingUser models.User
	if err := s.db.Where("email = ?", inviteData.Email).First(&existingUser).Error; err == nil {
		// User exists, check if they're already a member of this organization
		var existingMember models.UserOrganization
		if err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true",
			existingUser.ID, orgUUID).First(&existingMember).Error; err == nil {
			c.JSON(http.StatusConflict, gin.H{"error": "User with this email is already a member of this organization"})
			return
		}
	}

	// Check if there's already a pending invitation for this email and organization
	var existingInvitation models.OrganizationInvitation
	if err := s.db.Where("email = ? AND organization_id = ? AND status = 'pending'", inviteData.Email, orgUUID).First(&existingInvitation).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "An invitation is already pending for this email"})
		return
	}

	// Create invitation (expires in 7 days)
	invitation := models.OrganizationInvitation{
		OrganizationID: orgUUID,
		Email:          inviteData.Email,
		Role:           inviteData.Role,
		Status:         "pending",
		InvitedBy:      userUUID,
		ExpiresAt:      time.Now().AddDate(0, 0, 7), // 7 days from now
	}

	if err := s.db.Create(&invitation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create invitation"})
		return
	}

	// Send invitation email
	go s.sendInvitationEmail(invitation, organization)

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "INVITATION_SENT",
		"Invitation sent to "+inviteData.Email,
		services.WithUserID(userUUID),
		services.WithOrganizationID(orgUUID),
		services.WithMetadata(map[string]interface{}{"invited_email": inviteData.Email, "role": inviteData.Role}),
	)

	c.JSON(http.StatusCreated, gin.H{
		"message": "Invitation sent successfully",
		"invitation": gin.H{
			"id":         invitation.ID,
			"email":      invitation.Email,
			"role":       invitation.Role,
			"status":     invitation.Status,
			"expires_at": invitation.ExpiresAt,
		},
	})
}

// AcceptInvitation accepts an invitation to join an organization
// @Summary Accept organization invitation
// @Description Allows a user to accept a pending organization invitation sent to their email.
// @Tags invitations
// @Param id path string true "Invitation ID"
// @Success 200 {object} map[string]interface{} "Successfully joined organization"
// @Failure 400 {object} map[string]string "Invalid request or invitation expired"
// @Failure 401 {object} map[string]string "Unauthorized – user not authenticated"
// @Failure 403 {object} map[string]string "Forbidden – email mismatch"
// @Failure 404 {object} map[string]string "Invitation not found or already processed"
// @Failure 409 {object} map[string]string "Conflict – user already a member"
// @Failure 500 {object} map[string]string "Server error"
// @Router /invitations/{id}/accept [post]
func (s *InvitationService) AcceptInvitation(c *gin.Context) {
	invitationID := c.Param("id")
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

	invitationUUID, err := uuid.Parse(invitationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invitation ID format"})
		return
	}

	// Find the invitation
	var invitation models.OrganizationInvitation
	if err := s.db.Where("id = ? AND status = 'pending'", invitationUUID).First(&invitation).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found or already processed"})
		return
	}

	// Check if invitation has expired
	if time.Now().After(invitation.ExpiresAt) {
		invitation.Status = "expired"
		s.db.Save(&invitation)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invitation has expired"})
		return
	}

	// Check if user email matches invitation email
	var user models.User
	if err := s.db.Where("id = ?", userUUID).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User not found"})
		return
	}

	if user.Email != invitation.Email {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only accept invitations sent to your email address"})
		return
	}

	// Check if user is already a member
	var existingMember models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true", userUUID, invitation.OrganizationID).First(&existingMember).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "You are already a member of this organization"})
		return
	}

	// Add user to organization
	userOrg := models.UserOrganization{
		UserID:         userUUID,
		OrganizationID: invitation.OrganizationID,
		Role:           invitation.Role,
		IsActive:       true,
	}

	if err := s.db.Create(&userOrg).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join organization"})
		return
	}

	// Mark invitation as accepted
	invitation.Status = "accepted"
	if err := s.db.Save(&invitation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update invitation status"})
		return
	}

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "INVITATION_ACCEPTED",
		"Invitation accepted",
		services.WithUserID(userUUID),
		services.WithOrganizationID(invitation.OrganizationID),
	)

	c.JSON(http.StatusOK, gin.H{
		"message":         "Successfully joined organization",
		"organization_id": invitation.OrganizationID,
		"role":            invitation.Role,
	})
}

// ListInvitations lists all invitations for an organization
// @Summary List organization invitations
// @Description Retrieves all invitations (pending, expired, accepted) for a given organization. Only admins can view.
// @Tags invitations
// @Param id path string true "Organization ID"
// @Success 200 {object} map[string]interface{} "List of invitations"
// @Failure 400 {object} map[string]string "Invalid request or ID format"
// @Failure 401 {object} map[string]string "Unauthorized – user not authenticated"
// @Failure 403 {object} map[string]string "Forbidden – only admins can view invitations"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id}/invitations [get]
func (s *InvitationService) ListInvitations(c *gin.Context) {
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
	var adminCheck models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND role = 'admin' AND is_active = true", userUUID, orgUUID).First(&adminCheck).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	// Get all invitations for this organization
	var invitations []models.OrganizationInvitation
	if err := s.db.Where("organization_id = ?", orgUUID).Order("created_at DESC").Find(&invitations).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch invitations"})
		return
	}

	var invitationList []gin.H
	for _, invitation := range invitations {
		invitationList = append(invitationList, gin.H{
			"id":         invitation.ID,
			"email":      invitation.Email,
			"role":       invitation.Role,
			"status":     invitation.Status,
			"invited_by": invitation.InvitedBy,
			"expires_at": invitation.ExpiresAt,
			"created_at": invitation.CreatedAt,
			"is_expired": time.Now().After(invitation.ExpiresAt),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"invitations": invitationList,
		"total":       len(invitationList),
	})
}

// CancelInvitation cancels a pending invitation
// @Summary Cancel an organization invitation
// @Description Allows an admin to cancel a pending organization invitation. Only pending invitations can be canceled.
// @Tags invitations
// @Param id path string true "Organization ID"
// @Param invitationId path string true "Invitation ID"
// @Success 200 {object} map[string]string "Invitation cancelled successfully"
// @Failure 400 {object} map[string]string "Invalid request or invitation not pending"
// @Failure 401 {object} map[string]string "Unauthorized – user not authenticated"
// @Failure 403 {object} map[string]string "Forbidden – only admins can cancel invitations"
// @Failure 404 {object} map[string]string "Invitation not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id}/invitations/{invitationId} [delete]
func (s *InvitationService) CancelInvitation(c *gin.Context) {
	invitationID := c.Param("invitationId")
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

	invitationUUID, err := uuid.Parse(invitationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invitation ID format"})
		return
	}

	// Find the invitation
	var invitation models.OrganizationInvitation
	if err := s.db.Where("id = ?", invitationUUID).First(&invitation).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found"})
		return
	}

	// Check if current user is admin of this organization
	var adminCheck models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND role = 'admin' AND is_active = true", userUUID, invitation.OrganizationID).First(&adminCheck).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	// Only allow canceling pending invitations
	if invitation.Status != "pending" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only cancel pending invitations"})
		return
	}

	// Delete the invitation
	if err := s.db.Delete(&invitation).Error; err != nil {
		s.logger.LogUser(c.Request.Context(), models.LogLevelError, "INVITATION_CANCEL_FAILED",
			"Failed to cancel invitation",
			services.WithUserID(userUUID),
			services.WithOrganizationID(invitation.OrganizationID),
		)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel invitation"})
		return
	}

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "INVITATION_CANCELLED",
		"Invitation cancelled",
		services.WithUserID(userUUID),
		services.WithOrganizationID(invitation.OrganizationID),
		services.WithMetadata(map[string]interface{}{"invitation_id": invitationUUID.String()}),
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Invitation cancelled successfully",
	})
}

// ResendInvitation resends an expired invitation
// @Summary Resend an expired invitation
// @Description Allows an admin to resend an expired invitation, extending its expiration by 7 days.
// @Tags invitations
// @Param id path string true "Organization ID"
// @Param invitationId path string true "Invitation ID"
// @Success 200 {object} map[string]interface{} "Invitation resent successfully"
// @Failure 400 {object} map[string]string "Invalid request or invitation not expired"
// @Failure 401 {object} map[string]string "Unauthorized – user not authenticated"
// @Failure 403 {object} map[string]string "Forbidden – only admins can resend invitations"
// @Failure 404 {object} map[string]string "Invitation not found"
// @Failure 500 {object} map[string]string "Server error"
// @Router /organizations/{id}/invitations/{invitationId}/resend [post]
func (s *InvitationService) ResendInvitation(c *gin.Context) {
	invitationID := c.Param("invitationId")
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

	invitationUUID, err := uuid.Parse(invitationID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid invitation ID format"})
		return
	}

	// Find the invitation
	var invitation models.OrganizationInvitation
	if err := s.db.Where("id = ?", invitationUUID).First(&invitation).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Invitation not found"})
		return
	}

	// Check if current user is admin of this organization
	var adminCheck models.UserOrganization
	if err := s.db.Where("user_id = ? AND organization_id = ? AND role = 'admin' AND is_active = true", userUUID, invitation.OrganizationID).First(&adminCheck).Error; err != nil {
		c.JSON(http.StatusForbidden, gin.H{"error": "Admin access required"})
		return
	}

	// Only allow resending expired invitations
	if invitation.Status != "expired" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Can only resend expired invitations"})
		return
	}

	// Update invitation to pending and extend expiration
	invitation.Status = "pending"
	invitation.ExpiresAt = time.Now().AddDate(0, 0, 7) // 7 days from now
	invitation.UpdatedAt = time.Now()

	if err := s.db.Save(&invitation).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to resend invitation"})
		return
	}

	// Get organization details for email
	var organization models.Organization
	if err := s.db.Where("id = ?", invitation.OrganizationID).First(&organization).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get organization details"})
		return
	}

	// Resend invitation email
	go s.sendInvitationEmail(invitation, organization)

	s.logger.LogUser(c.Request.Context(), models.LogLevelInfo, "INVITATION_RESENT",
		"Invitation resent to "+invitation.Email,
		services.WithUserID(userUUID),
		services.WithOrganizationID(invitation.OrganizationID),
		services.WithMetadata(map[string]interface{}{"invited_email": invitation.Email}),
	)

	c.JSON(http.StatusOK, gin.H{
		"message": "Invitation resent successfully",
		"invitation": gin.H{
			"id":         invitation.ID,
			"email":      invitation.Email,
			"role":       invitation.Role,
			"status":     invitation.Status,
			"expires_at": invitation.ExpiresAt,
		},
	})
}

// sendInvitationEmail sends an invitation email to the user
func (s *InvitationService) sendInvitationEmail(invitation models.OrganizationInvitation, organization models.Organization) {
	emailService := services.NewEmailService()
	if err := emailService.SendInvitation(invitation, organization); err != nil {
		s.logger.LogUser(context.Background(), models.LogLevelError, "INVITATION_EMAIL_FAILED",
			"Failed to send invitation email to "+invitation.Email,
			services.WithOrganizationID(organization.ID),
			services.WithMetadata(map[string]interface{}{"invited_email": invitation.Email, "error": err.Error()}),
		)
	}
}

// AutoAcceptInvitationsForUser automatically accepts pending invitations when a user signs up
func (s *InvitationService) AutoAcceptInvitationsForUser(userEmail string, userID uuid.UUID) error {
	// Find all pending invitations for this email
	var invitations []models.OrganizationInvitation
	if err := s.db.Where("email = ? AND status = 'pending'", userEmail).Find(&invitations).Error; err != nil {
		return err
	}

	for _, invitation := range invitations {
		// Check if invitation has expired
		if time.Now().After(invitation.ExpiresAt) {
			invitation.Status = "expired"
			s.db.Save(&invitation)
			continue
		}

		// Check if user is already a member
		var existingMember models.UserOrganization
		if err := s.db.Where("user_id = ? AND organization_id = ? AND is_active = true", userID, invitation.OrganizationID).First(&existingMember).Error; err == nil {
			// User is already a member, mark invitation as accepted
			invitation.Status = "accepted"
			s.db.Save(&invitation)
			continue
		}

		// Add user to organization
		userOrg := models.UserOrganization{
			UserID:         userID,
			OrganizationID: invitation.OrganizationID,
			Role:           invitation.Role,
			IsActive:       true,
		}

		if err := s.db.Create(&userOrg).Error; err != nil {
			continue // Skip this invitation if there's an error
		}

		// Mark invitation as accepted
		invitation.Status = "accepted"
		s.db.Save(&invitation)
	}

	return nil
}
