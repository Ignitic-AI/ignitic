package services

import (
	"context"
	"fmt"
	"log"
	"os"

	"backend/models"

	"github.com/sendinblue/APIv3-go-library/v2/lib"
)

type InvitationEmailService struct {
	client      *lib.APIClient
	senderEmail string
	senderName  string
	baseURL     string
	apiKey      string
}

// NewInvitationEmailService creates a new invitation email service instance
func NewInvitationEmailService() *InvitationEmailService {
	// Configure API client
	cfg := lib.NewConfiguration()
	cfg.AddDefaultHeader("api-key", os.Getenv("BREVO_API_KEY")) 

	apiKey := os.Getenv("BREVO_API_KEY")
	baseURL := os.Getenv("FRONTEND_URL")
	if baseURL == "" {
		baseURL = "http://localhost:3000" 
	}

	return &InvitationEmailService{
		client:      lib.NewAPIClient(cfg),
		senderEmail: os.Getenv("SENDER_EMAIL"),
		senderName:  os.Getenv("SENDER_NAME"),
		baseURL:     baseURL,
		apiKey:      apiKey,
	}
}

// SendInvitation sends an invitation email to join an organization
func (s *InvitationEmailService) SendInvitation(invitation models.OrganizationInvitation, organization models.Organization) error {
	log.Printf("📧 Starting invitation email process for: %s", invitation.Email)
	log.Printf("🔧 Email service config - Sender: %s <%s>, API Key: %s", s.senderName, s.senderEmail, maskAPIKey(s.apiKey))

	// Validate email service configuration
	if s.senderEmail == "" {
		log.Printf("❌ ERROR: SENDER_EMAIL is not configured")
		return fmt.Errorf("sender email not configured")
	}

	if s.senderName == "" {
		log.Printf("❌ ERROR: SENDER_NAME is not configured")
		return fmt.Errorf("sender name not configured")
	}

	if s.apiKey == "" {
		log.Printf("❌ ERROR: BREVO_API_KEY is not configured")
		return fmt.Errorf("API key not configured")
	}

	invitationLink := fmt.Sprintf("%s/invite/%s", s.baseURL, invitation.ID)

	// Create email request
	sendEmail := lib.SendSmtpEmail{
		Sender: &lib.SendSmtpEmailSender{
			Name:  s.senderName,
			Email: s.senderEmail,
		},
		To: []lib.SendSmtpEmailTo{
			{
				Email: invitation.Email,
				Name:  invitation.Email, // We don't have the user's name yet
			},
		},
		Subject: fmt.Sprintf("You're invited to join %s", organization.Name),
		HtmlContent: fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Organization Invitation</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; text-align: center; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        .footer { color: #666; font-size: 12px; margin-top: 30px; }
        .role-badge { background-color: #2196F3; color: white; padding: 5px 15px; border-radius: 20px; display: inline-block; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>You're Invited!</h1>
    </div>
    <div class="content">
        <h2>Hello!</h2>
        <p>You've been invited to join <strong>%s</strong> on our platform.</p>
        
        <div class="role-badge">Role: %s</div>
        
        <p>Click the button below to accept the invitation and create your account:</p>
        
        <a href="%s" class="button">Accept Invitation</a>
        
        <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">%s</p>
        
        <p><strong>Important:</strong> This invitation expires on <strong>%s</strong>.</p>
        
        <div class="footer">
            <p>If you didn't expect this invitation, please ignore this email.</p>
            <p>© 2024 %s. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
		`, organization.Name, invitation.Role, invitationLink, invitationLink, invitation.ExpiresAt.Format("January 2, 2006"), s.senderName),

		TextContent: fmt.Sprintf(`
Hello!

You've been invited to join %s on our platform.

Role: %s

Click the link below to accept the invitation and create your account:

%s

This invitation expires on %s.

If you didn't expect this invitation, please ignore this email.

© 2024 %s. All rights reserved.
		`, organization.Name, invitation.Role, invitationLink, invitation.ExpiresAt.Format("January 2, 2006"), s.senderName),
	}

	log.Printf("📝 Invitation email content prepared - Subject: 'You're invited to join %s', Recipient: %s", organization.Name, invitation.Email)
	log.Printf("🔗 Invitation link: %s", invitationLink)

	// Send email with detailed error handling
	log.Printf("📤 Attempting to send invitation email via API...")
	response, httpResp, err := s.client.TransactionalEmailsApi.SendTransacEmail(context.Background(), sendEmail)

	if err != nil {
		log.Printf("❌ INVITATION EMAIL SEND FAILED for %s:", invitation.Email)
		log.Printf("   Error: %v", err)
		if httpResp != nil {
			log.Printf("   HTTP Status: %d", httpResp.StatusCode)
			log.Printf("   HTTP Headers: %v", httpResp.Header)
		}
		return fmt.Errorf("failed to send invitation email: %w", err)
	}

	if httpResp != nil {
		log.Printf("✅ INVITATION EMAIL SEND SUCCESS for %s:", invitation.Email)
		log.Printf("   HTTP Status: %d", httpResp.StatusCode)
		log.Printf("   Response: %+v", response)
		log.Printf("   Message ID: %v", response.MessageId)
	} else {
		log.Printf("⚠️  INVITATION EMAIL SEND - No HTTP response received for %s", invitation.Email)
	}

	log.Printf("📧 Invitation email sent successfully to %s", invitation.Email)
	return nil
}

// SendInvitationReminder sends a reminder for pending invitations
func (s *InvitationEmailService) SendInvitationReminder(invitation models.OrganizationInvitation, organization models.Organization) error {
	log.Printf("📧 Starting invitation reminder email process for: %s", invitation.Email)

	// Validate email service configuration
	if s.senderEmail == "" || s.senderName == "" || s.apiKey == "" {
		return fmt.Errorf("email service not properly configured")
	}

	invitationLink := fmt.Sprintf("%s/invite/%s", s.baseURL, invitation.ID)

	// Create email request
	sendEmail := lib.SendSmtpEmail{
		Sender: &lib.SendSmtpEmailSender{
			Name:  s.senderName,
			Email: s.senderEmail,
		},
		To: []lib.SendSmtpEmailTo{
			{
				Email: invitation.Email,
				Name:  invitation.Email,
			},
		},
		Subject: fmt.Sprintf("Reminder: Join %s - Invitation Expiring Soon", organization.Name),
		HtmlContent: fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invitation Reminder</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #FF9800; color: white; text-align: center; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { background-color: #FF9800; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        .footer { color: #666; font-size: 12px; margin-top: 30px; }
        .role-badge { background-color: #2196F3; color: white; padding: 5px 15px; border-radius: 20px; display: inline-block; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Don't Miss Out!</h1>
    </div>
    <div class="content">
        <h2>Hello!</h2>
        <p>This is a friendly reminder that you have a pending invitation to join <strong>%s</strong>.</p>
        
        <div class="role-badge">Role: %s</div>
        
        <p>Don't miss out! Click the button below to accept the invitation:</p>
        
        <a href="%s" class="button">Accept Invitation</a>
        
        <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">%s</p>
        
        <p><strong>Important:</strong> This invitation expires on <strong>%s</strong>.</p>
        
        <div class="footer">
            <p>If you didn't expect this invitation, please ignore this email.</p>
            <p>© 2024 %s. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
		`, organization.Name, invitation.Role, invitationLink, invitationLink, invitation.ExpiresAt.Format("January 2, 2006"), s.senderName),

		TextContent: fmt.Sprintf(`
Hello!

This is a friendly reminder that you have a pending invitation to join %s.

Role: %s

Don't miss out! Click the link below to accept the invitation:

%s

This invitation expires on %s.

If you didn't expect this invitation, please ignore this email.

© 2024 %s. All rights reserved.
		`, organization.Name, invitation.Role, invitationLink, invitation.ExpiresAt.Format("January 2, 2006"), s.senderName),
	}

	// Send email
	_, _, err := s.client.TransactionalEmailsApi.SendTransacEmail(context.Background(), sendEmail)
	if err != nil {
		log.Printf("Failed to send invitation reminder email to %s: %v", invitation.Email, err)
		return fmt.Errorf("failed to send invitation reminder email: %w", err)
	}

	log.Printf("Invitation reminder email sent successfully to %s", invitation.Email)
	return nil
}
