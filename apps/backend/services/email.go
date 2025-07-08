package services

import (
	"context"
	"fmt"
	"log"
	"os"

	"github.com/sendinblue/APIv3-go-library/v2/lib"
)

type EmailService struct {
	client      *lib.APIClient
	senderEmail string
	senderName  string
	frontendURL string
}

// NewEmailService creates a new email service instance
func NewEmailService() *EmailService {
	// Configure API client
	cfg := lib.NewConfiguration()
	cfg.AddDefaultHeader("api-key", os.Getenv("SENDGRID_API_KEY")) // Using SENDGRID_API_KEY env var for Brevo key

	return &EmailService{
		client:      lib.NewAPIClient(cfg),
		senderEmail: os.Getenv("SENDER_EMAIL"),
		senderName:  os.Getenv("SENDER_NAME"),
		frontendURL: os.Getenv("FRONTEND_URL"),
	}
}

// SendVerificationEmail sends an email verification link to the user
func (e *EmailService) SendVerificationEmail(toEmail, firstName, verificationToken string) error {
	verificationURL := fmt.Sprintf("%s/verify-email?token=%s", e.frontendURL, verificationToken)

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
        .button { background-color: #4CAF50; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        .footer { color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to %s!</h1>
    </div>
    <div class="content">
        <h2>Hi %s,</h2>
        <p>Thank you for signing up! To complete your registration, please verify your email address by clicking the button below:</p>
        
        <a href="%s" class="button">Verify Email Address</a>
        
        <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">%s</p>
        
        <p><strong>Important:</strong> This link will expire in 24 hours for security reasons.</p>
        
        <div class="footer">
            <p>If you didn't create an account, please ignore this email.</p>
            <p>© 2024 %s. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
		`, e.senderName, firstName, verificationURL, verificationURL, e.senderName),

		TextContent: fmt.Sprintf(`
Hi %s,

Welcome to %s!

Thank you for signing up! To complete your registration, please verify your email address by clicking the link below:

%s

This link will expire in 24 hours for security reasons.

If you didn't create an account, please ignore this email.

© 2024 %s. All rights reserved.
		`, firstName, e.senderName, verificationURL, e.senderName),
	}

	// Send email
	_, _, err := e.client.TransactionalEmailsApi.SendTransacEmail(context.Background(), sendEmail)
	if err != nil {
		log.Printf("Failed to send verification email to %s: %v", toEmail, err)
		return fmt.Errorf("failed to send verification email: %w", err)
	}

	log.Printf("Verification email sent successfully to %s", toEmail)
	return nil
}

// SendPasswordResetEmail sends a password reset link to the user
func (e *EmailService) SendPasswordResetEmail(toEmail, firstName, resetToken string) error {
	resetURL := fmt.Sprintf("%s/reset-password?token=%s", e.frontendURL, resetToken)

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
        .button { background-color: #FF6B6B; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; margin: 20px 0; }
        .footer { color: #666; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Password Reset Request</h1>
    </div>
    <div class="content">
        <h2>Hi %s,</h2>
        <p>You requested to reset your password. Click the button below to create a new password:</p>
        
        <a href="%s" class="button">Reset Password</a>
        
        <p>If the button doesn't work, you can also copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #666;">%s</p>
        
        <p><strong>Important:</strong> This link will expire in 1 hour for security reasons.</p>
        
        <div class="footer">
            <p>If you didn't request this password reset, please ignore this email.</p>
            <p>© 2024 %s. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
		`, firstName, resetURL, resetURL, e.senderName),

		TextContent: fmt.Sprintf(`
Hi %s,

You requested to reset your password. Use the link below to create a new password:

%s

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email.

© 2024 %s. All rights reserved.
		`, firstName, resetURL, e.senderName),
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

// Helper function to get environment variable with default
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
