package google_oauth_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	credentialsvc "backend/api/credential"
	backendapi "backend/api/credential/google_oauth"
	"backend/database"
	backendmodels "backend/models"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func newGoogleOAuthService(t *testing.T) (*backendapi.GoogleOAuthService, *database.DB) {
	t.Helper()
	t.Setenv("ENCRYPTION_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
	t.Setenv("GOOGLE_CLIENT_ID", "client-id")
	t.Setenv("GOOGLE_CLIENT_SECRET", "client-secret")
	t.Setenv("GOOGLE_REDIRECT_URI", "http://localhost:8080/api/v1/google-oauth/callback")
	db := testutil.NewSQLiteDB(t, &backendmodels.User{}, &backendmodels.Organization{}, &backendmodels.UserOrganization{}, &backendmodels.OAuthState{}, &backendmodels.OAuthPopupToken{}, &backendmodels.Secret{}, &backendmodels.Log{})
	credSvc, err := credentialsvc.NewCredentialService(db)
	if err != nil {
		t.Fatalf("credential service: %v", err)
	}
	svc, err := backendapi.NewGoogleOAuthService(db, credSvc, "client-id", "client-secret", "http://localhost:8080/api/v1/google-oauth/callback", "http://localhost:3000")
	if err != nil {
		t.Fatalf("new google oauth service: %v", err)
	}
	return svc, db
}

func TestInitiateAuth(t *testing.T) {
	svc, db := newGoogleOAuthService(t)
	user := backendmodels.User{ID: uuid.New(), Email: "google@example.com", FirstName: "G", LastName: "User", Password: "hashed", IsActive: true, EmailVerified: true}
	if err := db.DB.Create(&user).Error; err != nil {
		t.Fatalf("seed user: %v", err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	reqBody := strings.NewReader(`{"apps":["drive","sheets"]}`)
	req, _ := http.NewRequest(http.MethodPost, "/api/v1/google-oauth/auth/google", reqBody)
	req.Header.Set("Content-Type", "application/json")
	c.Request = req
	c.Set("user_id", user.ID.String())
	svc.InitiateAuth(c)
	testutil.TraceRecorder(t, http.MethodPost, "/api/v1/google-oauth/auth/google", map[string]any{"apps": []string{"drive", "sheets"}}, w)
	if w.Code != http.StatusOK {
		t.Fatalf("initiate auth status: got %d body=%s", w.Code, w.Body.String())
	}

	var state backendmodels.OAuthState
	if err := db.DB.First(&state).Error; err != nil {
		t.Fatalf("oauth state not created: %v", err)
	}
}

func TestPopupTokensAndStubEndpoints(t *testing.T) {
	svc, db := newGoogleOAuthService(t)
	payload, _ := json.Marshal(backendapi.OAuthTokenDataResponse{})
	token := backendmodels.OAuthPopupToken{Code: "code-1", TokenData: backendmodels.JSONB(payload), ExpiresAt: time.Now().Add(time.Hour)}
	if err := db.DB.Create(&token).Error; err != nil {
		t.Fatalf("seed popup token: %v", err)
	}

	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	req, _ := http.NewRequest(http.MethodGet, "/api/v1/google-oauth/popup-tokens?code=code-1", nil)
	c.Request = req
	svc.GetPopupTokens(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/google-oauth/popup-tokens?code=code-1", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("popup tokens status: got %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest(http.MethodPost, "/api/v1/google-oauth/logout", nil)
	c.Request = req
	svc.Logout(c)
	testutil.TraceRecorder(t, http.MethodPost, "/api/v1/google-oauth/logout", nil, w)
	if w.Code != http.StatusOK {
		t.Fatalf("logout status: got %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest(http.MethodGet, "/api/v1/google-oauth/oauth/tokens", nil)
	c.Request = req
	svc.GetOAuthTokens(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/google-oauth/oauth/tokens", nil, w)
	if w.Code != http.StatusNotImplemented {
		t.Fatalf("oauth tokens status: got %d body=%s", w.Code, w.Body.String())
	}

	w = httptest.NewRecorder()
	c, _ = gin.CreateTestContext(w)
	req, _ = http.NewRequest(http.MethodGet, "/api/v1/google-oauth/user/info", nil)
	c.Request = req
	svc.GetUserInfo(c)
	testutil.TraceRecorder(t, http.MethodGet, "/api/v1/google-oauth/user/info", nil, w)
	if w.Code != http.StatusNotImplemented {
		t.Fatalf("user info status: got %d body=%s", w.Code, w.Body.String())
	}
}
