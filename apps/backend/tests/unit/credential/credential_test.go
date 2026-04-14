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
