package asset_test

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	backendapi "backend/api/asset"
	"backend/database"
	backendmodels "backend/models"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func newAssetService(t *testing.T) (*backendapi.AssetService, *database.DB) {
	t.Helper()
	db := testutil.NewSQLiteDB(t, &backendmodels.User{}, &backendmodels.Organization{}, &backendmodels.UserOrganization{}, &backendmodels.Asset{}, &backendmodels.Log{})
	return backendapi.NewAssetService(db, nil), db
}

func TestGetCategories(t *testing.T) {
	svc, _ := newAssetService(t)
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/assets/categories", nil)
	c.Request = req
	svc.GetCategories(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/assets/categories", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("categories status: got %d body=%s", w.Code, w.Body.String())
	}
}

func TestUploadAssetValidationBranches(t *testing.T) {
	svc, _ := newAssetService(t)
	userID := uuid.NewString()

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/assets", nil)
	c.Request = req
	if userID != "" {
		c.Set("user_id", userID)
	}
	svc.UploadAsset(c)
	testutil.TraceRecorder(t, http.MethodPost, "/api/v1/assets", nil, w)
	if w.Code != http.StatusBadRequest && w.Code != http.StatusUnauthorized {
		t.Fatalf("expected validation failure, got %d body=%s", w.Code, w.Body.String())
	}

	t.Run("invalid category", func(t *testing.T) {
		var buf bytes.Buffer
		writer := multipart.NewWriter(&buf)
		_ = writer.WriteField("category", "bad")
		part, _ := writer.CreateFormFile("file", "a.txt")
		_, _ = io.WriteString(part, "hello")
		writer.Close()

		w = httptest.NewRecorder()
		c, _ = gin.CreateTestContext(w)
		req, _ = http.NewRequest(http.MethodPost, "/api/v1/assets", &buf)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		c.Request = req
		c.Set("user_id", userID)
		svc.UploadAsset(c)
		testutil.TraceRecorder(t, http.MethodPost, "/api/v1/assets", map[string]any{"category": "bad", "file": "a.txt"}, w)
		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected invalid category, got %d body=%s", w.Code, w.Body.String())
		}
	})
}

func TestAssetListAndGetBranches(t *testing.T) {
	svc, db := newAssetService(t)
	admin := backendmodels.User{ID: uuid.New(), Email: "asset@example.com", FirstName: "A", LastName: "B", Password: "hashed", IsActive: true, EmailVerified: true}
	org := backendmodels.Organization{ID: uuid.New(), Name: "Org", CreatedBy: admin.ID, EmployeeCount: 1, SubscriptionPlan: "free"}
	if err := db.DB.Create(&admin).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if err := db.DB.Create(&org).Error; err != nil {
		t.Fatalf("seed org: %v", err)
	}
	if err := db.DB.Create(&backendmodels.UserOrganization{UserID: admin.ID, OrganizationID: org.ID, Role: "admin", IsActive: true}).Error; err != nil {
		t.Fatalf("seed membership: %v", err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/assets?organization_id="+org.ID.String(), nil)
	c.Request = req
	c.Set("user_id", admin.ID.String())
	svc.ListAssets(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/assets?organization_id="+org.ID.String(), nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("list assets status: got %d body=%s", w.Code, w.Body.String())
	}

	missingID := uuid.NewString()
	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest(http.MethodGet, "/api/v1/assets/"+missingID, nil)
	c.Request = req
	c.Set("user_id", admin.ID.String())
	c.Params = gin.Params{{Key: "id", Value: missingID}}
	svc.GetAsset(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/assets/"+missingID, nil, w)
	if w.Code != http.StatusBadRequest && w.Code != http.StatusNotFound {
		t.Fatalf("expected get asset rejection, got %d body=%s", w.Code, w.Body.String())
	}
}
