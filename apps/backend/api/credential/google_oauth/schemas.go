package google_oauth

// GoogleApp represents a Google service/app type.
type GoogleApp string

const (
	// Core Google Services
	AppSheets   GoogleApp = "sheets"
	AppDrive    GoogleApp = "drive"
	AppGmail    GoogleApp = "gmail"
	AppCalendar GoogleApp = "calendar"
	AppDocs     GoogleApp = "docs"
	AppForms    GoogleApp = "forms"
	AppSlides   GoogleApp = "slides"
	AppContacts GoogleApp = "contacts"
	AppBooks    GoogleApp = "books"
	AppPhotos   GoogleApp = "photos"
	AppYouTube  GoogleApp = "youtube"

	// Google Ads
	AppAds GoogleApp = "ads"

	// Google Cloud Services
	AppBigQuery             GoogleApp = "bigquery"
	AppCloudStorage         GoogleApp = "cloud_storage"
	AppCloudNaturalLanguage GoogleApp = "cloud_natural_language"
	AppFirebaseFirestore    GoogleApp = "firebase_firestore"
	AppFirebaseRealtimeDB   GoogleApp = "firebase_realtime_db"

	// Google Business & Communication
	AppBusinessProfile GoogleApp = "business_profile"
	AppChat            GoogleApp = "chat"
	AppPerspective     GoogleApp = "perspective"
)

// AppScopes defines OAuth scopes for each Google app.
var AppScopes = map[GoogleApp][]string{
	// Google Sheets
	AppSheets: {
		"https://www.googleapis.com/auth/spreadsheets.readonly",
		"https://www.googleapis.com/auth/spreadsheets",
	},
	// Google Drive
	AppDrive: {
		"https://www.googleapis.com/auth/drive.readonly",
		"https://www.googleapis.com/auth/drive.file",
		"https://www.googleapis.com/auth/drive.metadata.readonly",
	},
	// Gmail
	AppGmail: {
		"https://www.googleapis.com/auth/gmail.readonly",
		"https://www.googleapis.com/auth/gmail.send",
		"https://www.googleapis.com/auth/gmail.modify",
	},
	// Google Calendar
	AppCalendar: {
		"https://www.googleapis.com/auth/calendar.readonly",
		"https://www.googleapis.com/auth/calendar.events",
	},
	// Google Docs
	AppDocs: {
		"https://www.googleapis.com/auth/documents",
		"https://www.googleapis.com/auth/documents.readonly",
	},
	// Google Forms
	AppForms: {
		"https://www.googleapis.com/auth/forms",
		"https://www.googleapis.com/auth/forms.responses.readonly",
	},
	// Google Slides
	AppSlides: {
		"https://www.googleapis.com/auth/presentations",
		"https://www.googleapis.com/auth/presentations.readonly",
	},
	// Google Contacts
	AppContacts: {
		"https://www.googleapis.com/auth/contacts.readonly",
		"https://www.googleapis.com/auth/contacts",
	},
	// Google Books
	AppBooks: {
		"https://www.googleapis.com/auth/books",
	},
	// Google Photos
	AppPhotos: {
		"https://www.googleapis.com/auth/photoslibrary",
		"https://www.googleapis.com/auth/photoslibrary.readonly",
	},
	// YouTube
	AppYouTube: {
		"https://www.googleapis.com/auth/youtube",
		"https://www.googleapis.com/auth/youtube.readonly",
		"https://www.googleapis.com/auth/youtube.upload",
	},
	// Google Ads
	AppAds: {
		"https://www.googleapis.com/auth/adwords",
	},
	// Google BigQuery
	AppBigQuery: {
		"https://www.googleapis.com/auth/bigquery",
		"https://www.googleapis.com/auth/bigquery.readonly",
		"https://www.googleapis.com/auth/cloud-platform",
	},
	// Google Cloud Storage
	AppCloudStorage: {
		"https://www.googleapis.com/auth/devstorage.read_write",
		"https://www.googleapis.com/auth/devstorage.read_only",
		"https://www.googleapis.com/auth/cloud-platform",
	},
	// Google Cloud Natural Language
	AppCloudNaturalLanguage: {
		"https://www.googleapis.com/auth/cloud-language",
		"https://www.googleapis.com/auth/cloud-platform",
	},
	// Google Firebase Cloud Firestore
	AppFirebaseFirestore: {
		"https://www.googleapis.com/auth/datastore",
		"https://www.googleapis.com/auth/cloud-platform",
	},
	// Google Firebase Realtime Database
	AppFirebaseRealtimeDB: {
		"https://www.googleapis.com/auth/firebase",
		"https://www.googleapis.com/auth/userinfo.email",
		"https://www.googleapis.com/auth/cloud-platform",
	},
	// Google Business Profile (My Business)
	AppBusinessProfile: {
		"https://www.googleapis.com/auth/business.manage",
	},
	// Google Chat
	AppChat: {
		"https://www.googleapis.com/auth/chat.bot",
		"https://www.googleapis.com/auth/chat.messages",
		"https://www.googleapis.com/auth/chat.spaces",
	},
	// Google Perspective API
	AppPerspective: {
		"https://www.googleapis.com/auth/cloud-platform",
	},
}

// BaseScopes are always requested.
var BaseScopes = []string{
	"https://www.googleapis.com/auth/userinfo.email",
	"https://www.googleapis.com/auth/userinfo.profile",
	"openid",
}

// InitiateAuthRequest initiates Google OAuth flow.
type InitiateAuthRequest struct {
	Apps           []string `json:"apps" binding:"required"`
	CredentialType string   `json:"credential_type"` // e.g. googleDriveOAuth2Api - stored for callback
	UsePopup       bool     `json:"use_popup"`       // if true, callback returns HTML that postMessages data to opener (for form population)
}

// InitiateAuthResponse returns authorization URL.
type InitiateAuthResponse struct {
	AuthURL string `json:"auth_url"`
	State   string `json:"state"`
}

// OAuthCallbackRequest handles OAuth callback.
type OAuthCallbackRequest struct {
	Code  string `json:"code" binding:"required"`
	State string `json:"state" binding:"required"`
}

// OAuthTokenDataResponse matches Python Flask response structure (simplified).
type OAuthTokenDataResponse struct {
	OAuthTokenData struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		TokenType    string `json:"token_type"`
		ExpiresIn    int64  `json:"expires_in"`
		ExpiresAt    string `json:"expires_at,omitempty"`
		Scope        string `json:"scope"`
		IDToken      string `json:"id_token,omitempty"`
	} `json:"oauth_token_data"`
	AdditionalProperties struct {
		TokenURI    string   `json:"token_uri"`
		Scopes      []string `json:"scopes"`
		GrantedApps []string `json:"granted_apps"`
		RedirectURI string   `json:"redirect_uri"`
	} `json:"additional_properties"`
	UserInfo struct {
		Email string `json:"email"`
		Name  string `json:"name"`
	} `json:"user_info"`
	Notice      string `json:"notice"`
	Description string `json:"description"`
}

// UserInfoResponse returns user information.
type UserInfoResponse struct {
	Email string   `json:"email"`
	Name  string   `json:"name"`
	Apps  []string `json:"apps"`
}

// GoogleTokenResponse from Google OAuth token endpoint.
type GoogleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int64  `json:"expires_in"`
	Scope        string `json:"scope"`
	IDToken      string `json:"id_token,omitempty"`
}

// GoogleUserInfo from Google userinfo endpoint.
type GoogleUserInfo struct {
	Email string `json:"email"`
	Name  string `json:"name"`
	ID    string `json:"id"`
}

