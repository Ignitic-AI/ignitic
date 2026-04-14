package logs_test

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	backendapi "backend/api/logs"
	backendmodels "backend/models"
	backendservices "backend/services"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func TestLogServiceHandlers(t *testing.T) {
	db := testutil.NewSQLiteDB(t, &backendmodels.Log{})
	svc := backendapi.NewLogService(db)

	if err := db.Exec(
		"INSERT INTO logs (id, timestamp, level, section, message, created_at) VALUES (?, ?, ?, ?, ?, ?)",
		uuid.New(),
		time.Now().UTC(),
		backendmodels.LogLevelInfo,
		backendmodels.SectionAuth,
		"hello",
		time.Now().UTC(),
	).Error; err != nil {
		t.Fatalf("seed log: %v", err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/logs", nil)
	c.Request = req
	svc.ListLogs()(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/logs", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("list logs status: got %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest(http.MethodGet, "/api/v1/logs/sections", nil)
	c.Request = req
	svc.ListSections()(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/logs/sections", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("list sections status: got %d body=%s", w.Code, w.Body.String())
	}
}

func TestDatabaseLoggerOptionsAndInference(t *testing.T) {
	log := &backendmodels.Log{}
	backendservices.WithRequestID("req-1")(log)
	backendservices.WithAuthResult("SUCCESS")(log)
	backendservices.WithSection(backendmodels.SectionSystem)(log)
	if log.RequestID == nil || *log.RequestID != "req-1" {
		t.Fatalf("request id option not applied")
	}
	if log.AuthResult == nil || *log.AuthResult != "SUCCESS" {
		t.Fatalf("auth result option not applied")
	}
	if log.Section != backendmodels.SectionSystem {
		t.Fatalf("section option not applied")
	}
	if got := backendservices.WithSubcategory("ignored"); got == nil {
		t.Fatalf("expected log option")
	}
}
