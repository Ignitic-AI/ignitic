package organization

import (
	"backend/database"

	"github.com/gin-gonic/gin"
)

func SetupRoutes(rg *gin.RouterGroup, db *database.DB) {
	service := NewOrganizationService(db)
	businessProfileService := NewOrgBusinessProfileService(db)
	invitationService := NewInvitationService(db)

	org := rg.Group("/organizations")
	{
		// Organization CRUD
		org.POST("", service.CreateOrganization)    // Create organization
		org.GET("", service.ListOrganizations)      // List user's organizations
		org.GET("/:id", service.GetOrganization)    // Get organization details
		org.PUT("/:id", service.UpdateOrganization) // Update organization (admin only)
		org.DELETE("/:id", service.DeleteOrganization) // Delete organization (admin only)

		// Organization membership (self-service)
		org.POST("/:id/join", service.JoinOrganization)   // Join organization
		org.POST("/:id/leave", service.LeaveOrganization) // Leave organization

		// Member management (admin only)
		org.GET("/:id/members", service.ListMembers)                     // List organization members
		org.POST("/:id/members", service.AddMember)                      // Add member to organization
		org.DELETE("/:id/members/:memberId", service.RemoveMember)       // Remove member from organization
		org.PUT("/:id/members/:memberId/role", service.UpdateMemberRole) // Update member role

		// Organization Business Profile
		org.PUT("/:id/business-profile", businessProfileService.CreateOrUpdateOrgBusinessProfile) // Create/Update org business profile
		org.GET("/:id/business-profile", businessProfileService.GetOrgBusinessProfile)            // Get org business profile
		org.DELETE("/:id/business-profile", businessProfileService.DeleteOrgBusinessProfile)      // Delete org business profile

		// Organization Invitations
		org.POST("/:id/invite", invitationService.InviteMember)                               
		org.GET("/:id/invitations", invitationService.ListInvitations)                        
		org.DELETE("/:id/invitations/:invitationId", invitationService.CancelInvitation)      
		org.POST("/:id/invitations/:invitationId/resend", invitationService.ResendInvitation) 
	}

	invitations := rg.Group("/invitations")
	{
		invitations.POST("/:id/accept", invitationService.AcceptInvitation) // Accept invitation
	}
}
