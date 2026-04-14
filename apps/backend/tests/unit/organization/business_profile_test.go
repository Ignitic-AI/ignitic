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

func newBusinessProfileService(t *testing.T) (*backendapi.OrgBusinessProfileService, *gorm.DB) {
	t.Helper()
	db := testutil.NewSQLiteDB(t, &backendmodels.User{}, &backendmodels.Organization{}, &backendmodels.UserOrganization{}, &backendmodels.OrganizationBusinessProfile{}, &backendmodels.Log{})
	return backendapi.NewOrgBusinessProfileService(db), db.DB
}

func TestOrgBusinessProfileCRUD(t *testing.T) {
	svc, db := newBusinessProfileService(t)
	admin := backendmodels.User{ID: uuid.New(), Email: "admin@example.com", FirstName: "Admin", LastName: "User", Password: "hashed", IsActive: true, EmailVerified: true}
	org := backendmodels.Organization{ID: uuid.New(), Name: "Acme", CreatedBy: admin.ID, EmployeeCount: 1, SubscriptionPlan: "free"}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatalf("seed admin: %v", err)
	}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("seed org: %v", err)
	}
	if err := db.Create(&backendmodels.UserOrganization{UserID: admin.ID, OrganizationID: org.ID, Role: "admin", IsActive: true}).Error; err != nil {
		t.Fatalf("seed membership: %v", err)
	}

	payload := map[string]any{
		"business_hours":    "9-5",
		"primary_markets":    []string{"US"},
		"default_currency":   "USD",
		"support_email":      "support@example.com",
		"social_links":       map[string]string{"x": "y"},
		"primary_contacts":   []map[string]string{{"name": "A", "role": "Owner", "email": "a@example.com"}},
		"ecommerce_platforms": []map[string]string{{"name": "Shopify", "version": "1", "url": "https://shopify.com"}},
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest(http.MethodPut, "/api/v1/organizations/"+org.ID.String()+"/business-profile", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Set("user_id", admin.ID.String())
	c.Params = gin.Params{{Key: "id", Value: org.ID.String()}}

	svc.CreateOrUpdateOrgBusinessProfile(c)
	testutil.TraceRecorder(t, http.MethodPut, "/api/v1/organizations/"+org.ID.String()+"/business-profile", payload, w)
	if w.Code != http.StatusOK {
		t.Fatalf("create/update profile status: got %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest(http.MethodGet, "/api/v1/organizations/"+org.ID.String()+"/business-profile", nil)
	c.Request = req
	c.Set("user_id", admin.ID.String())
	c.Params = gin.Params{{Key: "id", Value: org.ID.String()}}
	svc.GetOrgBusinessProfile(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/organizations/"+org.ID.String()+"/business-profile", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("get profile status: got %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest(http.MethodDelete, "/api/v1/organizations/"+org.ID.String()+"/business-profile", nil)
	c.Request = req
	c.Set("user_id", admin.ID.String())
	c.Params = gin.Params{{Key: "id", Value: org.ID.String()}}
	svc.DeleteOrgBusinessProfile(c)
	testutil.TraceRecorder(t, http.MethodDelete, "/api/v1/organizations/"+org.ID.String()+"/business-profile", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("delete profile status: got %d body=%s", w.Code, w.Body.String())
	}
}
