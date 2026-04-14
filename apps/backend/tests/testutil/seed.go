package testutil

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"backend/models"
	"github.com/google/uuid"
	"github.com/lib/pq"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type DemoData struct {
	Admin             models.User
	Member            models.User
	Personal          models.User
	Organization      models.Organization
	AdminMembership   models.UserOrganization
	MemberMembership  models.UserOrganization
	Invitation        models.OrganizationInvitation
	BusinessProfile   models.OrganizationBusinessProfile
	PersonalTodo      models.Todo
	OrgTodoTodo       models.Todo
	OrgTodoInProgress models.Todo
	OrgTodoDone       models.Todo
	PersonalAsset     models.Asset
	OrgAsset          models.Asset
	PersonalSecret    models.Secret
	OrgSecret         models.Secret
	CreditAccount     models.CreditAccount
	CreditRecord      models.CreditRecord
	OAuthState        models.OAuthState
	OAuthPopupToken   models.OAuthPopupToken
	StarterPlan       models.Plan
	LogEntryID        uuid.UUID
}

// SeedDemoData populates a reusable baseline fixture set for tests.
func SeedDemoData(t testing.TB, db *gorm.DB) DemoData {
	t.Helper()

	now := time.Now().UTC().Truncate(time.Second)
	admin := mustSeedUser(t, db, "admin@example.com", "AdminPass123!", "Admin", "User", true)
	member := mustSeedUser(t, db, "member@example.com", "MemberPass123!", "Member", "User", true)
	personal := mustSeedUser(t, db, "personal@example.com", "PersonalPass123!", "Personal", "User", false)

	org := models.Organization{
		Name:                    "Demo Commerce",
		Description:             "Seeded organization for test coverage",
		EmployeeCount:           25,
		EcommerceDomain:         "demo-commerce.example",
		Industry:                "Retail",
		CompanySize:             "11-50",
		Website:                 "https://demo-commerce.example",
		Country:                 "Pakistan",
		City:                    "Karachi",
		Address:                 "Demo Street 1",
		PhoneNumber:             "+923001234567",
		IsActive:                true,
		SubscriptionPlan:        "free",
		HearAboutUs:             "referral",
		WorkOnMultiplePlatforms: true,
		SelectedBrands:          json.RawMessage(`["brand-a","brand-b"]`),
		PreferredAutomationIDs:  json.RawMessage(`["automation-a","automation-b"]`),
		CreatedBy:               admin.ID,
	}
	if err := db.Create(&org).Error; err != nil {
		t.Fatalf("seed organization: %v", err)
	}

	adminMembership := models.UserOrganization{
		UserID:             admin.ID,
		OrganizationID:     org.ID,
		Role:               "admin",
		OnboardingJobTitle: "Founder",
		IsActive:           true,
	}
	if err := db.Create(&adminMembership).Error; err != nil {
		t.Fatalf("seed admin membership: %v", err)
	}

	memberMembership := models.UserOrganization{
		UserID:             member.ID,
		OrganizationID:     org.ID,
		Role:               "member",
		OnboardingJobTitle: "Operations Lead",
		IsActive:           true,
	}
	if err := db.Create(&memberMembership).Error; err != nil {
		t.Fatalf("seed member membership: %v", err)
	}

	invitation := models.OrganizationInvitation{
		OrganizationID: org.ID,
		Email:          "pending.member@example.com",
		Role:           "member",
		Status:         "pending",
		InvitedBy:      admin.ID,
		ExpiresAt:      now.AddDate(0, 0, 7),
	}
	if err := db.Create(&invitation).Error; err != nil {
		t.Fatalf("seed invitation: %v", err)
	}

	businessProfile := models.OrganizationBusinessProfile{
		OrganizationID:        org.ID,
		BusinessHours:         "Mon-Fri 09:00-18:00",
		PrimaryMarkets:        pq.StringArray{"PK", "UAE"},
		DefaultCurrency:       "PKR",
		SupportedLanguages:    pq.StringArray{"en", "ur"},
		SupportEmail:          "support@demo-commerce.example",
		SupportChannels:       pq.StringArray{"email", "whatsapp"},
		SocialLinks:           models.StringMap{"website": "https://demo-commerce.example"},
		FulfillmentMethod:     "warehouse",
		ShippingCarriers:      pq.StringArray{"DHL", "TCS"},
		ReturnsPolicyURL:      "https://demo-commerce.example/returns",
		PaymentGateways:       pq.StringArray{"stripe", "bank-transfer"},
		TaxIdentifiers:        models.StringMap{"ntn": "1234567-8"},
		PrimaryContacts:       models.ContactArray{{Name: "Alice", Role: "Operations", Email: "alice@demo-commerce.example"}},
		ComplianceContacts:    models.ContactArray{{Name: "Bob", Role: "Legal", Email: "bob@demo-commerce.example"}},
		EcommercePlatforms:    models.PlatformArray{{Name: "Shopify", Version: "2025", URL: "https://shopify.com"}},
		KeySystems:            pq.StringArray{"erp", "crm"},
		HolidayBlackoutDates:  pq.StringArray{"2026-12-25"},
		DataProcessingAddenda: "Standard DPA",
	}
	if err := db.Create(&businessProfile).Error; err != nil {
		t.Fatalf("seed business profile: %v", err)
	}

	personalTodo := models.Todo{
		UserID:      personal.ID,
		Title:       "Personal onboarding",
		Description: "Complete personal onboarding",
		Priority:    models.PriorityMedium,
		Status:      models.StatusTodo,
		Progress:    0,
		CreatedBy:   personal.ID,
		Tags:        []string{"onboarding", "personal"},
		Metadata:    map[string]interface{}{"seed": true, "scope": "personal"},
	}
	if err := db.Create(&personalTodo).Error; err != nil {
		t.Fatalf("seed personal todo: %v", err)
	}

	orgTodoTodo := models.Todo{
		UserID:         admin.ID,
		OrganizationID: &org.ID,
		Title:          "Seed todo",
		Description:    "Seed todo for status filter",
		Priority:       models.PriorityHigh,
		Status:         models.StatusTodo,
		Progress:       0,
		CreatedBy:      admin.ID,
		Tags:           []string{"seed", "todo"},
	}
	if err := db.Create(&orgTodoTodo).Error; err != nil {
		t.Fatalf("seed org todo todo: %v", err)
	}

	orgTodoInProgress := models.Todo{
		UserID:         admin.ID,
		OrganizationID: &org.ID,
		Title:          "Seed in progress",
		Description:    "Seed todo in progress",
		Priority:       models.PriorityMedium,
		Status:         models.StatusInProgress,
		Progress:       50,
		CreatedBy:      admin.ID,
	}
	if err := db.Create(&orgTodoInProgress).Error; err != nil {
		t.Fatalf("seed org todo in progress: %v", err)
	}

	orgTodoDone := models.Todo{
		UserID:         admin.ID,
		OrganizationID: &org.ID,
		Title:          "Seed done",
		Description:    "Seed todo done",
		Priority:       models.PriorityLow,
		Status:         models.StatusDone,
		Progress:       100,
		CreatedBy:      admin.ID,
	}
	if err := db.Create(&orgTodoDone).Error; err != nil {
		t.Fatalf("seed org todo done: %v", err)
	}

	personalAsset := models.Asset{
		UserID:          &personal.ID,
		Category:        string(models.MediaDocuments),
		Title:           "Personal doc",
		StorageProvider: "local",
		Path:            "/tmp/personal-doc.pdf",
		URL:             "https://example.invalid/personal-doc.pdf",
		MimeType:        "application/pdf",
		FileExt:         ".pdf",
		SizeBytes:       1024,
		Tags:            []string{"personal", "docs"},
		Metadata:        map[string]interface{}{"seed": true},
		CreatedBy:       personal.ID,
	}
	if err := db.Create(&personalAsset).Error; err != nil {
		t.Fatalf("seed personal asset: %v", err)
	}

	orgAsset := models.Asset{
		OrganizationID:  &org.ID,
		UserID:          &admin.ID,
		Category:        string(models.BrandAssets),
		Title:           "Brand kit",
		StorageProvider: "local",
		Path:            "/tmp/brand-kit.zip",
		URL:             "https://example.invalid/brand-kit.zip",
		MimeType:        "application/zip",
		FileExt:         ".zip",
		SizeBytes:       4096,
		Tags:            []string{"brand", "assets"},
		Metadata:        map[string]interface{}{"seed": true, "org": org.Name},
		CreatedBy:       admin.ID,
	}
	if err := db.Create(&orgAsset).Error; err != nil {
		t.Fatalf("seed org asset: %v", err)
	}

	personalSecret := models.Secret{
		App:            strPtr("demo"),
		Name:           "personal-token",
		Description:    strPtr("personal secret"),
		Ciphertext:     []byte("ciphertext-personal"),
		IV:             []byte("iv-personal"),
		Algo:           "AES-256-GCM",
		CreatedBy:      personal.ID,
		OrganizationID: nil,
	}
	if err := db.Create(&personalSecret).Error; err != nil {
		t.Fatalf("seed personal secret: %v", err)
	}

	orgSecret := models.Secret{
		App:            strPtr("demo"),
		Name:           "org-token",
		Description:    strPtr("organization secret"),
		Ciphertext:     []byte("ciphertext-org"),
		IV:             []byte("iv-org"),
		Algo:           "AES-256-GCM",
		CreatedBy:      admin.ID,
		OrganizationID: &org.ID,
	}
	if err := db.Create(&orgSecret).Error; err != nil {
		t.Fatalf("seed org secret: %v", err)
	}

	creditAccount := models.CreditAccount{
		OwnerType:       "organization",
		OwnerID:         org.ID,
		PlanCode:        "starter",
		TotalCredits:    1000,
		CreditsConsumed: 120,
		CycleStart:      now.AddDate(0, 0, -1),
		CycleEnd:        now.AddDate(0, 0, 29),
		Status:          "active",
	}
	if err := db.Create(&creditAccount).Error; err != nil {
		t.Fatalf("seed credit account: %v", err)
	}

	creditRecord := models.CreditRecord{
		CreditAccountID:   creditAccount.ID,
		RecordType:        "consume",
		CreditsDelta:      -120,
		TotalCreditsAfter: 1000,
		CreditsUsedAfter:  120,
		ActionKey:         strPtr("seeds.base"),
		ReferenceID:       strPtr("seed-ref-1"),
		ActorUserID:       &admin.ID,
		MetadataJSON:      models.JSONBMap{"source": "seed", "kind": "baseline"},
	}
	if err := db.Create(&creditRecord).Error; err != nil {
		t.Fatalf("seed credit record: %v", err)
	}

	oauthState := models.OAuthState{
		State:          uuid.NewString(),
		UserID:         admin.ID,
		SelectedApps:   `["drive","sheets"]`,
		Scopes:         `["openid","email"]`,
		CredentialType: "googleDriveOAuth2Api",
		UsePopup:       false,
		OrganizationID: &org.ID,
		ExpiresAt:      now.Add(time.Hour),
	}
	if err := db.Create(&oauthState).Error; err != nil {
		t.Fatalf("seed oauth state: %v", err)
	}

	oauthPopupToken := models.OAuthPopupToken{
		Code:      "seed-popup-code",
		TokenData: models.JSONB([]byte(`{"access_token":"seed-access-token","refresh_token":"seed-refresh-token"}`)),
		ExpiresAt: now.Add(time.Hour),
	}
	if err := db.Create(&oauthPopupToken).Error; err != nil {
		t.Fatalf("seed oauth popup token: %v", err)
	}

	plan := models.Plan{
		Code:            "starter",
		Name:            "Starter",
		CreditsPerCycle: 1000,
		RulesJSON:       models.JSONBMap{"features": []string{"todos", "assets", "secrets"}},
		IsActive:        true,
	}
	if err := db.Create(&plan).Error; err != nil {
		t.Fatalf("seed plan: %v", err)
	}

	logID := uuid.New()
	if err := db.Exec(
		`INSERT INTO logs (id, timestamp, level, section, auth_result, message, user_id, organization_id, request_id, ip_address, endpoint, method, status_code, response_time_ms, metadata, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		logID,
		now,
		models.LogLevelInfo,
		models.SectionSystem,
		"SUCCESS",
		"Seeded baseline data",
		admin.ID,
		org.ID,
		"seed-request-1",
		"127.0.0.1",
		"/seed",
		"POST",
		200,
		12,
		`{"seed":true}`,
		now,
	).Error; err != nil {
		t.Fatalf("seed log: %v", err)
	}

	return DemoData{
		Admin:             admin,
		Member:            member,
		Personal:          personal,
		Organization:      org,
		AdminMembership:   adminMembership,
		MemberMembership:  memberMembership,
		Invitation:        invitation,
		BusinessProfile:   businessProfile,
		PersonalTodo:      personalTodo,
		OrgTodoTodo:       orgTodoTodo,
		OrgTodoInProgress: orgTodoInProgress,
		OrgTodoDone:       orgTodoDone,
		PersonalAsset:     personalAsset,
		OrgAsset:          orgAsset,
		PersonalSecret:    personalSecret,
		OrgSecret:         orgSecret,
		CreditAccount:     creditAccount,
		CreditRecord:      creditRecord,
		OAuthState:        oauthState,
		OAuthPopupToken:   oauthPopupToken,
		StarterPlan:       plan,
		LogEntryID:        logID,
	}
}

func mustSeedUser(t testing.TB, db *gorm.DB, email, password, firstName, lastName string, verified bool) models.User {
	t.Helper()
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	user := models.User{
		Email:             email,
		Password:          string(hash),
		FirstName:         firstName,
		LastName:          lastName,
		Role:              "user",
		IsActive:          true,
		EmailVerified:     verified,
		VerificationToken: fmt.Sprintf("seed-%s", uuid.NewString()),
	}
	if err := db.Create(&user).Error; err != nil {
		t.Fatalf("seed user %s: %v", email, err)
	}
	return user
}

func strPtr(v string) *string {
	return &v
}
