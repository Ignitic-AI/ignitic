package todo_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	backendapi "backend/api/todo"
	backendmodels "backend/models"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

func newTodoService(t *testing.T) (*backendapi.TodoService, *gorm.DB) {
	t.Helper()
	db := testutil.NewSQLiteDB(t, &backendmodels.User{}, &backendmodels.Organization{}, &backendmodels.UserOrganization{}, &backendmodels.Todo{}, &backendmodels.Log{})
	svc, err := backendapi.NewTodoService(db)
	if err != nil {
		t.Fatalf("new todo service: %v", err)
	}
	return svc, db.DB
}

func seedTodoUser(t *testing.T, db *gorm.DB, email string) backendmodels.User {
	t.Helper()
	user := backendmodels.User{ID: uuid.New(), Email: email, Password: "hashed", FirstName: "Todo", LastName: "User", IsActive: true, EmailVerified: true}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return user
}

func performTodoJSON(t *testing.T, handler gin.HandlerFunc, method, target string, body any, userID string, params gin.Params) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	req, _ := http.NewRequest(method, target, &buf)
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Set("user_id", userID)
	c.Params = params
	handler(c)
	testutil.TraceRecorder(t, method, target, body, w)
	return w
}

func TestTodoCRUDAndFilters(t *testing.T) {
	svc, db := newTodoService(t)
	user := seedTodoUser(t, db, "todo@example.com")

	createBody := map[string]any{
		"title":       "Write tests",
		"description": "for backend",
		"priority":    "high",
	}
	w := performTodoJSON(t, svc.CreateTodo, http.MethodPost, "/api/v1/todos", createBody, user.ID.String(), nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("create todo status: got %d body=%s", w.Code, w.Body.String())
	}

	var todo backendmodels.Todo
	if err := db.Where("user_id = ?", user.ID).First(&todo).Error; err != nil {
		t.Fatalf("todo not created: %v", err)
	}
	if todo.Status != backendmodels.StatusTodo {
		t.Fatalf("expected default status todo, got %s", todo.Status)
	}
	if todo.Progress != 0 {
		t.Fatalf("expected default progress 0, got %d", todo.Progress)
	}

	w = performTodoJSON(t, svc.GetTodo, http.MethodGet, "/api/v1/todos/"+todo.ID.String(), nil, user.ID.String(), gin.Params{{Key: "id", Value: todo.ID.String()}})
	if w.Code != http.StatusOK {
		t.Fatalf("get todo status: got %d body=%s", w.Code, w.Body.String())
	}

	updateBody := map[string]any{"title": "Write more tests", "progress": 50}
	w = performTodoJSON(t, svc.UpdateTodo, http.MethodPut, "/api/v1/todos/"+todo.ID.String(), updateBody, user.ID.String(), gin.Params{{Key: "id", Value: todo.ID.String()}})
	if w.Code != http.StatusOK {
		t.Fatalf("update todo status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performTodoJSON(t, svc.MarkAsDone, http.MethodPatch, "/api/v1/todos/"+todo.ID.String()+"/complete", nil, user.ID.String(), gin.Params{{Key: "id", Value: todo.ID.String()}})
	if w.Code != http.StatusOK {
		t.Fatalf("mark done status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performTodoJSON(t, svc.ListTodos, http.MethodGet, "/api/v1/todos", nil, user.ID.String(), nil)
	if w.Code != http.StatusOK {
		t.Fatalf("list todos status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performTodoJSON(t, svc.GetTodosByStatus, http.MethodGet, "/api/v1/todos/status/done", nil, user.ID.String(), gin.Params{{Key: "status", Value: "done"}})
	if w.Code != http.StatusOK {
		t.Fatalf("status filter status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performTodoJSON(t, svc.GetTodosByPriority, http.MethodGet, "/api/v1/todos/priority/high", nil, user.ID.String(), gin.Params{{Key: "priority", Value: "high"}})
	if w.Code != http.StatusOK {
		t.Fatalf("priority filter status: got %d body=%s", w.Code, w.Body.String())
	}

	w = performTodoJSON(t, svc.DeleteTodo, http.MethodDelete, "/api/v1/todos/"+todo.ID.String(), nil, user.ID.String(), gin.Params{{Key: "id", Value: todo.ID.String()}})
	if w.Code != http.StatusOK {
		t.Fatalf("delete todo status: got %d body=%s", w.Code, w.Body.String())
	}
}

func TestTodoValidationBranches(t *testing.T) {
	svc, _ := newTodoService(t)
	w := performTodoJSON(t, svc.CreateTodo, http.MethodPost, "/api/v1/todos", map[string]any{
		"title":    "Invalid",
		"priority": "bad",
	}, uuid.NewString(), nil)
	if w.Code != http.StatusBadRequest && w.Code != http.StatusUnauthorized {
		t.Fatalf("expected validation failure, got %d body=%s", w.Code, w.Body.String())
	}
}

func TestTodoPersonalAccessControl(t *testing.T) {
	svc, db := newTodoService(t)
	owner := seedTodoUser(t, db, "owner.todo@example.com")
	other := seedTodoUser(t, db, "other.todo@example.com")

	createBody := map[string]any{
		"title":       "Owner only",
		"description": "private",
		"priority":    "medium",
	}
	create := performTodoJSON(t, svc.CreateTodo, http.MethodPost, "/api/v1/todos", createBody, owner.ID.String(), nil)
	if create.Code != http.StatusCreated {
		t.Fatalf("create todo status: got %d body=%s", create.Code, create.Body.String())
	}

	var created backendmodels.TodoResponse
	if err := json.Unmarshal(create.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created todo: %v", err)
	}
	if created.ID == uuid.Nil {
		t.Fatalf("created todo id is empty")
	}

	params := gin.Params{{Key: "id", Value: created.ID.String()}}

	get := performTodoJSON(t, svc.GetTodo, http.MethodGet, "/api/v1/todos/"+created.ID.String(), nil, other.ID.String(), params)
	if get.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden on get, got %d body=%s", get.Code, get.Body.String())
	}

	update := performTodoJSON(t, svc.UpdateTodo, http.MethodPut, "/api/v1/todos/"+created.ID.String(), map[string]any{
		"title": "tamper",
	}, other.ID.String(), params)
	if update.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden on update, got %d body=%s", update.Code, update.Body.String())
	}

	complete := performTodoJSON(t, svc.MarkAsDone, http.MethodPatch, "/api/v1/todos/"+created.ID.String()+"/complete", nil, other.ID.String(), params)
	if complete.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden on mark done, got %d body=%s", complete.Code, complete.Body.String())
	}

	remove := performTodoJSON(t, svc.DeleteTodo, http.MethodDelete, "/api/v1/todos/"+created.ID.String(), nil, other.ID.String(), params)
	if remove.Code != http.StatusForbidden {
		t.Fatalf("expected forbidden on delete, got %d body=%s", remove.Code, remove.Body.String())
	}
}
