package nonfunctional_test

import (
	"net/http"
	"testing"

	"backend/api/auth"
	"backend/api/todo"
	"backend/models"
	"backend/tests/testutil"
)

func BenchmarkAuthLogin(b *testing.B) {
	db := testutil.NewSQLiteDB(b, &models.User{}, &models.Log{})
	svc := auth.NewAuthService(db, "benchmark-secret")

	registerCtx, registerRec := testutil.JSONContext(b, http.MethodPost, "/api/v1/auth/register", map[string]any{
		"first_name": "Bench",
		"last_name":  "User",
		"email":      "bench@example.com",
		"password":   "StrongPass123!",
	}, nil)
	svc.Register(registerCtx)
	testutil.MustStatus(b, registerRec, http.StatusCreated)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		loginCtx, loginRec := testutil.JSONContext(b, http.MethodPost, "/api/v1/auth/login", map[string]any{
			"email":    "bench@example.com",
			"password": "StrongPass123!",
		}, nil)
		svc.Login(loginCtx)
		if loginRec.Code != http.StatusOK {
			b.Fatalf("login failed: %s", loginRec.Body.String())
		}
	}
}

func BenchmarkTodoCreate(b *testing.B) {
	db := testutil.NewSQLiteDB(b, &models.User{}, &models.Todo{}, &models.Log{})
	user := models.User{
		Email:         "todo-bench@example.com",
		Password:      "hashed",
		FirstName:     "Bench",
		LastName:      "User",
		Role:          "user",
		IsActive:      true,
		EmailVerified: true,
	}
	if err := db.Create(&user).Error; err != nil {
		b.Fatalf("create user: %v", err)
	}

	svc, err := todo.NewTodoService(db)
	if err != nil {
		b.Fatalf("todo service: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx, rec := testutil.JSONContext(b, http.MethodPost, "/api/v1/todos", map[string]any{
			"title":       "Bench todo",
			"description": "Bench todo description",
			"priority":    "medium",
		}, nil)
		ctx.Set("user_id", user.ID.String())
		svc.CreateTodo(ctx)
		if rec.Code != http.StatusCreated {
			b.Fatalf("todo create failed: %s", rec.Body.String())
		}
	}
}
