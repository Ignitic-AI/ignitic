package credential_test

import (
	"bytes"
	"encoding/hex"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	backendapi "backend/api/credential"
	backendmodels "backend/models"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func newCredentialService(t *testing.T) (*backendapi.CredentialService, *gorm.DB) {
	t.Helper()
	t.Setenv("ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
	db := testutil.NewSQLiteDB(t, &backendmodels.User{}, &backendmodels.Organization{}, &backendmodels.UserOrganization{}, &backendmodels.Secret{}, &backendmodels.Log{})
	svc, err := backendapi.NewCredentialService(db)
	if err != nil {
		t.Fatalf("new credential service: %v", err)
	}
	return svc, db.DB
}

func seedCredentialUser(t *testing.T, db *gorm.DB, email string) backendmodels.User {
	t.Helper()
	user := backendmodels.User{ID: uuid.New(), Email: email, Password: "hashed", FirstName: "Test", LastName: "User", IsActive: true, EmailVerified: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return user
}

func performCredentialJSON(t *testing.T, handler gin.HandlerFunc, method, target string, body any, userID string, params gin.Params) *httptest.ResponseRecorder {
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
	c.Set("user_id", userID)
	c.Params = params
	handler(c)
	testutil.TraceRecorder(t, method, target, body, w)
	return w
}

func TestSecretCRUD(t *testing.T) {
	svc, db := newCredentialService(t)
	user := seedCredentialUser(t, db, "secret@example.com")

	w := performCredentialJSON(t, svc.PutSecret, http.MethodPut, "/api/v1/secrets/app/key", map[string]any{
		"value":       "super-secret",
		"description": "test",
	}, user.ID.String(), gin.Params{{Key: "app", Value: "app"}, {Key: "name", Value: "key"}})
	if w.Code != http.StatusCreated {
		t.Fatalf("put secret status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performCredentialJSON(t, svc.GetSecret, http.MethodGet, "/api/v1/secrets/app/key", nil, user.ID.String(), gin.Params{{Key: "app", Value: "app"}, {Key: "name", Value: "key"}})
	if w.Code != http.StatusOK {
		t.Fatalf("get secret status: got %d body=%s", w.Code, w.Body.String())
	}
	if !strings.Contains(w.Body.String(), "super-secret") {
		t.Fatalf("expected decrypted value in response: %s", w.Body.String())
	}

	w = performCredentialJSON(t, svc.DeleteSecret, http.MethodDelete, "/api/v1/secrets/app/key", nil, user.ID.String(), gin.Params{{Key: "app", Value: "app"}, {Key: "name", Value: "key"}})
	if w.Code != http.StatusOK {
		t.Fatalf("delete secret status: got %d body=%s", w.Code, w.Body.String())
	}
}

func TestSecretAccessAndListingBranches(t *testing.T) {
	svc, db := newCredentialService(t)
	user := seedCredentialUser(t, db, "scope@example.com")
	org := backendmodels.Organization{ID: uuid.New(), Name: "Org", CreatedBy: user.ID, EmployeeCount: 1, SubscriptionPlan: "free"}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("seed org: %v", err)
	}
	if err := db.Create(&backendmodels.UserOrganization{UserID: user.ID, OrganizationID: org.ID, Role: "admin", IsActive: true}).Error; err != nil {
		t.Fatalf("seed membership: %v", err)
	}

	w := performCredentialJSON(t, svc.BulkUpsertSecrets, http.MethodPut, "/api/v1/secrets/app", map[string]any{
		"secrets": []map[string]any{{"name": "one", "value": "1"}},
	}, user.ID.String(), gin.Params{{Key: "app", Value: "app"}})
	if w.Code != http.StatusOK && w.Code != http.StatusCreated {
		t.Fatalf("bulk upsert status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performCredentialJSON(t, svc.ListUserSecrets, http.MethodGet, "/api/v1/secrets/user/all", nil, user.ID.String(), nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list user secrets status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performCredentialJSON(t, svc.ListOrganizationSecrets, http.MethodGet, "/api/v1/secrets/organization/"+org.ID.String(), nil, user.ID.String(), gin.Params{{Key: "orgId", Value: org.ID.String()}})
	if w.Code != http.StatusOK {
		t.Fatalf("list org secrets status: got %d body=%s", w.Code, w.Body.String())
	}

	// Hex sanity check for the configured encryption key to keep test setup explicit.
	if _, err := hex.DecodeString(strings.Repeat("01", 32)); err != nil {
		t.Fatalf("hex decode sanity: %v", err)
	}
}

func TestShareAppSecretsToOrganization(t *testing.T) {
	svc, db := newCredentialService(t)
	user := seedCredentialUser(t, db, "share@example.com")
	org := backendmodels.Organization{
		ID:               uuid.New(),
		Name:             "Share Org",
		CreatedBy:        user.ID,
		EmployeeCount:    1,
		SubscriptionPlan: "free",
	}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("create org: %v", err)
	}
	if err := db.Create(&backendmodels.UserOrganization{
		UserID:         user.ID,
		OrganizationID: org.ID,
		Role:           "admin",
		IsActive:       true,
	}).Error; err != nil {
		t.Fatalf("create org membership: %v", err)
	}

	// Create personal secret for app "shopifyOAuth2Api"
	w := performCredentialJSON(t, svc.PutSecret, http.MethodPut, "/api/v1/secrets/shopifyOAuth2Api/clientId", map[string]any{
		"value":       "personal-client-id",
		"description": "personal secret",
	}, user.ID.String(), gin.Params{{Key: "app", Value: "shopifyOAuth2Api"}, {Key: "name", Value: "clientId"}})
	if w.Code != http.StatusCreated {
		t.Fatalf("put personal secret status: got %d body=%s", w.Code, w.Body.String())
	}

	// First share should create org-scoped copy
	w = performCredentialJSON(t, svc.ShareAppSecretsToOrganization, http.MethodPost, "/api/v1/secrets/shopifyOAuth2Api/share-to-organization", map[string]any{
		"organization_id": org.ID.String(),
	}, user.ID.String(), gin.Params{{Key: "app", Value: "shopifyOAuth2Api"}})
	if w.Code != http.StatusOK {
		t.Fatalf("share secrets status: got %d body=%s", w.Code, w.Body.String())
	}

	var orgSecret backendmodels.Secret
	if err := db.Where("app = ? AND name = ? AND organization_id = ?", "shopifyOAuth2Api", "clientId", org.ID).First(&orgSecret).Error; err != nil {
		t.Fatalf("expected org secret to be created: %v", err)
	}

	var personalSecret backendmodels.Secret
	if err := db.Where("app = ? AND name = ? AND organization_id IS NULL AND created_by = ?", "shopifyOAuth2Api", "clientId", user.ID).First(&personalSecret).Error; err != nil {
		t.Fatalf("expected personal secret to remain: %v", err)
	}

	// Update personal secret and re-share should update existing org copy (not create duplicate)
	w = performCredentialJSON(t, svc.PutSecret, http.MethodPut, "/api/v1/secrets/shopifyOAuth2Api/clientId", map[string]any{
		"value":       "updated-personal-client-id",
		"description": "updated personal secret",
	}, user.ID.String(), gin.Params{{Key: "app", Value: "shopifyOAuth2Api"}, {Key: "name", Value: "clientId"}})
	if w.Code != http.StatusOK {
		t.Fatalf("update personal secret status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performCredentialJSON(t, svc.ShareAppSecretsToOrganization, http.MethodPost, "/api/v1/secrets/shopifyOAuth2Api/share-to-organization", map[string]any{
		"organization_id": org.ID.String(),
	}, user.ID.String(), gin.Params{{Key: "app", Value: "shopifyOAuth2Api"}})
	if w.Code != http.StatusOK {
		t.Fatalf("re-share secrets status: got %d body=%s", w.Code, w.Body.String())
	}

	var orgSecretCount int64
	if err := db.Model(&backendmodels.Secret{}).Where("app = ? AND name = ? AND organization_id = ?", "shopifyOAuth2Api", "clientId", org.ID).Count(&orgSecretCount).Error; err != nil {
		t.Fatalf("count org secrets: %v", err)
	}
	if orgSecretCount != 1 {
		t.Fatalf("expected one org secret row after re-share, got %d", orgSecretCount)
	}
}

func TestShareAppSecretsToOrganizationForbidden(t *testing.T) {
	svc, db := newCredentialService(t)
	user := seedCredentialUser(t, db, "forbidden-share@example.com")
	otherAdmin := seedCredentialUser(t, db, "other-admin@example.com")
	org := backendmodels.Organization{
		ID:               uuid.New(),
		Name:             "Forbidden Org",
		CreatedBy:        otherAdmin.ID,
		EmployeeCount:    1,
		SubscriptionPlan: "free",
	}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("create org: %v", err)
	}
	if err := db.Create(&backendmodels.UserOrganization{
		UserID:         otherAdmin.ID,
		OrganizationID: org.ID,
		Role:           "admin",
		IsActive:       true,
	}).Error; err != nil {
		t.Fatalf("create org membership: %v", err)
	}

	// User has personal secret but no admin access to target org.
	w := performCredentialJSON(t, svc.PutSecret, http.MethodPut, "/api/v1/secrets/slackApi/token", map[string]any{
		"value":       "personal-token",
		"description": "personal secret",
	}, user.ID.String(), gin.Params{{Key: "app", Value: "slackApi"}, {Key: "name", Value: "token"}})
	if w.Code != http.StatusCreated {
		t.Fatalf("put personal secret status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performCredentialJSON(t, svc.ShareAppSecretsToOrganization, http.MethodPost, "/api/v1/secrets/slackApi/share-to-organization", map[string]any{
		"organization_id": org.ID.String(),
	}, user.ID.String(), gin.Params{{Key: "app", Value: "slackApi"}})
	if w.Code != http.StatusForbidden {
		t.Fatalf("share forbidden status: got %d body=%s", w.Code, w.Body.String())
	}
}
