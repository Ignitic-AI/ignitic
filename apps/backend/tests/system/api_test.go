package system

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strconv"
	"testing"

	"backend/api"
	"backend/api/auth"
	"backend/database"

	"github.com/gin-gonic/gin"
)

// buildTestRouter constructs a router with health and auth routes (no JWT auth on v1, so login is reachable).
func buildTestRouter(t *testing.T, db *database.DB, jwtSecret string) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(gin.Recovery())
	api.SetupHealthRoutes(r.Group(""))
	v1 := r.Group("/api/v1")
	auth.SetupRoutes(v1, db, jwtSecret)
	return r
}

func TestSystem_Health_Returns200(t *testing.T) {
	if os.Getenv("RUN_SYSTEM_TESTS") == "" {
		t.Skip("RUN_SYSTEM_TESTS not set, skipping")
	}

	cfg := database.DatabaseConfig{
		Host:     systemGetEnv("TEST_DB_HOST", "DB_HOST", "localhost"),
		Port:     systemGetEnvInt("TEST_DB_PORT", "DB_PORT", 5432),
		User:     systemGetEnv("TEST_DB_USER", "DB_USER", "postgres"),
		Password: systemGetEnv("TEST_DB_PASSWORD", "DB_PASSWORD", ""),
		Database: systemGetEnv("TEST_DB_NAME", "DB_NAME", "db"),
		SSLMode:  systemGetEnv("TEST_DB_SSLMODE", "DB_SSL_MODE", "disable"),
	}

	db, err := database.Initialize(cfg)
	if err != nil {
		t.Skipf("database not available: %v", err)
	}
	defer db.Close()

	router := buildTestRouter(t, db, "system-test-secret")

	req, _ := http.NewRequest(http.MethodGet, "/health", nil)
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("GET /health status = %d, want 200", rec.Code)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("health response JSON: %v", err)
	}
	if body["status"] != "healthy" {
		t.Fatalf("status = %v, want healthy", body["status"])
	}
}

func TestSystem_AuthLogin_InvalidBody_Returns400(t *testing.T) {
	if os.Getenv("RUN_SYSTEM_TESTS") == "" {
		t.Skip("RUN_SYSTEM_TESTS not set, skipping")
	}

	cfg := database.DatabaseConfig{
		Host:     systemGetEnv("TEST_DB_HOST", "DB_HOST", "localhost"),
		Port:     systemGetEnvInt("TEST_DB_PORT", "DB_PORT", 5432),
		User:     systemGetEnv("TEST_DB_USER", "DB_USER", "postgres"),
		Password: systemGetEnv("TEST_DB_PASSWORD", "DB_PASSWORD", ""),
		Database: systemGetEnv("TEST_DB_NAME", "DB_NAME", "db"),
		SSLMode:  systemGetEnv("TEST_DB_SSLMODE", "DB_SSL_MODE", "disable"),
	}

	db, err := database.Initialize(cfg)
	if err != nil {
		t.Skipf("database not available: %v", err)
	}
	defer db.Close()

	router := buildTestRouter(t, db, "system-test-secret")

	req, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader([]byte("{}")))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest && rec.Code != http.StatusUnauthorized {
		t.Fatalf("POST /api/v1/auth/login status = %d, want 400 or 401", rec.Code)
	}
}

func systemGetEnv(primary, fallback, defaultVal string) string {
	if v := os.Getenv(primary); v != "" {
		return v
	}
	if v := os.Getenv(fallback); v != "" {
		return v
	}
	return defaultVal
}

func systemGetEnvInt(primary, fallback string, defaultVal int) int {
	if v := os.Getenv(primary); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	if v := os.Getenv(fallback); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return defaultVal
}
