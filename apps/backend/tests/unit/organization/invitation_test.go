package organization_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	backendapi "backend/api/organization"
	backendmodels "backend/models"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func newInvitationService(t *testing.T) (*backendapi.InvitationService, *gorm.DB) {
	t.Helper()
	db := testutil.NewSQLiteDB(t, &backendmodels.User{}, &backendmodels.Organization{}, &backendmodels.UserOrganization{}, &backendmodels.OrganizationInvitation{}, &backendmodels.Log{})
	return backendapi.NewInvitationService(db), db.DB
}

func TestInviteAndAcceptInvitation(t *testing.T) {
	svc, db := newInvitationService(t)
	admin := backendmodels.User{ID: uuid.New(), Email: "admin@example.com", FirstName: "Admin", LastName: "User", Password: "hashed", IsActive: true, EmailVerified: true}
	member := backendmodels.User{ID: uuid.New(), Email: "member@example.com", FirstName: "Mem", LastName: "Ber", Password: "hashed", IsActive: true, EmailVerified: true}
	org := backendmodels.Organization{ID: uuid.New(), Name: "InviteOrg", CreatedBy: admin.ID, EmployeeCount: 1, SubscriptionPlan: "free"}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("seed admin: %v", err)
	}
	if err := db.Create(&member).Error; err != nil {
		t.Fatalf("seed member: %v", err)
	}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("seed org: %v", err)
	}
	if err := db.Create(&backendmodels.UserOrganization{UserID: admin.ID, OrganizationID: org.ID, Role: "admin", IsActive: true}).Error; err != nil {
		t.Fatalf("seed membership: %v", err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(map[string]any{"email": member.Email, "role": "member"})
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/organizations/"+org.ID.String()+"/invite", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Set("user_id", admin.ID.String())
	c.Params = gin.Params{{Key: "id", Value: org.ID.String()}}
	svc.InviteMember(c)
	testutil.TraceRecorder(t, http.MethodPost, "/api/v1/organizations/"+org.ID.String()+"/invite", map[string]any{"email": member.Email, "role": "member"}, w)
	if w.Code != http.StatusCreated {
		t.Fatalf("invite member status: got %d body=%s", w.Code, w.Body.String())
	}

	var invitation backendmodels.OrganizationInvitation
	if err := db.Where("email = ? AND organization_id = ?", member.Email, org.ID).First(&invitation).Error; err != nil {
		t.Fatalf("invitation not created: %v", err)
	}
	if invitation.Status != "pending" {
		t.Fatalf("unexpected invitation status: %s", invitation.Status)
	}

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest(http.MethodPost, "/api/v1/invitations/"+invitation.ID.String()+"/accept", nil)
	c.Request = req
	c.Set("user_id", member.ID.String())
	c.Params = gin.Params{{Key: "id", Value: invitation.ID.String()}}
	svc.AcceptInvitation(c)
	testutil.TraceRecorder(t, http.MethodPost, "/api/v1/invitations/"+invitation.ID.String()+"/accept", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("accept invitation status: got %d body=%s", w.Code, w.Body.String())
	}

	if err := db.Where("id = ?", invitation.ID).First(&invitation).Error; err != nil {
		t.Fatalf("reload invitation: %v", err)
	}
	if invitation.Status != "accepted" {
		t.Fatalf("expected accepted invitation, got %s", invitation.Status)
	}
}

func TestExpiredInvitation(t *testing.T) {
	svc, db := newInvitationService(t)
	member := backendmodels.User{ID: uuid.New(), Email: "member2@example.com", FirstName: "Mem", LastName: "Ber", Password: "hashed", IsActive: true, EmailVerified: true}
	org := backendmodels.Organization{ID: uuid.New(), Name: "ExpireOrg", CreatedBy: member.ID, EmployeeCount: 1, SubscriptionPlan: "free"}
	if err := db.Create(&member).Error; err != nil {
		t.Fatalf("seed member: %v", err)
	}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("seed org: %v", err)
	}
	invitation := backendmodels.OrganizationInvitation{
		ID:             uuid.New(),
		OrganizationID: org.ID,
		Email:          member.Email,
		Role:           "member",
		Status:         "pending",
		InvitedBy:      member.ID,
		ExpiresAt:      time.Now().Add(-time.Hour),
	}
	if err := db.Create(&invitation).Error; err != nil {
		t.Fatalf("seed invitation: %v", err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/invitations/"+invitation.ID.String()+"/accept", nil)
	c.Request = req
	c.Set("user_id", member.ID.String())
	c.Params = gin.Params{{Key: "id", Value: invitation.ID.String()}}
	svc.AcceptInvitation(c)
	testutil.TraceRecorder(t, http.MethodPost, "/api/v1/invitations/"+invitation.ID.String()+"/accept", nil, w)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("expected expired invitation rejection, got %d body=%s", w.Code, w.Body.String())
	}
}
