package http_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend/api"

	"github.com/gin-gonic/gin"
)

func TestHealthEndpoint_StatusAndBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	api.SetupHealthRoutes(router.Group(""))

	req, err := http.NewRequest(http.MethodGet, "/health", nil)
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rec.Code, http.StatusOK)
	}

	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("Unmarshal response: %v", err)
	}
	if body["status"] != "healthy" {
		t.Fatalf("status = %v, want healthy", body["status"])
	}
	if body["service"] != "backend" {
		t.Fatalf("service = %v, want backend", body["service"])
	}
}
