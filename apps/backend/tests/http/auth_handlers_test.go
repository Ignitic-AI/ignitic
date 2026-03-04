package http_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend/api/auth"
	"backend/database"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// testDB returns an in-memory SQLite DB for handler tests. No migrations; auth will return 401 for unknown user.
func testDB(t *testing.T) *database.DB {
	t.Helper()
	gormDB, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	sqlDB, err := gormDB.DB()
	if err != nil {
		t.Fatalf("get sql.DB: %v", err)
	}
	return &database.DB{DB: gormDB, RawDB: sqlDB}
}

func TestAuthLogin_InvalidJSON_Returns400(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := testDB(t)
	router := gin.New()
	auth.SetupRoutes(router.Group("/api/v1"), db, "test-jwt-secret")

	body := []byte(`{invalid json`)
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestAuthLogin_MissingEmail_Returns400(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := testDB(t)
	router := gin.New()
	auth.SetupRoutes(router.Group("/api/v1"), db, "test-jwt-secret")

	body, _ := json.Marshal(map[string]string{"password": "somepassword"})
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestAuthLogin_InvalidEmail_Returns400(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := testDB(t)
	router := gin.New()
	auth.SetupRoutes(router.Group("/api/v1"), db, "test-jwt-secret")

	body, _ := json.Marshal(map[string]string{"email": "not-an-email", "password": "somepassword"})
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}

func TestAuthRegister_InvalidJSON_Returns400(t *testing.T) {
	gin.SetMode(gin.TestMode)

	db := testDB(t)
	router := gin.New()
	auth.SetupRoutes(router.Group("/api/v1"), db, "test-jwt-secret")

	req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader([]byte("{")))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
}
