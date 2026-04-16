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
)

func TestOrganizationTodoRoleMatrixWorkflow(t *testing.T) {
	t.Setenv("ENCRYPTION_KEY", "0123456789abcdef0123456789abcdef")

	db := testutil.NewSQLiteDB(t,
		&models.User{},
		&models.Organization{},
		&models.UserOrganization{},
		&models.OrganizationInvitation{},
		&models.Todo{},
		&models.Log{},
	)

	authSvc := auth.NewAuthService(db, "workflow-rbac-secret")
	orgSvc := orgapi.NewOrganizationService(db)
	inviteSvc := orgapi.NewInvitationService(db)
	todoSvc, err := todo.NewTodoService(db)
	if err != nil {
		t.Fatalf("todo service: %v", err)
	}

	registerUser := func(email, firstName string) models.User {
		ctx, rec := testutil.JSONContext(t, http.MethodPost, "/api/v1/auth/register", map[string]any{
			"first_name": firstName,
			"last_name":  "Workflow",
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

	acceptInvite := func(invitationID string, userID string) {
		acceptCtx, acceptRec := testutil.EmptyContext(t, http.MethodPost, "/api/v1/invitations/"+invitationID+"/accept", nil)
		acceptCtx.Params = []gin.Param{{Key: "id", Value: invitationID}}
		acceptCtx.Set("user_id", userID)
		inviteSvc.AcceptInvitation(acceptCtx)
		testutil.MustStatus(t, acceptRec, http.StatusOK)
	}

	admin := registerUser("admin.matrix@example.com", "Admin")
	member := registerUser("member.matrix@example.com", "Member")
	viewer := registerUser("viewer.matrix@example.com", "Viewer")

	orgCtx, orgRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/organizations", map[string]any{
		"name":              "Role Matrix Org",
		"description":       "system rbac coverage",
		"employee_count":    20,
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
		t.Fatalf("decode org response: %v", err)
	}
	orgID := orgResp.Organization.ID

	inviteMemberCtx, inviteMemberRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/organizations/"+orgID.String()+"/invite", map[string]any{
		"email": member.Email,
		"role":  "member",
	}, nil)
	inviteMemberCtx.Params = []gin.Param{{Key: "id", Value: orgID.String()}}
	inviteMemberCtx.Set("user_id", admin.ID.String())
	inviteSvc.InviteMember(inviteMemberCtx)
	testutil.MustStatus(t, inviteMemberRec, http.StatusCreated)

	inviteViewerCtx, inviteViewerRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/organizations/"+orgID.String()+"/invite", map[string]any{
		"email": viewer.Email,
		"role":  "viewer",
	}, nil)
	inviteViewerCtx.Params = []gin.Param{{Key: "id", Value: orgID.String()}}
	inviteViewerCtx.Set("user_id", admin.ID.String())
	inviteSvc.InviteMember(inviteViewerCtx)
	testutil.MustStatus(t, inviteViewerRec, http.StatusCreated)

	var memberInvite models.OrganizationInvitation
	if err := db.Where("organization_id = ? AND email = ? AND status = 'pending'", orgID, member.Email).First(&memberInvite).Error; err != nil {
		t.Fatalf("member invitation missing: %v", err)
	}
	acceptInvite(memberInvite.ID.String(), member.ID.String())

	var viewerInvite models.OrganizationInvitation
	if err := db.Where("organization_id = ? AND email = ? AND status = 'pending'", orgID, viewer.Email).First(&viewerInvite).Error; err != nil {
		t.Fatalf("viewer invitation missing: %v", err)
	}
	acceptInvite(viewerInvite.ID.String(), viewer.ID.String())

	viewerCreateCtx, viewerCreateRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/todos", map[string]any{
		"title":           "Viewer should not create",
		"description":     "rbac",
		"priority":        "high",
		"organization_id": orgID.String(),
	}, nil)
	viewerCreateCtx.Set("user_id", viewer.ID.String())
	todoSvc.CreateTodo(viewerCreateCtx)
	testutil.MustStatus(t, viewerCreateRec, http.StatusForbidden)

	memberCreateCtx, memberCreateRec := testutil.JSONContext(t, http.MethodPost, "/api/v1/todos", map[string]any{
		"title":           "Member can create",
		"description":     "rbac create",
		"priority":        "high",
		"organization_id": orgID.String(),
	}, nil)
	memberCreateCtx.Set("user_id", member.ID.String())
	todoSvc.CreateTodo(memberCreateCtx)
	testutil.MustStatus(t, memberCreateRec, http.StatusCreated)

	var createdTodo models.TodoResponse
	if err := json.Unmarshal(memberCreateRec.Body.Bytes(), &createdTodo); err != nil {
		t.Fatalf("decode created org todo: %v", err)
	}

	viewerListCtx, viewerListRec := testutil.EmptyContext(t, http.MethodGet, "/api/v1/todos?organization_id="+orgID.String(), nil)
	viewerListCtx.Set("user_id", viewer.ID.String())
	todoSvc.ListTodos(viewerListCtx)
	testutil.MustStatus(t, viewerListRec, http.StatusOK)

	memberDeleteCtx, memberDeleteRec := testutil.EmptyContext(t, http.MethodDelete, "/api/v1/todos/"+createdTodo.ID.String(), nil)
	memberDeleteCtx.Params = []gin.Param{{Key: "id", Value: createdTodo.ID.String()}}
	memberDeleteCtx.Set("user_id", member.ID.String())
	todoSvc.DeleteTodo(memberDeleteCtx)
	testutil.MustStatus(t, memberDeleteRec, http.StatusForbidden)

	adminDeleteCtx, adminDeleteRec := testutil.EmptyContext(t, http.MethodDelete, "/api/v1/todos/"+createdTodo.ID.String(), nil)
	adminDeleteCtx.Params = []gin.Param{{Key: "id", Value: createdTodo.ID.String()}}
	adminDeleteCtx.Set("user_id", admin.ID.String())
	todoSvc.DeleteTodo(adminDeleteCtx)
	testutil.MustStatus(t, adminDeleteRec, http.StatusOK)
}
