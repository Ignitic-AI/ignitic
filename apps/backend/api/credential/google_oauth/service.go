package google_oauth

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"backend/api/credential"
	"backend/database"
	"backend/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type GoogleOAuthService struct {
	db            *database.DB
	credentialSvc *credential.CredentialService
	clientID      string
	clientSecret  string
	redirectURI   string
	frontendURL   string
}

func NewGoogleOAuthService(db *database.DB, credentialSvc *credential.CredentialService, clientID, clientSecret, redirectURI, frontendURL string) (*GoogleOAuthService, error) {
	if clientID == "" || clientSecret == "" || redirectURI == "" {
		// We still construct the service so routes exist, but callbacks will fail fast.
	}
	if frontendURL == "" {
		frontendURL = "http://localhost:3000"
	}
	return &GoogleOAuthService{
		db:            db,
		credentialSvc: credentialSvc,
		clientID:      clientID,
		clientSecret:  clientSecret,
		redirectURI:   redirectURI,
		frontendURL:   frontendURL,
	}, nil
}

// InitiateAuth starts the Google OAuth flow for selected apps.
// POST /api/v1/google-oauth/auth/google
func (s *GoogleOAuthService) InitiateAuth(c *gin.Context) {
	userIDStr := c.GetString("user_id")
	if userIDStr == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not authenticated"})
		return
	}
	var req InitiateAuthRequest
	if err := c.ShouldBindJSON(&req); err != nil || len(req.Apps) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "apps are required"})
		return
	}

	// Map requested apps to scopes.
	scopeSet := map[string]bool{}
	for _, s := range BaseScopes {
		scopeSet[s] = true
	}
	validApps := make([]string, 0, len(req.Apps))
	for _, appName := range req.Apps {
		app := GoogleApp(strings.ToLower(appName))
		if scopes, ok := AppScopes[app]; ok {
			validApps = append(validApps, string(app))
			for _, sc := range scopes {
				scopeSet[sc] = true
			}
		}
	}
	if len(validApps) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no valid Google apps requested"})
		return
	}
	scopes := make([]string, 0, len(scopeSet))
	for sc := range scopeSet {
		scopes = append(scopes, sc)
	}

	userUUID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid user id"})
		return
	}

	// Resolve credential_type: use request value or derive from selected apps
	credentialType := strings.TrimSpace(req.CredentialType)
	if credentialType == "" {
		credentialType = appsToCredentialType(validApps)
	}

	// Build state and persist to oauth_states.
	state := uuid.NewString()
	selectedAppsJSON, _ := json.Marshal(validApps)
	scopesJSON, _ := json.Marshal(scopes)
	expiresAt := time.Now().UTC().Add(15 * time.Minute)
	oauthState := models.OAuthState{
		State:          state,
		UserID:         userUUID,
		SelectedApps:   string(selectedAppsJSON),
		Scopes:         string(scopesJSON),
		CredentialType: credentialType,
		UsePopup:       req.UsePopup,
		ExpiresAt:      expiresAt,
	}
	if err := s.db.Create(&oauthState).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to persist oauth state"})
		return
	}

	// Build Google auth URL.
	u, err := url.Parse("https://accounts.google.com/o/oauth2/v2/auth")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to build Google auth URL"})
		return
	}
	q := u.Query()
	clientID := s.clientID
	if clientID == "" {
		clientID = os.Getenv("GOOGLE_CLIENT_ID")
	}
	redirectURI := s.redirectURI
	if redirectURI == "" {
		redirectURI = os.Getenv("GOOGLE_REDIRECT_URI")
	}
	q.Set("client_id", clientID)
	q.Set("redirect_uri", redirectURI)
	q.Set("response_type", "code")
	q.Set("scope", strings.Join(scopes, " "))
	q.Set("access_type", "offline")
	q.Set("prompt", "consent")
	q.Set("state", state)
	u.RawQuery = q.Encode()

	c.JSON(http.StatusOK, InitiateAuthResponse{
		AuthURL: u.String(),
		State:   state,
	})
}

