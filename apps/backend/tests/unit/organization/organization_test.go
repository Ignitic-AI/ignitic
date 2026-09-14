package organization_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	backendapi "backend/api/organization"
	backendmodels "backend/models"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func newOrgService(t *testing.T) (*backendapi.OrganizationService, *gorm.DB) {
	t.Helper()
	db := testutil.NewSQLiteDB(t, &backendmodels.User{}, &backendmodels.Organization{}, &backendmodels.UserOrganization{}, &backendmodels.Log{})
	return backendapi.NewOrganizationService(db), db.DB
}

func seedUser(t *testing.T, db *gorm.DB, email string) backendmodels.User {
	t.Helper()
	user := backendmodels.User{
		ID:            uuid.New(),
		Email:         email,
		Password:      "hashed",
		FirstName:     "Owner",
		LastName:      "User",
		Role:          "user",
		IsActive:      true,
		EmailVerified: true,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return user
}

func performJSON(t *testing.T, handler gin.HandlerFunc, method, target string, body any, ctx map[string]string, params gin.Params) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	req, _ := http.NewRequest(method, target, &buf)
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	for k, v := range ctx {
		c.Set(k, v)
	}
	c.Params = params
	handler(c)
	testutil.TraceRecorder(t, method, target, body, w)
	return w
}

func TestCreateAndGetOrganization(t *testing.T) {
	svc, db := newOrgService(t)
	user := seedUser(t, db, "owner@example.com")

	w := performJSON(t, svc.CreateOrganization, http.MethodPost, "/api/v1/organizations", map[string]any{
		"name":              "Acme",
		"description":       "Test org",
		"employee_count":    0,
		"company_size":      "Medium team (11-50)",
		"subscription_plan": "free",
		"creator_job_title": "Founder",
	}, map[string]string{"user_id": user.ID.String()}, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("create org status: got %d body=%s", w.Code, w.Body.String())
	}

	var org backendmodels.Organization
	if err := db.Where("name = ?", "Acme").First(&org).Error; err != nil {
		t.Fatalf("org not created: %v", err)
	}
	if org.EmployeeCount != 25 {
		t.Fatalf("expected employee count fallback to 25, got %d", org.EmployeeCount)
	}

	w = performJSON(t, svc.GetOrganization, http.MethodGet, "/api/v1/organizations/"+org.ID.String(), nil, map[string]string{"user_id": user.ID.String()}, gin.Params{{Key: "id", Value: org.ID.String()}})
	if w.Code != http.StatusOK {
		t.Fatalf("get org status: got %d body=%s", w.Code, w.Body.String())
	}
}

