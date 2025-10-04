package services

import (
	"context"
	"fmt"
	"log"
	"os"

	"backend/models"

	"github.com/sendinblue/APIv3-go-library/v2/lib"
)

type EmailService struct {
	client      *lib.APIClient
	senderEmail string
	senderName  string
	frontendURL string
	apiKey      string
}

// NewEmailService creates a new email service instance
func NewEmailService() *EmailService {
	// Configure API client
	cfg := lib.NewConfiguration()
	cfg.AddDefaultHeader("api-key", os.Getenv("BREVO_API_KEY"))

	apiKey := os.Getenv("BREVO_API_KEY")
	return &EmailService{
		client:      lib.NewAPIClient(cfg),
		senderEmail: os.Getenv("SENDER_EMAIL"),
		senderName:  os.Getenv("SENDER_NAME"),
		frontendURL: os.Getenv("FRONTEND_URL"),
		apiKey:      apiKey,
	}
}

// SendVerificationEmail sends an email verification code to the user
func (e *EmailService) SendVerificationEmail(toEmail, firstName, verificationToken string) error {
	log.Printf("📧 Starting email verification process for: %s", toEmail)
	log.Printf("🔧 Email service config - Sender: %s <%s>, API Key: %s", e.senderName, e.senderEmail, maskAPIKey(e.apiKey))

	// Validate email service configuration
	if e.senderEmail == "" {
		log.Printf("❌ ERROR: SENDER_EMAIL is not configured")
		return fmt.Errorf("sender email not configured")
	}

	if e.senderName == "" {
		log.Printf("❌ ERROR: SENDER_NAME is not configured")
		return fmt.Errorf("sender name not configured")
	}

	if e.apiKey == "" {
		log.Printf("❌ ERROR: BREVO_API_KEY is not configured")
		return fmt.Errorf("API key not configured")
	}

	// Create email request
	sendEmail := lib.SendSmtpEmail{
		Sender: &lib.SendSmtpEmailSender{
			Name:  e.senderName,
			Email: e.senderEmail,
		},
		To: []lib.SendSmtpEmailTo{
			{
				Email: toEmail,
				Name:  firstName,
			},
		},
		Subject: "Verify Your Email Address",
		HtmlContent: fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Email Verification</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; text-align: center; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .code { background-color: #f0f0f0; font-size: 32px; font-weight: bold; text-align: center; padding: 20px; margin: 20px 0; border-radius: 8px; letter-spacing: 3px; color: #333; }
        .footer { color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to %s!</h1>
    </div>
    <div class="content">
        <h2>Hi %s,</h2>
        <p>Thank you for signing up! To complete your registration, please use the following verification code:</p>
        
        <div class="code">%s</div>
        
        <p>Use this code with the endpoint: <strong>POST /api/v1/auth/verify-email</strong></p>
        
        <p><strong>Important:</strong> This code will expire in 24 hours for security reasons.</p>
        
        <div class="footer">
            <p>If you didn't create an account, please ignore this email.</p>
            <p>© 2024 %s. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
		`, e.senderName, firstName, verificationToken, e.senderName),

		TextContent: fmt.Sprintf(`
Hi %s,

Welcome to %s!

Thank you for signing up! To complete your registration, please use the following verification code:

VERIFICATION CODE: %s

Use this code with the endpoint: POST /api/v1/auth/verify-email

This code will expire in 24 hours for security reasons.

If you didn't create an account, please ignore this email.

© 2024 %s. All rights reserved.
		`, firstName, e.senderName, verificationToken, e.senderName),
	}

	log.Printf("📝 Email content prepared - Subject: 'Verify Your Email Address', Recipient: %s", toEmail)
	log.Printf("🔑 Verification code: %s", verificationToken)

	// Send email with detailed error handling
	log.Printf("📤 Attempting to send email via API...")
	response, httpResp, err := e.client.TransactionalEmailsApi.SendTransacEmail(context.Background(), sendEmail)

	if err != nil {
		log.Printf("❌ EMAIL SEND FAILED for %s:", toEmail)
		log.Printf("   Error: %v", err)
		if httpResp != nil {
			log.Printf("   HTTP Status: %d", httpResp.StatusCode)
			log.Printf("   HTTP Headers: %v", httpResp.Header)
		}
		return fmt.Errorf("failed to send verification email: %w", err)
	}

	if httpResp != nil {
		log.Printf("✅ EMAIL SEND SUCCESS for %s:", toEmail)
		log.Printf("   HTTP Status: %d", httpResp.StatusCode)
		log.Printf("   Response: %+v", response)
		log.Printf("   Message ID: %v", response.MessageId)
	} else {
		log.Printf("⚠️  EMAIL SEND - No HTTP response received for %s", toEmail)
	}

	log.Printf("📧 Verification email sent successfully to %s", toEmail)
	return nil
}

// SendPasswordResetEmail sends a password reset token to the user
func (e *EmailService) SendPasswordResetEmail(toEmail, firstName, resetToken string) error {
	// Create email request
	sendEmail := lib.SendSmtpEmail{
		Sender: &lib.SendSmtpEmailSender{
			Name:  e.senderName,
			Email: e.senderEmail,
		},
		To: []lib.SendSmtpEmailTo{
			{
				Email: toEmail,
				Name:  firstName,
			},
		},
		Subject: "Reset Your Password",
		HtmlContent: fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Password Reset</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #FF6B6B; color: white; text-align: center; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .code { background-color: #f0f0f0; font-size: 24px; font-weight: bold; text-align: center; padding: 20px; margin: 20px 0; border-radius: 8px; letter-spacing: 2px; color: #333; word-break: break-all; }
        .footer { color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Password Reset Request</h1>
    </div>
    <div class="content">
        <h2>Hi %s,</h2>
        <p>You requested to reset your password. Use the following reset token:</p>
        
        <div class="code">%s</div>
        
        <p>Use this token with the endpoint: <strong>POST /api/v1/auth/reset-password</strong></p>
        
        <p><strong>Important:</strong> This token will expire in 1 hour for security reasons.</p>
        
        <div class="footer">
            <p>If you didn't request this password reset, please ignore this email.</p>
            <p>© 2024 %s. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
		`, firstName, resetToken, e.senderName),

		TextContent: fmt.Sprintf(`
Hi %s,

You requested to reset your password. Use the following reset token:

RESET TOKEN: %s

Use this token with the endpoint: POST /api/v1/auth/reset-password

This token will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email.

© 2024 %s. All rights reserved.
		`, firstName, resetToken, e.senderName),
	}

	// Send email
	_, _, err := e.client.TransactionalEmailsApi.SendTransacEmail(context.Background(), sendEmail)
	if err != nil {
		log.Printf("Failed to send password reset email to %s: %v", toEmail, err)
		return fmt.Errorf("failed to send password reset email: %w", err)
	}

	log.Printf("Password reset email sent successfully to %s", toEmail)
	return nil
}

// SendInvitation sends an organization invitation email to the user
func (e *EmailService) SendInvitation(invitation models.OrganizationInvitation, organization models.Organization) error {
	// Create invitation URL
	invitationURL := fmt.Sprintf("%s/join-organization?token=%s", e.frontendURL, invitation.ID)

	// Create email request
	sendEmail := lib.SendSmtpEmail{
		Sender: &lib.SendSmtpEmailSender{
			Name:  e.senderName,
			Email: e.senderEmail,
		},
		To: []lib.SendSmtpEmailTo{
			{
				Email: invitation.Email,
				Name:  invitation.Email,
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
    </style>
</head>
<body>
    <div class="header">
        <h1>Organization Invitation</h1>
    </div>
    <div class="content">
        <h2>You're invited!</h2>
        <p>You have been invited to join <strong>%s</strong> with the role of <strong>%s</strong>.</p>
        
        <a href="%s" class="button">Accept Invitation</a>
        
        <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">%s</p>
        
        <p><strong>Important:</strong> This invitation will expire in 7 days.</p>
        
        <div class="footer">
            <p>If you didn't expect this invitation, please ignore this email.</p>
            <p>© 2024 %s. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
		`, organization.Name, invitation.Role, invitationURL, invitationURL, e.senderName),

		TextContent: fmt.Sprintf(`
You're invited!

You have been invited to join %s with the role of %s.

Accept your invitation by visiting: %s

This invitation will expire in 7 days.

If you didn't expect this invitation, please ignore this email.

© 2024 %s. All rights reserved.
		`, organization.Name, invitation.Role, invitationURL, e.senderName),
	}

	// Send email
	_, _, err := e.client.TransactionalEmailsApi.SendTransacEmail(context.Background(), sendEmail)
	if err != nil {
		log.Printf("Failed to send invitation email to %s: %v", invitation.Email, err)
		return fmt.Errorf("failed to send invitation email: %w", err)
	}

	log.Printf("Invitation email sent successfully to %s", invitation.Email)
	return nil
}

// Helper function to get environment variable with default
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// Helper function to mask API key for logging
func maskAPIKey(apiKey string) string {
	if len(apiKey) <= 8 {
		return "***"
	}
	return apiKey[:4] + "..." + apiKey[len(apiKey)-4:]
}
