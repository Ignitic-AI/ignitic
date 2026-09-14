package nonfunctional_test

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"backend/api/agents"
	"backend/api/asset"
	"backend/api/auth"
	"backend/api/credits"
	"backend/api/todo"
	"backend/models"
	"backend/services/policy"
	"backend/tests/testutil"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func benchmarkContext(b *testing.B, method, target string, body any) (*gin.Context, *httptest.ResponseRecorder) {
	b.Helper()
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	var payload []byte
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			b.Fatalf("marshal body: %v", err)
		}
		payload = raw
	}

	req := httptest.NewRequest(method, target, bytes.NewReader(payload))
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	ctx.Request = req
	return ctx, recorder
}

func suppressStandardLogger(b *testing.B) {
	b.Helper()
	prev := log.Writer()
	log.SetOutput(io.Discard)
	b.Cleanup(func() {
		log.SetOutput(prev)
	})
}

func BenchmarkAuthLogin(b *testing.B) {
	db := testutil.NewSQLiteDB(b, &models.User{}, &models.Log{})
	svc := auth.NewAuthService(db, "benchmark-secret")
	b.ReportAllocs()

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
		loginCtx, loginRec := benchmarkContext(b, http.MethodPost, "/api/v1/auth/login", map[string]any{
			"email":    "bench@example.com",
			"password": "StrongPass123!",
		})
		svc.Login(loginCtx)
		if loginRec.Code != http.StatusOK {
			b.Fatalf("login failed: %s", loginRec.Body.String())
		}
	}
}

func BenchmarkTodoCreate(b *testing.B) {
	db := testutil.NewSQLiteDB(b, &models.User{}, &models.Todo{}, &models.Log{})
	b.ReportAllocs()
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
		ctx, rec := benchmarkContext(b, http.MethodPost, "/api/v1/todos", map[string]any{
			"title":       "Bench todo",
			"description": "Bench todo description",
			"priority":    "medium",
		})
		ctx.Set("user_id", user.ID.String())
		svc.CreateTodo(ctx)
		if rec.Code != http.StatusCreated {
			b.Fatalf("todo create failed: %s", rec.Body.String())
		}
	}
}

