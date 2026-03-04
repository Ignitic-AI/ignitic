package integration

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"backend/api/auth"
	"backend/database"

	"github.com/gin-gonic/gin"
)

func TestAuthFlow_RegisterAndLogin(t *testing.T) {
	if os.Getenv("RUN_INTEGRATION_TESTS") == "" {
		t.Skip("RUN_INTEGRATION_TESTS not set, skipping")
	}

	cfg := database.DatabaseConfig{
		Host:     getEnv("TEST_DB_HOST", "DB_HOST", "localhost"),
		Port:     getEnvInt("TEST_DB_PORT", "DB_PORT", 5432),
		User:     getEnv("TEST_DB_USER", "DB_USER", "postgres"),
		Password: getEnv("TEST_DB_PASSWORD", "DB_PASSWORD", ""),
		Database: getEnv("TEST_DB_NAME", "DB_NAME", "db"),
		SSLMode:  getEnv("TEST_DB_SSLMODE", "DB_SSL_MODE", "disable"),
	}

	db, err := database.Initialize(cfg)
	if err != nil {
		t.Skipf("database not available: %v", err)
	}
	defer db.Close()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	auth.SetupRoutes(router.Group("/api/v1"), db, "integration-test-jwt-secret")

	email := "integration-test-user@example.com"
	password := "Password123!"
	registerBody, _ := json.Marshal(map[string]string{
		"first_name": "Test",
		"last_name":  "User",
		"email":      email,
		"password":   password,
	})

	regReq, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewReader(registerBody))
	regReq.Header.Set("Content-Type", "application/json")
	regRec := httptest.NewRecorder()
	router.ServeHTTP(regRec, regReq)

	// Allow 201 (new user) or 409 (already exists from previous run)
	if regRec.Code != http.StatusCreated && regRec.Code != http.StatusConflict {
		t.Fatalf("register status = %d, want 201 or 409; body = %s", regRec.Code, regRec.Body.String())
	}

	// Login
	loginBody, _ := json.Marshal(map[string]string{"email": email, "password": password})
	loginReq, _ := http.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewReader(loginBody))
	loginReq.Header.Set("Content-Type", "application/json")
	loginRec := httptest.NewRecorder()
	router.ServeHTTP(loginRec, loginReq)

	if loginRec.Code != http.StatusOK {
		t.Fatalf("login status = %d, want 200; body = %s", loginRec.Code, loginRec.Body.String())
	}

	var loginResp map[string]interface{}
	if err := json.Unmarshal(loginRec.Body.Bytes(), &loginResp); err != nil {
		t.Fatalf("login response JSON: %v", err)
	}
	if _, ok := loginResp["token"]; !ok {
		t.Fatalf("login response missing token: %v", loginResp)
	}
}
