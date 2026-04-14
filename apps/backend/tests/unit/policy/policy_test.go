package policy_test

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"backend/database"
	backendmodels "backend/models"
	backendpolicy "backend/services/policy"
	"backend/tests/testutil"

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

func newPolicyDB(t *testing.T) *database.DB {
	t.Helper()
	chdirBackendRoot(t)
	return testutil.NewSQLiteDB(t, &backendmodels.User{}, &backendmodels.Organization{}, &backendmodels.UserOrganization{}, &backendmodels.CreditAccount{}, &backendmodels.CreditRecord{}, &backendmodels.Plan{})
}

func seedPolicyUser(t *testing.T, db *gorm.DB, email string) backendmodels.User {
	t.Helper()
	user := backendmodels.User{ID: uuid.New(), Email: email, Password: "hashed", FirstName: "Policy", LastName: "User", IsActive: true, EmailVerified: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return user
}

func TestPolicyOverviewAndConsumption(t *testing.T) {
	db := newPolicyDB(t)
	svc := backendpolicy.NewService(db)
	user := seedPolicyUser(t, db.DB, "policy@example.com")

	account, plan, err := svc.GetOverview(user.ID, nil)
	if err != nil {
		t.Fatalf("get overview: %v", err)
	}
	if account == nil || plan == nil {
		t.Fatalf("expected account and plan")
	}

	res, err := svc.AuthorizeAndMaybeConsume(backendpolicy.AuthorizeInput{
		UserID:          user.ID,
		ActionKey:       "agent.chat",
		RequireBillable: true,
		EndpointRole:    backendpolicy.EndpointRoleRun,
	})
	if err != nil {
		t.Fatalf("authorize and consume: %v", err)
	}
	if res == nil || !res.Allowed {
		t.Fatalf("expected allowed result")
	}
}

func TestPolicySystemAdjustments(t *testing.T) {
	db := newPolicyDB(t)
	svc := backendpolicy.NewService(db)
	user := seedPolicyUser(t, db.DB, "adjust@example.com")

	account, _, err := svc.GetOverview(user.ID, nil)
	if err != nil {
		t.Fatalf("get overview: %v", err)
	}

	if err := svc.SystemAdjustment("user", user.ID, 25, "bonus", "ref-1"); err != nil {
		t.Fatalf("system adjustment positive: %v", err)
	}

	if err := svc.SystemPlanChange("user", user.ID, "pro"); err != nil {
		t.Fatalf("system plan change: %v", err)
	}

	if err := svc.SystemCycleReset("user", user.ID); err != nil {
		t.Fatalf("system cycle reset: %v", err)
	}

	// Negative adjustment that should still be valid.
	if err := svc.SystemAdjustment("user", user.ID, -5, "correction", "ref-2"); err != nil {
		t.Fatalf("system adjustment negative: %v", err)
	}

	_ = account
}
