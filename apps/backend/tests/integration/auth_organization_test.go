package integration_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"

	"backend/api/auth"
	orgapi "backend/api/organization"
	"backend/models"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func TestAuthAndOrganizationIntegrationFlow(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef")

	db := testutil.NewSQLiteDB(t,
		&models.User{},
		&models.Organization{},
		&models.UserOrganization{},
		&models.OrganizationInvitation{},
		&models.Log{},
	)

	authSvc := auth.NewAuthService(db, "integration-secret")
	orgSvc := orgapi.NewOrganizationService(db)
	inviteSvc := orgapi.NewInvitationService(db)

	registerBody := map[string]any{
		"first_name": "Ava",
		"last_name":  "Stone",
		"email":      "ava.integration@example.com",
		"password":   "StrongPass123!",
	}
	registerCtx, registerRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/auth/register", registerBody, nil)
	authSvc.Register(registerCtx)
	testutil.MustStatus(t, registerRec, http.StatusCreated)

	var user models.User
	if err := db.Where("email = ?", registerBody["email"]).First(&user).Error; err != nil {
		t.Fatalf("user not created: %v", err)
	}

	verifyCtx, verifyRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/auth/verify-email", map[string]any{
		"token": user.VerificationToken,
	}, nil)
	authSvc.VerifyEmail(verifyCtx)
	testutil.MustStatus(t, verifyRec, http.StatusOK)

	loginCtx, loginRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/auth/login", map[string]any{
		"email":    registerBody["email"],
		"password": registerBody["password"],
	}, nil)
	authSvc.Login(loginCtx)
	testutil.MustStatus(t, loginRec, http.StatusOK)

	var loginPayload map[string]any
	if err := json.Unmarshal(loginRec.Body.Bytes(), &loginPayload); err != nil {
		t.Fatalf("decode login response: %v", err)
	}
	if _, ok := loginPayload["token"].(string); !ok {
		t.Fatalf("login token missing: %v", loginPayload)
	}

	profileCtx, profileRec := testutil.EmptyContext(t, http.MethodGet, "/api/v1/auth/profile", nil)
	profileCtx.Set("user_id", user.ID.String())
	authSvc.GetProfile(profileCtx)
	testutil.MustStatus(t, profileRec, http.StatusOK)

	updateCtx, updateRec := testutil.JSONContext(t, http.MethodPut, "/api/v1/auth/profile", map[string]any{
		"first_name": "Ava",
		"last_name":  "Stone",
		"phone":      "+923001234567",
		"company":    "IgniticAI",
	}, nil)
	updateCtx.Set("user_id", user.ID.String())
	authSvc.UpdateProfile(updateCtx)
	testutil.MustStatus(t, updateRec, http.StatusOK)

	onboardingCtx, onboardingRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/auth/onboarding/personal", map[string]any{
		"has_organization":           false,
		"created_organization":       false,
		"org_name":                   "",
		"platform":                   "shopify",
		"work_on_multiple_platforms": true,
		"selected_brands":            []string{"brand-a", "brand-b"},
		"size_of_org":                "10-50",
		"your_role":                  "founder",
		"country":                    "Pakistan",
		"where_you_hear_us":          "referral",
		"preferred_automation_ids":   []string{"auto-1"},
		"invited_emails":             []string{},
	}, nil)
	onboardingCtx.Set("user_id", user.ID.String())
	authSvc.SavePersonalOnboarding(onboardingCtx)
	testutil.MustStatus(t, onboardingRec, http.StatusOK)

	forgotCtx, forgotRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/auth/forgot-password", map[string]any{
		"email": registerBody["email"],
	}, nil)
	authSvc.ForgotPassword(forgotCtx)
	testutil.MustStatus(t, forgotRec, http.StatusOK)

	if err := db.Where("id = ?", user.ID).First(&user).Error; err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if user.ResetToken == "" || user.ResetTokenExpiry == nil {
		t.Fatalf("reset token not stored")
	}

	resetCtx, resetRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/auth/reset-password", map[string]any{
		"token":        user.ResetToken,
		"new_password": "NewStrongPass123!",
	}, nil)
	authSvc.ResetPassword(resetCtx)
	testutil.MustStatus(t, resetRec, http.StatusOK)

	if err := db.Where("id = ?", user.ID).First(&user).Error; err != nil {
		t.Fatalf("reload user after reset: %v", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte("NewStrongPass123!")); err != nil {
		t.Fatalf("new password not saved: %v", err)
	}

	orgCtx, orgRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/organizations", map[string]any{
		"name":              "Integration Org",
		"description":       "integration coverage",
		"employee_count":    5,
		"company_size":      "1-10",
		"country":           "Pakistan",
		"creator_job_title": "Founder",
	}, nil)
	orgCtx.Set("user_id", user.ID.String())
	orgSvc.CreateOrganization(orgCtx)
	testutil.MustStatus(t, orgRec, http.StatusCreated)

	var orgResp struct {
		Organization models.Organization `json:"organization"`
	}
	if err := json.Unmarshal(orgRec.Body.Bytes(), &orgResp); err != nil {
		t.Fatalf("decode org response: %v", err)
	}
	if orgResp.Organization.ID == uuid.Nil {
		t.Fatalf("organization id missing")
	}

	listCtx, listRec := testutil.EmptyContext(t, http.MethodGet, "/api/v1/organizations", nil)
	listCtx.Set("user_id", user.ID.String())
	orgSvc.ListOrganizations(listCtx)
	testutil.MustStatus(t, listRec, http.StatusOK)

	inviteEmail := "member.integration@example.com"
	memberPassword := "MemberPass123!"
	memberHash, _ := bcrypt.GenerateFromPassword([]byte(memberPassword), bcrypt.DefaultCost)
	member := models.User{
		Email:             inviteEmail,
		Password:          string(memberHash),
		FirstName:         "Mia",
		LastName:          "Lane",
		Role:              "user",
		EmailVerified:     true,
		VerificationToken: "",
		IsActive:          true,
	}
	if err := db.Create(&member).Error; err != nil {
		t.Fatalf("create member user: %v", err)
	}

	inviteCtx, inviteRec := testutil.JSONContext(t, http.MethodPost, fmt.Sprintf("/api/v1/organizations/%s/invite", orgResp.Organization.ID), map[string]any{
		"email": inviteEmail,
		"role":  "member",
	}, gin.Params{{Key: "id", Value: orgResp.Organization.ID.String()}})
	inviteCtx.Set("user_id", user.ID.String())
	inviteSvc.InviteMember(inviteCtx)
	testutil.MustStatus(t, inviteRec, http.StatusCreated)

	var invitation models.OrganizationInvitation
	if err := db.Where("organization_id = ? AND email = ?", orgResp.Organization.ID, inviteEmail).First(&invitation).Error; err != nil {
		t.Fatalf("invitation not saved: %v", err)
	}

	acceptCtx, acceptRec := testutil.EmptyContext(t, http.MethodPost, fmt.Sprintf("/api/v1/invitations/%s/accept", invitation.ID), gin.Params{{Key: "id", Value: invitation.ID.String()}})
	acceptCtx.Set("user_id", member.ID.String())
	inviteSvc.AcceptInvitation(acceptCtx)
	testutil.MustStatus(t, acceptRec, http.StatusOK)

	var membershipCount int64
	if err := db.Table("user_organizations").
		Where("organization_id = ? AND is_active = true", orgResp.Organization.ID).
		Count(&membershipCount).Error; err != nil {
		t.Fatalf("count members: %v", err)
	}
	if membershipCount != 2 {
		t.Fatalf("unexpected membership count: %d", membershipCount)
	}

	if err := db.Where("id = ?", user.ID).First(&user).Error; err != nil {
		t.Fatalf("reload admin user: %v", err)
	}
	if time.Since(user.UpdatedAt) > 10*time.Minute {
		t.Fatalf("updatedAt not refreshed: %v", user.UpdatedAt)
	}
}
