package credits_test

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"runtime"
	"testing"

	backendapi "backend/api/credits"
	"backend/database"
	backendmodels "backend/models"
	"backend/services/policy"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func chdirBackendRoot(t *testing.T) {
	t.Helper()
	_, file, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("runtime caller failed")
	}
	root := filepath.Clean(filepath.Join(filepath.Dir(file), "../../.."))
	if err := os.Chdir(root); err != nil {
		t.Fatalf("chdir backend root: %v", err)
	}
}

func newCreditsDB(t *testing.T) *database.DB {
	t.Helper()
	chdirBackendRoot(t)
	return testutil.NewSQLiteDB(t, &backendmodels.User{}, &backendmodels.UserOrganization{}, &backendmodels.Organization{}, &backendmodels.CreditAccount{}, &backendmodels.CreditRecord{}, &backendmodels.Log{})
}

func newCreditsService(t *testing.T) (*backendapi.CreditsService, *database.DB) {
	t.Helper()
	db := newCreditsDB(t)
	return backendapi.NewCreditsService(db), db
}

func seedUser(t *testing.T, db *gorm.DB, email string) backendmodels.User {
	t.Helper()
	user := backendmodels.User{ID: uuid.New(), Email: email, Password: "hashed", FirstName: "Test", LastName: "User", IsActive: true, EmailVerified: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return user
}

func TestCreditsOverviewAndEntitlements(t *testing.T) {
	svc, db := newCreditsService(t)
	user := seedUser(t, db.DB, "credits@example.com")

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/credits/overview", nil)
	c.Request = req
	c.Set("user_id", user.ID.String())
	svc.Overview(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/credits/overview", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("overview status: got %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest(http.MethodGet, "/api/v1/credits/entitlements", nil)
	c.Request = req
	c.Set("user_id", user.ID.String())
	svc.Entitlements(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/credits/entitlements", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("entitlements status: got %d body=%s", w.Code, w.Body.String())
	}
}

func TestCreditsRecordsPagination(t *testing.T) {
	svc, db := newCreditsService(t)
	user := seedUser(t, db.DB, "records@example.com")

	policySvc := policy.NewService(db)
	account, _, err := policySvc.GetOverview(user.ID, nil)
	if err != nil {
		t.Fatalf("bootstrap account: %v", err)
	}
	for i := 0; i < 3; i++ {
		rec := backendmodels.CreditRecord{
			ID:                uuid.New(),
			CreditAccountID:   account.ID,
			RecordType:        "consume",
			CreditsDelta:      -1,
			TotalCreditsAfter: account.TotalCredits,
			CreditsUsedAfter:  int64(i + 1),
		}
		if err := db.DB.Create(&rec).Error; err != nil {
			t.Fatalf("seed record: %v", err)
		}
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/credits/records?page=1&page_size=2", nil)
	c.Request = req
	c.Set("user_id", user.ID.String())
	svc.Records(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/credits/records?page=1&page_size=2", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("records status: got %d body=%s", w.Code, w.Body.String())
	}
}
