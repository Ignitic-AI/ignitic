package system_test

import (
	"encoding/json"
	"net/http"
	"testing"

	"backend/api/auth"
	orgapi "backend/api/organization"
	"backend/api/todo"
	"backend/models"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func TestEndToEndOrganizationTodoWorkflow(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef")

	db := testutil.NewSQLiteDB(t,
		&models.User{},
		&models.Organization{},
		&models.UserOrganization{},
		&models.OrganizationInvitation{},
		&models.Todo{},
		&models.Log{},
	)

	authSvc := auth.NewAuthService(db, "workflow-secret")
	orgSvc := orgapi.NewOrganizationService(db)
	inviteSvc := orgapi.NewInvitationService(db)
	todoSvc, err := todo.NewTodoService(db)
	if err != nil {
		t.Fatalf("todo service: %v", err)
	}

	registerUser := func(email, firstName string) models.User {
		ctx, rec := testutil.JSONContext(t, http.MethodPost, "/api/v1/auth/register", map[string]any{
			"first_name": firstName,
			"last_name":  "User",
			"email":      email,
			"password":   "StrongPass123!",
		}, nil)
		authSvc.Register(ctx)
		testutil.MustStatus(t, rec, http.StatusCreated)

		var user models.User
		if err := db.Where("email = ?", email).First(&user).Error; err != nil {
			t.Fatalf("lookup user %s: %v", email, err)
		}
		return user
	}

	admin := registerUser("owner.workflow@example.com", "Owner")
	member := registerUser("member.workflow@example.com", "Member")

	orgCtx, orgRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/organizations", map[string]any{
		"name":              "Workflow Org",
		"description":       "system coverage",
		"employee_count":    10,
		"company_size":      "11-50",
		"creator_job_title": "Founder",
	}, nil)
	orgCtx.Set("user_id", admin.ID.String())
	orgSvc.CreateOrganization(orgCtx)
	testutil.MustStatus(t, orgRec, http.StatusCreated)

	var orgResp struct {
		Organization models.Organization `json:"organization"`
	}
	if err := json.Unmarshal(orgRec.Body.Bytes(), &orgResp); err != nil {
		t.Fatalf("decode org: %v", err)
	}
	orgID := orgResp.Organization.ID

	inviteCtx, inviteRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/organizations/"+orgID.String()+"/invite", map[string]any{
		"email": member.Email,
		"role":  "member",
	}, nil)
	inviteCtx.Params = []gin.Param{{Key: "id", Value: orgID.String()}}
	inviteCtx.Set("user_id", admin.ID.String())
	inviteSvc.InviteMember(inviteCtx)
	testutil.MustStatus(t, inviteRec, http.StatusCreated)

	var invitation models.OrganizationInvitation
	if err := db.Where("organization_id = ? AND email = ?", orgID, member.Email).First(&invitation).Error; err != nil {
		t.Fatalf("invitation missing: %v", err)
	}

	acceptCtx, acceptRec := testutil.EmptyContext(t, http.MethodPost, "/api/v1/invitations/"+invitation.ID.String()+"/accept", nil)
	acceptCtx.Params = []gin.Param{{Key: "id", Value: invitation.ID.String()}}
	acceptCtx.Set("user_id", member.ID.String())
	inviteSvc.AcceptInvitation(acceptCtx)
	testutil.MustStatus(t, acceptRec, http.StatusOK)

	orgTodoCtx, orgTodoRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/todos", map[string]any{
		"title":           "Publish launch checklist",
		"description":     "Prepare launch items",
		"priority":        "high",
		"organization_id": orgID,
	}, nil)
	orgTodoCtx.Set("user_id", member.ID.String())
	todoSvc.CreateTodo(orgTodoCtx)
	testutil.MustStatus(t, orgTodoRec, http.StatusCreated)

	var todoResp models.TodoResponse
	if err := json.Unmarshal(orgTodoRec.Body.Bytes(), &todoResp); err != nil {
		t.Fatalf("decode todo response: %v", err)
	}
	if todoResp.ID == uuid.Nil {
		t.Fatalf("todo id missing")
	}

	newTitle := "Publish launch checklist v2"
	updateCtx, updateRec := testutil.JSONContext(t, http.MethodPut, "/api/v1/todos/"+todoResp.ID.String(), map[string]any{
		"title":    newTitle,
		"progress": 45,
	}, nil)
	updateCtx.Params = []gin.Param{{Key: "id", Value: todoResp.ID.String()}}
	updateCtx.Set("user_id", member.ID.String())
	todoSvc.UpdateTodo(updateCtx)
	testutil.MustStatus(t, updateRec, http.StatusOK)

	doneCtx, doneRec := testutil.EmptyContext(t, http.MethodPatch, "/api/v1/todos/"+todoResp.ID.String()+"/complete", nil)
	doneCtx.Params = []gin.Param{{Key: "id", Value: todoResp.ID.String()}}
	doneCtx.Set("user_id", member.ID.String())
	todoSvc.MarkAsDone(doneCtx)
	testutil.MustStatus(t, doneRec, http.StatusOK)

	deleteCtx, deleteRec := testutil.EmptyContext(t, http.MethodDelete, "/api/v1/todos/"+todoResp.ID.String(), nil)
	deleteCtx.Params = []gin.Param{{Key: "id", Value: todoResp.ID.String()}}
	deleteCtx.Set("user_id", admin.ID.String())
	todoSvc.DeleteTodo(deleteCtx)
	testutil.MustStatus(t, deleteRec, http.StatusOK)

	var deleted models.Todo
	if err := db.Unscoped().Where("id = ?", todoResp.ID).First(&deleted).Error; err != nil {
		t.Fatalf("lookup deleted todo: %v", err)
	}
	if !deleted.DeletedAt.Valid {
		t.Fatalf("todo was not soft deleted")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(admin.Password), []byte("StrongPass123!")); err != nil {
		t.Fatalf("admin password was altered unexpectedly: %v", err)
	}
}
