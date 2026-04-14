package api_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	backendapi "backend/api"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
)

func TestHealthRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	backendapi.SetupHealthRoutes(r.Group(""))

	req := httptest.NewRequest(http.MethodGet, "/health", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	testutil.TraceRecorder(t, http.MethodGet, "/health", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("health status: got %d body=%s", w.Code, w.Body.String())
	}
}