func BenchmarkTodoListFiltered(b *testing.B) {
	db := testutil.NewSQLiteDB(b, &models.User{}, &models.Todo{}, &models.Log{})
	b.ReportAllocs()

	user := models.User{
		Email:         "todo-list-bench@example.com",
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

	for i := 0; i < 250; i++ {
		status := models.StatusTodo
		if i%2 == 0 {
			status = models.StatusDone
		}
		priority := models.PriorityLow
		if i%3 == 0 {
			priority = models.PriorityHigh
		}
		seed := models.Todo{
			UserID:      user.ID,
			CreatedBy:   user.ID,
			Title:       "Seed todo " + strconv.Itoa(i),
			Description: "Seed benchmark todo",
			Status:      status,
			Priority:    priority,
			Progress:    i % 100,
		}
		if err := db.Create(&seed).Error; err != nil {
			b.Fatalf("seed todo %d: %v", i, err)
		}
	}

	svc, err := todo.NewTodoService(db)
	if err != nil {
		b.Fatalf("todo service: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx, rec := benchmarkContext(b, http.MethodGet, "/api/v1/todos?status=done&priority=high", nil)
		ctx.Set("user_id", user.ID.String())
		svc.ListTodos(ctx)
		if rec.Code != http.StatusOK {
			b.Fatalf("todo list failed: %s", rec.Body.String())
		}
	}
}

func BenchmarkTodoUpdate(b *testing.B) {
	db := testutil.NewSQLiteDB(b, &models.User{}, &models.Todo{}, &models.Log{})
	b.ReportAllocs()

	user := models.User{
		Email:         "todo-update-bench@example.com",
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

	seed := models.Todo{
		UserID:      user.ID,
		CreatedBy:   user.ID,
		Title:       "Seed update benchmark",
		Description: "Seed benchmark todo",
		Status:      models.StatusTodo,
		Priority:    models.PriorityMedium,
		Progress:    0,
	}
	if err := db.Create(&seed).Error; err != nil {
		b.Fatalf("seed todo: %v", err)
	}

	svc, err := todo.NewTodoService(db)
	if err != nil {
		b.Fatalf("todo service: %v", err)
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		progress := i % 100
		ctx, rec := benchmarkContext(b, http.MethodPut, "/api/v1/todos/"+seed.ID.String(), map[string]any{
			"title":    "Updated in benchmark",
			"progress": progress,
		})
		ctx.Set("user_id", user.ID.String())
		ctx.Params = append(ctx.Params, gin.Param{Key: "id", Value: seed.ID.String()})
		svc.UpdateTodo(ctx)
		if rec.Code != http.StatusOK {
			b.Fatalf("todo update failed: %s", rec.Body.String())
		}
	}
}

func BenchmarkCreditsOverview(b *testing.B) {
	db := testutil.NewSQLiteDB(b, &models.User{}, &models.CreditAccount{}, &models.CreditRecord{}, &models.Log{})
	b.ReportAllocs()

	user := models.User{
		ID:            uuid.New(),
		Email:         "credits-overview-bench@example.com",
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

	svc := credits.NewCreditsService(db)
	warmCtx, _ := benchmarkContext(b, http.MethodGet, "/api/v1/credits/overview", nil)
	warmCtx.Set("user_id", user.ID.String())
	svc.Overview(warmCtx)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx, rec := benchmarkContext(b, http.MethodGet, "/api/v1/credits/overview", nil)
		ctx.Set("user_id", user.ID.String())
		svc.Overview(ctx)
		if rec.Code != http.StatusOK {
			b.Fatalf("credits overview failed: %s", rec.Body.String())
		}
	}
}

func BenchmarkCreditsRecords(b *testing.B) {
	db := testutil.NewSQLiteDB(b, &models.User{}, &models.CreditAccount{}, &models.CreditRecord{}, &models.Log{})
	b.ReportAllocs()

	user := models.User{
		ID:            uuid.New(),
		Email:         "credits-records-bench@example.com",
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

	policySvc := policy.NewService(db)
	account, _, err := policySvc.GetOverview(user.ID, nil)
	if err != nil {
		b.Fatalf("bootstrap account: %v", err)
	}
	for i := 0; i < 120; i++ {
		rec := models.CreditRecord{
			ID:                uuid.New(),
			CreditAccountID:   account.ID,
			RecordType:        "consume",
			CreditsDelta:      -1,
			TotalCreditsAfter: account.TotalCredits,
			CreditsUsedAfter:  int64(i + 1),
		}
		if err := db.Create(&rec).Error; err != nil {
			b.Fatalf("seed credit record %d: %v", i, err)
		}
	}

	svc := credits.NewCreditsService(db)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx, rec := benchmarkContext(b, http.MethodGet, "/api/v1/credits/records?page=1&page_size=20", nil)
		ctx.Set("user_id", user.ID.String())
		svc.Records(ctx)
		if rec.Code != http.StatusOK {
			b.Fatalf("credits records failed: %s", rec.Body.String())
		}
	}
}

func BenchmarkAssetListFiltered(b *testing.B) {
	db := testutil.NewSQLiteDB(b, &models.User{}, &models.Organization{}, &models.UserOrganization{}, &models.Asset{}, &models.Log{})
	b.ReportAllocs()

	admin := models.User{
		ID:            uuid.New(),
		Email:         "asset-list-bench@example.com",
		Password:      "hashed",
		FirstName:     "Bench",
		LastName:      "Admin",
		Role:          "user",
		IsActive:      true,
		EmailVerified: true,
	}
	org := models.Organization{
		ID:               uuid.New(),
		Name:             "Assets Benchmark Org",
		EmployeeCount:    25,
		SubscriptionPlan: "free",
		CreatedBy:        admin.ID,
	}
	if err := db.Create(&admin).Error; err != nil {
		b.Fatalf("create admin: %v", err)
	}
	if err := db.Create(&org).Error; err != nil {
		b.Fatalf("create org: %v", err)
	}
	if err := db.Create(&models.UserOrganization{
		UserID:         admin.ID,
		OrganizationID: org.ID,
		Role:           "admin",
		IsActive:       true,
	}).Error; err != nil {
		b.Fatalf("create membership: %v", err)
	}

	for i := 0; i < 180; i++ {
		category := string(models.BrandAssets)
		if i%2 == 0 {
			category = string(models.MarketingAssets)
		}
		userID := admin.ID
		assetRow := models.Asset{
			ID:              uuid.New(),
			OrganizationID:  &org.ID,
			UserID:          &userID,
			Category:        category,
			Title:           "Bench asset " + strconv.Itoa(i),
			StorageProvider: "local",
			Path:            "bench/path/" + strconv.Itoa(i),
			URL:             "https://example.com/assets/" + strconv.Itoa(i),
			MimeType:        "text/plain",
			FileExt:         "txt",
			SizeBytes:       int64(1024 + i),
			CreatedBy:       admin.ID,
		}
		if err := db.Create(&assetRow).Error; err != nil {
			b.Fatalf("seed asset %d: %v", i, err)
		}
	}

	svc := asset.NewAssetService(db, nil)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx, rec := benchmarkContext(b, http.MethodGet, "/api/v1/assets?organization_id="+org.ID.String()+"&category=brand_assets", nil)
		ctx.Set("user_id", admin.ID.String())
		svc.ListAssets(ctx)
		if rec.Code != http.StatusOK {
			b.Fatalf("asset list failed: %s", rec.Body.String())
		}
	}
}

func BenchmarkAssetGet(b *testing.B) {
	db := testutil.NewSQLiteDB(b, &models.User{}, &models.Organization{}, &models.UserOrganization{}, &models.Asset{}, &models.Log{})
	b.ReportAllocs()

	admin := models.User{
		ID:            uuid.New(),
		Email:         "asset-get-bench@example.com",
		Password:      "hashed",
		FirstName:     "Bench",
		LastName:      "Admin",
		Role:          "user",
		IsActive:      true,
		EmailVerified: true,
	}
	org := models.Organization{
		ID:               uuid.New(),
		Name:             "Assets Get Org",
		EmployeeCount:    10,
		SubscriptionPlan: "free",
		CreatedBy:        admin.ID,
	}
	if err := db.Create(&admin).Error; err != nil {
		b.Fatalf("create admin: %v", err)
	}
	if err := db.Create(&org).Error; err != nil {
		b.Fatalf("create org: %v", err)
	}
	if err := db.Create(&models.UserOrganization{
		UserID:         admin.ID,
		OrganizationID: org.ID,
		Role:           "admin",
		IsActive:       true,
	}).Error; err != nil {
		b.Fatalf("create membership: %v", err)
	}

	userID := admin.ID
	seedAsset := models.Asset{
		ID:              uuid.New(),
		OrganizationID:  &org.ID,
		UserID:          &userID,
		Category:        string(models.BrandAssets),
		Title:           "Bench single asset",
		StorageProvider: "local",
		Path:            "bench/path/single",
		URL:             "https://example.com/assets/single",
		MimeType:        "text/plain",
		FileExt:         "txt",
		SizeBytes:       2048,
		CreatedBy:       admin.ID,
	}
	if err := db.Create(&seedAsset).Error; err != nil {
		b.Fatalf("seed asset: %v", err)
	}

	svc := asset.NewAssetService(db, nil)
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ctx, rec := benchmarkContext(b, http.MethodGet, "/api/v1/assets/"+seedAsset.ID.String(), nil)
		ctx.Set("user_id", admin.ID.String())
		ctx.Params = append(ctx.Params, gin.Param{Key: "id", Value: seedAsset.ID.String()})
		svc.GetAsset(ctx)
		if rec.Code != http.StatusOK {
			b.Fatalf("asset get failed: %s", rec.Body.String())
		}
	}
}

func BenchmarkAgentsWebSocketBroadcastResponse(b *testing.B) {
	b.ReportAllocs()
	suppressStandardLogger(b)

	manager := agents.WSManager
	conn := &agents.WebSocketConnection{
		ID:     "bench-response-" + uuid.NewString(),
		UserID: "user-broadcast-response",
		Send:   make(chan []byte, 8),
	}
	manager.Register(conn)
	b.Cleanup(func() {
		manager.Unregister(conn)
	})

	response := agents.AgentResponse{
		RequestID: "req-bench-response",
		Response:  "benchmark response payload",
		Status:    "done",
		UserID:    conn.UserID,
		ChatID:    "chat-bench",
		Timestamp: time.Now().UTC(),
	}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := manager.BroadcastResponse(response); err != nil {
			b.Fatalf("broadcast response: %v", err)
		}
		select {
		case <-conn.Send:
		default:
		}
	}
}
