package integration_test

import (
	"encoding/json"
	"net/http"
	"testing"

	credentialapi "backend/api/credential"
	creditsapi "backend/api/credits"
	orgapi "backend/api/organization"
	todoapi "backend/api/todo"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
)

func TestSeedDemoDataSmoke(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")

	db := testutil.NewSQLiteDB(t)
	seed := testutil.SeedDemoData(t, db.DB)

	orgSvc := orgapi.NewOrganizationService(db)
	creditsSvc := creditsapi.NewCreditsService(db)
	credentialSvc, err := credentialapi.NewCredentialService(db)
	if err != nil {
		t.Fatalf("credential service: %v", err)
	}
	todoSvc, err := todoapi.NewTodoService(db)
	if err != nil {
		t.Fatalf("todo service: %v", err)
	}

	orgListCtx, orgListRec := testutil.EmptyContext(t, http.MethodGet, "/api/v1/organizations", nil)
	orgListCtx.Set("user_id", seed.Admin.ID.String())
	orgSvc.ListOrganizations(orgListCtx)
	testutil.MustStatus(t, orgListRec, http.StatusOK)
	testutil.BodyContains(t, orgListRec, "Demo Commerce")

	orgGetCtx, orgGetRec := testutil.EmptyContext(t, http.MethodGet, "/api/v1/organizations/"+seed.Organization.ID.String(), gin.Params{{Key: "id", Value: seed.Organization.ID.String()}})
	orgGetCtx.Set("user_id", seed.Admin.ID.String())
	orgSvc.GetOrganization(orgGetCtx)
	testutil.MustStatus(t, orgGetRec, http.StatusOK)
	testutil.BodyContains(t, orgGetRec, "Demo Commerce")

	todoStatusCtx, todoStatusRec := testutil.EmptyContext(t, http.MethodGet, "/api/v1/todos/status/done", gin.Params{{Key: "status", Value: "done"}})
	todoStatusCtx.Set("user_id", seed.Admin.ID.String())
	todoSvc.GetTodosByStatus(todoStatusCtx)
	testutil.MustStatus(t, todoStatusRec, http.StatusOK)

	creditsCtx, creditsRec := testutil.EmptyContext(t, http.MethodGet, "/api/v1/credits/overview?organization_id="+seed.Organization.ID.String(), nil)
	creditsCtx.Set("user_id", seed.Admin.ID.String())
	creditsCtx.Request.URL.RawQuery = "organization_id=" + seed.Organization.ID.String()
	creditsSvc.Overview(creditsCtx)
	testutil.MustStatus(t, creditsRec, http.StatusOK)
	testutil.BodyContains(t, creditsRec, `"available_credits":880`)

	secretsCtx, secretsRec := testutil.EmptyContext(t, http.MethodGet, "/api/v1/secrets/organization/"+seed.Organization.ID.String(), gin.Params{{Key: "orgId", Value: seed.Organization.ID.String()}})
	secretsCtx.Set("user_id", seed.Admin.ID.String())
	credentialSvc.ListOrganizationSecrets(secretsCtx)
	testutil.MustStatus(t, secretsRec, http.StatusOK)
	var secretsPayload map[string]any
	if err := json.Unmarshal(secretsRec.Body.Bytes(), &secretsPayload); err != nil {
		t.Fatalf("decode secrets response: %v", err)
	}
	if secretsPayload["count"] == nil {
		t.Fatalf("expected secrets count in response")
	}
}
