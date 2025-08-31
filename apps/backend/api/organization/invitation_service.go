package organization

import (
	"net/http"
	"time"

	"backend/database"
	"backend/models"
	"backend/services"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type InvitationService struct {
	db *database.DB
}

// NewInvitationService creates a new invitation service instance
func NewInvitationService(db *database.DB) *InvitationService {
	return &InvitationService{
		db: db,
	}
}

// InviteMember invites a new member to an organization
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

	c.JSON(http.StatusOK, gin.H{
		"message":         "Successfully joined organization",
		"organization_id": invitation.OrganizationID,
		"role":            invitation.Role,
	})
}

// ListInvitations lists all invitations for an organization
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

// CancelInvitation allows admins to cancel pending invitations
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
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cancel invitation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Invitation cancelled successfully",
	})
}

// ResendInvitation allows admins to resend expired invitations
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
	// Use the email service
	emailService := services.NewEmailService()
	if err := emailService.SendInvitation(invitation, organization); err != nil {
		// Log error but don't fail the invitation creation
		// In production, you might want to handle this differently
		return
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