// HandleCallback processes the Google OAuth callback (public route).
// GET /api/v1/google-oauth/callback?code=...&state=...
func (s *GoogleOAuthService) HandleCallback(c *gin.Context) {
	code := c.Query("code")
	state := c.Query("state")
	if code == "" || state == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing code or state"})
		return
	}

	var oauthState models.OAuthState
	if err := s.db.Where("state = ? AND expires_at > NOW()", state).First(&oauthState).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired state"})
		return
	}

	tokenResp, userInfo, err := s.exchangeCodeForTokensAndUserInfo(code)
	if err != nil {
		s.redirectOAuthError(c, "failed to exchange code")
		return
	}

	// Resolve credential type (app) for storage
	credentialType := strings.TrimSpace(oauthState.CredentialType)
	if credentialType == "" {
		apps := []string{}
		_ = json.Unmarshal([]byte(oauthState.SelectedApps), &apps)
		credentialType = appsToCredentialType(apps)
	}

	scopes := []string{}
	_ = json.Unmarshal([]byte(oauthState.Scopes), &scopes)
	apps := []string{}
	_ = json.Unmarshal([]byte(oauthState.SelectedApps), &apps)

	// Build full OAuthTokenDataResponse for either popup (postMessage) or redirect (save)
	var resp OAuthTokenDataResponse
	resp.OAuthTokenData.AccessToken = tokenResp.AccessToken
	resp.OAuthTokenData.RefreshToken = tokenResp.RefreshToken
	resp.OAuthTokenData.TokenType = tokenResp.TokenType
	resp.OAuthTokenData.ExpiresIn = tokenResp.ExpiresIn
	resp.OAuthTokenData.Scope = tokenResp.Scope
	resp.OAuthTokenData.IDToken = tokenResp.IDToken
	resp.AdditionalProperties.TokenURI = "https://oauth2.googleapis.com/token"
	resp.AdditionalProperties.Scopes = scopes
	resp.AdditionalProperties.GrantedApps = apps
	resp.AdditionalProperties.RedirectURI = s.redirectURI
	resp.UserInfo.Email = userInfo.Email
	resp.UserInfo.Name = userInfo.Name
	resp.Notice = "Google OAuth completed successfully."
	resp.Description = "Tokens are returned for client-side handling. Persist them as needed."

	_ = s.db.Delete(&oauthState).Error

	if oauthState.UsePopup {
		// Popup flow: store tokens temporarily, redirect popup to frontend.
		// Frontend (same-origin) fetches tokens, postMessages to opener, closes.
		// This avoids cross-origin postMessage (8080->3000) which can fail.
		s.redirectPopupToFrontend(c, &resp)
		return
	}

	// Redirect flow: save credentials and redirect to frontend
	oauthTokenDataJSON, _ := json.Marshal(map[string]interface{}{
		"access_token":  tokenResp.AccessToken,
		"refresh_token": tokenResp.RefreshToken,
		"token_type":    tokenResp.TokenType,
		"expires_in":    tokenResp.ExpiresIn,
		"scope":         tokenResp.Scope,
		"id_token":      tokenResp.IDToken,
	})
	additionalProps := map[string]interface{}{
		"token_uri":    "https://oauth2.googleapis.com/token",
		"scopes":       scopes,
		"granted_apps": apps,
		"redirect_uri": s.redirectURI,
	}
	additionalPropsJSON, _ := json.Marshal(additionalProps)

	if s.credentialSvc != nil {
		if err := s.credentialSvc.SaveGoogleOAuthCredentials(
			credentialType,
			string(oauthTokenDataJSON),
			string(additionalPropsJSON),
			oauthState.UserID,
			oauthState.OrganizationID,
		); err != nil {
			s.redirectOAuthError(c, "failed to save credentials")
			return
		}
	}
	s.redirectOAuthSuccess(c, credentialType, userInfo.Email)
}

func (s *GoogleOAuthService) redirectOAuthSuccess(c *gin.Context, credentialType, userEmail string) {
	u, err := url.Parse(strings.TrimSuffix(s.frontendURL, "/") + "/secrets")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"notice": "Google OAuth completed. Credentials saved. Visit /secrets to view."})
		return
	}
	q := u.Query()
	q.Set("google_oauth", "success")
	q.Set("credential_type", credentialType)
	if userEmail != "" {
		q.Set("email", userEmail)
	}
	u.RawQuery = q.Encode()
	c.Redirect(http.StatusFound, u.String())
}

// redirectPopupToFrontend stores token data temporarily and redirects popup to frontend.
// Frontend fetches via GET /popup-tokens?code=xxx, then postMessages to opener (same-origin).
func (s *GoogleOAuthService) redirectPopupToFrontend(c *gin.Context, resp *OAuthTokenDataResponse) {
	data, err := json.Marshal(resp)
	if err != nil {
		s.redirectOAuthError(c, "failed to serialize token data")
		return
	}
	code := uuid.NewString()
	expiresAt := time.Now().UTC().Add(2 * time.Minute)
	token := models.OAuthPopupToken{
		Code:      code,
		TokenData: models.JSONB(data),
		ExpiresAt: expiresAt,
	}
	if err := s.db.Create(&token).Error; err != nil {
		s.redirectOAuthError(c, "failed to store token")
		return
	}
	u, err := url.Parse(strings.TrimSuffix(s.frontendURL, "/") + "/secrets")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "invalid frontend URL"})
		return
	}
	q := u.Query()
	q.Set("google_oauth_code", code)
	u.RawQuery = q.Encode()
	c.Redirect(http.StatusFound, u.String())
}

