package auth_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"backend/api/auth"
	backendmodels "backend/models"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

func newAuthService(t *testing.T) (*auth.AuthService, *gorm.DB) {
	t.Helper()
	t.Setenv("BREVO_API_KEY", "test")
	t.Setenv("SENDER_EMAIL", "noreply@example.com")
	t.Setenv("SENDER_NAME", "IgniticAI")
	t.Setenv("FRONTEND_URL", "http://localhost:3000")

	db := testutil.NewSQLiteDB(t, &backendmodels.User{}, &backendmodels.Log{})
	return auth.NewAuthService(db, "test-secret"), db.DB
}

func serveJSON(t *testing.T, method, target string, body any, handler gin.HandlerFunc, ctxKeys map[string]string) *httptest.ResponseRecorder {
	t.Helper()
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	var reqBody *bytes.Reader
	if body == nil {
		reqBody = bytes.NewReader(nil)
	} else {
		encoded, _ := json.Marshal(body)
		reqBody = bytes.NewReader(encoded)
	}
	req, _ := http.NewRequest(method, target, reqBody)
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	for k, v := range ctxKeys {
		c.Set(k, v)
	}
	handler(c)
	testutil.TraceRecorder(t, method, target, body, w)
	return w
}

func seedUser(t *testing.T, db *gorm.DB, email, password string, verified bool) backendmodels.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}
	user := backendmodels.User{
		ID:            uuid.New(),
		Email:         email,
		Password:      string(hash),
		FirstName:     "John",
		LastName:      "Doe",
		Role:          "user",
		IsActive:      true,
		EmailVerified: verified,
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}
	return user
}

func TestRegisterLoginAndProfileFlow(t *testing.T) {
	svc, db := newAuthService(t)

	registerBody := map[string]any{
		"first_name": "Jane",
		"last_name":  "Doe",
		"email":      "jane@example.com",
		"password":   "Strong!Pass123",
	}
	w := serveJSON(t, http.MethodPost, "/api/v1/auth/register", registerBody, svc.Register, nil)
	if w.Code != http.StatusCreated {
		t.Fatalf("register status: got %d body=%s", w.Code, w.Body.String())
	}

	var user backendmodels.User
	if err := db.Where("email = ?", "jane@example.com").First(&user).Error; err != nil {
		t.Fatalf("user not created: %v", err)
	}
	if user.Password == "Strong!Pass123" {
		t.Fatalf("password was not hashed")
	}

	loginBody := map[string]any{"email": "jane@example.com", "password": "Strong!Pass123"}
	w = serveJSON(t, http.MethodPost, "/api/v1/auth/login", loginBody, svc.Login, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("login status: got %d body=%s", w.Code, w.Body.String())
	}

	w = serveJSON(t, http.MethodGet, "/api/v1/auth/profile", nil, svc.GetProfile, map[string]string{"user_id": user.ID.String()})
	if w.Code != http.StatusOK {
		t.Fatalf("get profile status: got %d body=%s", w.Code, w.Body.String())
	}
}

func TestAuthValidationBranches(t *testing.T) {
	svc, db := newAuthService(t)
	user := seedUser(t, db, "alice@example.com", "Strong!Pass123", false)

	t.Run("duplicate registration", func(t *testing.T) {
		w := serveJSON(t, http.MethodPost, "/api/v1/auth/register", map[string]any{
			"first_name": "A",
			"last_name":  "B",
			"email":      "alice@example.com",
			"password":   "Strong!Pass123",
		}, svc.Register, nil)
		if w.Code != http.StatusConflict {
			t.Fatalf("expected conflict, got %d body=%s", w.Code, w.Body.String())
		}
	})

	t.Run("bad login", func(t *testing.T) {
		w := serveJSON(t, http.MethodPost, "/api/v1/auth/login", map[string]any{
			"email":    user.Email,
			"password": "Wrong!Pass123",
		}, svc.Login, nil)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected unauthorized, got %d body=%s", w.Code, w.Body.String())
		}
	})

	t.Run("refresh token without context", func(t *testing.T) {
		w := serveJSON(t, http.MethodPost, "/api/v1/auth/refresh", nil, svc.RefreshToken, nil)
		if w.Code != http.StatusUnauthorized {
			t.Fatalf("expected unauthorized, got %d", w.Code)
		}
	})
}

func TestOnboardingAndProfileUpdates(t *testing.T) {
	svc, db := newAuthService(t)
	user := seedUser(t, db, "bob@example.com", "Strong!Pass123", false)

	w := serveJSON(t, http.MethodPost, "/api/v1/auth/onboarding/personal", map[string]any{
		"has_organization":         false,
		"created_organization":     false,
		"org_name":                 "Acme",
		"platform":                 "Shopify",
		"work_on_multiple_platforms": true,
		"selected_brands":          []string{"BrandA"},
		"size_of_org":              "Small team (2-10)",
		"your_role":                "Founder",
		"country":                  "Pakistan",
		"where_you_hear_us":        "Google",
		"preferred_automation_ids": []string{"auto-1"},
		"invited_emails":           []string{"team@example.com"},
	}, svc.SavePersonalOnboarding, map[string]string{"user_id": user.ID.String()})
	if w.Code != http.StatusOK {
		t.Fatalf("save onboarding status: got %d body=%s", w.Code, w.Body.String())
	}

	w = serveJSON(t, http.MethodPut, "/api/v1/auth/profile", map[string]any{
		"first_name": "Bobby",
		"last_name":  "Tables",
		"phone":      "+1 (555) 123-4567",
		"company":    "Acme Inc.",
	}, svc.UpdateProfile, map[string]string{"user_id": user.ID.String()})
	if w.Code != http.StatusOK {
		t.Fatalf("update profile status: got %d body=%s", w.Code, w.Body.String())
	}
}

func TestPasswordAndVerificationFlows(t *testing.T) {
	svc, db := newAuthService(t)
	user := seedUser(t, db, "carol@example.com", "Strong!Pass123", false)

	w := serveJSON(t, http.MethodPost, "/api/v1/auth/change-password", map[string]any{
		"current_password": "Strong!Pass123",
		"new_password":     "NewStrong!Pass123",
	}, svc.ChangePassword, map[string]string{"user_id": user.ID.String()})
	if w.Code != http.StatusOK {
		t.Fatalf("change password status: got %d body=%s", w.Code, w.Body.String())
	}

	w = serveJSON(t, http.MethodPost, "/api/v1/auth/forgot-password", map[string]any{
		"email": user.Email,
	}, svc.ForgotPassword, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("forgot password status: got %d body=%s", w.Code, w.Body.String())
	}

	if err := db.Where("email = ?", user.Email).First(&user).Error; err != nil {
		t.Fatalf("reload user: %v", err)
	}
	if user.ResetToken == "" {
		t.Fatalf("expected reset token to be stored")
	}

	w = serveJSON(t, http.MethodPost, "/api/v1/auth/reset-password", map[string]any{
		"token":        user.ResetToken,
		"new_password": "ResetStrong!Pass123",
	}, svc.ResetPassword, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("reset password status: got %d body=%s", w.Code, w.Body.String())
	}

	user.VerificationToken = "123456"
	if err := db.Save(&user).Error; err != nil {
		t.Fatalf("save verification token: %v", err)
	}
	w = serveJSON(t, http.MethodPost, "/api/v1/auth/verify-email", map[string]any{
		"token": "123456",
	}, svc.VerifyEmail, nil)
	if w.Code != http.StatusOK {
		t.Fatalf("verify email status: got %d body=%s", w.Code, w.Body.String())
	}
}