func TestOrganizationMembershipAndRoles(t *testing.T) {
	svc, db := newOrgService(t)
	admin := seedUser(t, db, "admin@example.com")
	member := seedUser(t, db, "member@example.com")
	org := backendmodels.Organization{ID: uuid.New(), Name: "Org", CreatedBy: admin.ID, EmployeeCount: 1, SubscriptionPlan: "free"}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("create org: %v", err)
	}
	if err := db.Create(&backendmodels.UserOrganization{UserID: admin.ID, OrganizationID: org.ID, Role: "admin", IsActive: true}).Error; err != nil {
		t.Fatalf("create admin membership: %v", err)
	}

	w := performJSON(t, svc.ListOrganizations, http.MethodGet, "/api/v1/organizations", nil, map[string]string{"user_id": admin.ID.String()}, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list orgs status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performJSON(t, svc.AddMember, http.MethodPost, "/api/v1/organizations/"+org.ID.String()+"/members", map[string]any{
		"email": member.Email,
		"role":  "member",
	}, map[string]string{"user_id": admin.ID.String()}, gin.Params{{Key: "id", Value: org.ID.String()}})
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("add member status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performJSON(t, svc.ListMembers, http.MethodGet, "/api/v1/organizations/"+org.ID.String()+"/members", nil, map[string]string{"user_id": admin.ID.String()}, gin.Params{{Key: "id", Value: org.ID.String()}})
	if w.Code != http.StatusOK {
		t.Fatalf("list members status: got %d body=%s", w.Code, w.Body.String())
	}
}

func TestJoinLeaveAndRoleUpdate(t *testing.T) {
	svc, db := newOrgService(t)
	admin := seedUser(t, db, "admin2@example.com")
	user := seedUser(t, db, "user2@example.com")
	org := backendmodels.Organization{ID: uuid.New(), Name: "JoinOrg", CreatedBy: admin.ID, EmployeeCount: 1, SubscriptionPlan: "free"}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("create org: %v", err)
	}
	if err := db.Create(&backendmodels.UserOrganization{UserID: admin.ID, OrganizationID: org.ID, Role: "admin", IsActive: true}).Error; err != nil {
		t.Fatalf("create admin membership: %v", err)
	}

	w := performJSON(t, svc.JoinOrganization, http.MethodPost, "/api/v1/organizations/"+org.ID.String()+"/join", nil, map[string]string{"user_id": user.ID.String()}, gin.Params{{Key: "id", Value: org.ID.String()}})
	if w.Code != http.StatusOK {
		t.Fatalf("join org status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performJSON(t, svc.UpdateMemberRole, http.MethodPut, "/api/v1/organizations/"+org.ID.String()+"/members/"+user.ID.String()+"/role", map[string]any{
		"role": "viewer",
	}, map[string]string{"user_id": admin.ID.String()}, gin.Params{{Key: "id", Value: org.ID.String()}, {Key: "memberId", Value: user.ID.String()}})
	if w.Code != http.StatusOK {
		t.Fatalf("update role status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performJSON(t, svc.LeaveOrganization, http.MethodPost, "/api/v1/organizations/"+org.ID.String()+"/leave", nil, map[string]string{"user_id": user.ID.String()}, gin.Params{{Key: "id", Value: org.ID.String()}})
	if w.Code != http.StatusOK {
		t.Fatalf("leave org status: got %d body=%s", w.Code, w.Body.String())
	}
}

func TestDeleteOrganization(t *testing.T) {
	svc, db := newOrgService(t)
	admin := seedUser(t, db, "delete-admin@example.com")
	member := seedUser(t, db, "delete-member@example.com")

	org := backendmodels.Organization{
		ID:               uuid.New(),
		Name:             "DeleteOrg",
		CreatedBy:        admin.ID,
		EmployeeCount:    1,
		SubscriptionPlan: "free",
	}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("create org: %v", err)
	}
	if err := db.Create(&backendmodels.UserOrganization{
		UserID:         admin.ID,
		OrganizationID: org.ID,
		Role:           "admin",
		IsActive:       true,
	}).Error; err != nil {
		t.Fatalf("create admin membership: %v", err)
	}
	if err := db.Create(&backendmodels.UserOrganization{
		UserID:         member.ID,
		OrganizationID: org.ID,
		Role:           "member",
		IsActive:       true,
	}).Error; err != nil {
		t.Fatalf("create member membership: %v", err)
	}

	// non-admin cannot delete
	w := performJSON(
		t,
		svc.DeleteOrganization,
		http.MethodDelete,
		"/api/v1/organizations/"+org.ID.String(),
		nil,
		map[string]string{"user_id": member.ID.String()},
		gin.Params{{Key: "id", Value: org.ID.String()}},
	)
	if w.Code != http.StatusForbidden {
		t.Fatalf("non-admin delete status: got %d body=%s", w.Code, w.Body.String())
	}

	// unauthenticated request is rejected
	w = performJSON(
		t,
		svc.DeleteOrganization,
		http.MethodDelete,
		"/api/v1/organizations/"+org.ID.String(),
		nil,
		map[string]string{},
		gin.Params{{Key: "id", Value: org.ID.String()}},
	)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unauth delete status: got %d body=%s", w.Code, w.Body.String())
	}

	// invalid org id
	w = performJSON(
		t,
		svc.DeleteOrganization,
		http.MethodDelete,
		"/api/v1/organizations/not-a-uuid",
		nil,
		map[string]string{"user_id": admin.ID.String()},
		gin.Params{{Key: "id", Value: "not-a-uuid"}},
	)
	if w.Code != http.StatusBadRequest {
		t.Fatalf("invalid org id delete status: got %d body=%s", w.Code, w.Body.String())
	}

	// missing org
	missingOrgID := uuid.New()
	w = performJSON(
		t,
		svc.DeleteOrganization,
		http.MethodDelete,
		"/api/v1/organizations/"+missingOrgID.String(),
		nil,
		map[string]string{"user_id": admin.ID.String()},
		gin.Params{{Key: "id", Value: missingOrgID.String()}},
	)
	if w.Code != http.StatusNotFound {
		t.Fatalf("missing org delete status: got %d body=%s", w.Code, w.Body.String())
	}

	// admin can delete
	w = performJSON(
		t,
		svc.DeleteOrganization,
		http.MethodDelete,
		"/api/v1/organizations/"+org.ID.String(),
		nil,
		map[string]string{"user_id": admin.ID.String()},
		gin.Params{{Key: "id", Value: org.ID.String()}},
	)
	if w.Code != http.StatusOK {
		t.Fatalf("admin delete status: got %d body=%s", w.Code, w.Body.String())
	}

	var deleted backendmodels.Organization
	if err := db.Where("id = ?", org.ID).First(&deleted).Error; err == nil {
		t.Fatalf("expected org to be deleted")
	}
}