// GetPopupTokens returns temporary OAuth token data for popup flow (auth required).
// GET /api/v1/google-oauth/popup-tokens?code=xxx
func (s *GoogleOAuthService) GetPopupTokens(c *gin.Context) {
	code := strings.TrimSpace(c.Query("code"))
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing code"})
		return
	}
	var token models.OAuthPopupToken
	if err := s.db.Where("code = ? AND expires_at > NOW()", code).First(&token).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "invalid or expired code"})
		return
	}
	// Delete immediately - one-time use
	_ = s.db.Delete(&token).Error
	var data OAuthTokenDataResponse
	if err := json.Unmarshal(token.TokenData, &data); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse token data"})
		return
	}
	c.JSON(http.StatusOK, data)
}

func (s *GoogleOAuthService) redirectOAuthError(c *gin.Context, msg string) {
	u, err := url.Parse(strings.TrimSuffix(s.frontendURL, "/") + "/secrets")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": msg})
		return
	}
	q := u.Query()
	q.Set("google_oauth", "error")
	q.Set("message", msg)
	u.RawQuery = q.Encode()
	c.Redirect(http.StatusFound, u.String())
}

// appsToCredentialType maps Google app codes to n8n credential schema keys.
func appsToCredentialType(apps []string) string {
	if len(apps) == 0 {
		return "googleDriveOAuth2Api"
	}
	m := map[string]string{
		"drive":        "googleDriveOAuth2Api",
		"sheets":       "googleSheetsOAuth2Api",
		"gmail":        "gmailOAuth2Api",
		"calendar":     "googleCalendarOAuth2Api",
		"docs":         "googleDocsOAuth2Api",
		"ads":          "googleAdsOAuth2Api",
		"bigquery":     "googleBigQueryOAuth2Api",
		"contacts":     "googleContactsOAuth2Api",
		"youtube":      "youtubeOAuth2Api",
		"slides":       "googleSlidesOAuth2Api",
		"forms":        "googleFormsOAuth2Api",
	}
	for _, a := range apps {
		if ct, ok := m[strings.ToLower(a)]; ok {
			return ct
		}
	}
	return "googleDriveOAuth2Api"
}

// exchangeCodeForTokensAndUserInfo exchanges authorization code for tokens and then fetches userinfo.
func (s *GoogleOAuthService) exchangeCodeForTokensAndUserInfo(code string) (*GoogleTokenResponse, *GoogleUserInfo, error) {
	clientID := s.clientID
	if clientID == "" {
		clientID = os.Getenv("GOOGLE_CLIENT_ID")
	}
	clientSecret := s.clientSecret
	if clientSecret == "" {
		clientSecret = os.Getenv("GOOGLE_CLIENT_SECRET")
	}
	redirectURI := s.redirectURI
	if redirectURI == "" {
		redirectURI = os.Getenv("GOOGLE_REDIRECT_URI")
	}

	values := url.Values{}
	values.Set("code", code)
	values.Set("client_id", clientID)
	values.Set("client_secret", clientSecret)
	values.Set("redirect_uri", redirectURI)
	values.Set("grant_type", "authorization_code")

	req, err := http.NewRequest(http.MethodPost, "https://oauth2.googleapis.com/token", bytes.NewBufferString(values.Encode()))
	if err != nil {
		return nil, nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		raw, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, nil, fmt.Errorf("google token endpoint status %d: %s", resp.StatusCode, string(raw))
	}

	var token GoogleTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, nil, err
	}

	// Fetch userinfo
	userReq, err := http.NewRequest(http.MethodGet, "https://www.googleapis.com/oauth2/v3/userinfo", nil)
	if err != nil {
		return nil, nil, err
	}
	userReq.Header.Set("Authorization", "Bearer "+token.AccessToken)

	userResp, err := http.DefaultClient.Do(userReq)
	if err != nil {
		return nil, nil, err
	}
	defer userResp.Body.Close()
	if userResp.StatusCode >= 400 {
		raw, _ := io.ReadAll(io.LimitReader(userResp.Body, 4096))
		return nil, nil, fmt.Errorf("google userinfo endpoint status %d: %s", userResp.StatusCode, string(raw))
	}

	var info GoogleUserInfo
	if err := json.NewDecoder(userResp.Body).Decode(&info); err != nil {
		return nil, nil, err
	}
	return &token, &info, nil
}

// GetOAuthTokens is a placeholder that would normally return stored token data.
// For now, it simply returns 501 to indicate it's not yet persisted server-side.
func (s *GoogleOAuthService) GetOAuthTokens(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "GetOAuthTokens not implemented server-side; use callback response tokens"})
}

// GetUserInfo is a small helper that would normally read stored user info.
func (s *GoogleOAuthService) GetUserInfo(c *gin.Context) {
	c.JSON(http.StatusNotImplemented, gin.H{"error": "GetUserInfo not implemented; persist user info as needed"})
}

// Logout is a stub that simply acknowledges logout.
func (s *GoogleOAuthService) Logout(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "Google OAuth logout endpoint hit (no server-side token revocation implemented)."})
}

