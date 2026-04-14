package testutil

import (
	"database/sql"
	"fmt"
	"reflect"
	"sync"
	"testing"
	"time"

	"backend/database"
	"github.com/google/uuid"
	sqlite3 "github.com/mattn/go-sqlite3"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var registerSQLiteOnce sync.Once

func registerSQLiteUUIDDriver() string {
	registerSQLiteOnce.Do(func() {
		sql.Register("codex_sqlite_uuid", &sqlite3.SQLiteDriver{
			ConnectHook: func(conn *sqlite3.SQLiteConn) error {
				_ = conn.RegisterFunc("uuid_generate_v4", func() string {
					return uuid.NewString()
				}, true)
				_ = conn.RegisterFunc("gen_random_uuid", func() string {
					return uuid.NewString()
				}, true)
				_ = conn.RegisterFunc("NOW", func() string {
					return time.Now().UTC().Format("2006-01-02 15:04:05")
				}, true)
				return nil
			},
		})
	})
	return "codex_sqlite_uuid"
}

// NewSQLiteDB opens an in-memory SQLite database with UUID helpers and test-only schema.
// The helper name is preserved so the existing test files do not need to change.
func NewSQLiteDB(t testing.TB, models ...interface{}) *database.DB {
	t.Helper()

	driverName := registerSQLiteUUIDDriver()
	dialector := sqlite.Dialector{
		DriverName: driverName,
		DSN:        fmt.Sprintf("file:%s?mode=memory&cache=shared&_foreign_keys=on", uuid.NewString()),
	}

	gormDB, err := gorm.Open(dialector, &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite db: %v", err)
	}

	if err := createSQLiteSchema(gormDB); err != nil {
		t.Fatalf("create schema: %v", err)
	}

	if err := registerUUIDCreateHook(gormDB); err != nil {
		t.Fatalf("register uuid hook: %v", err)
	}

	rawDB, err := gormDB.DB()
	if err != nil {
		t.Fatalf("get raw db: %v", err)
	}

	return &database.DB{DB: gormDB, RawDB: rawDB}
}

func createSQLiteSchema(db *gorm.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			email TEXT NOT NULL UNIQUE,
			password TEXT NOT NULL,
			first_name TEXT NOT NULL,
			last_name TEXT NOT NULL,
			phone TEXT,
			company TEXT,
			role TEXT NOT NULL DEFAULT 'user',
			is_active INTEGER DEFAULT 1,
			email_verified INTEGER DEFAULT 0,
			verification_token TEXT,
			reset_token TEXT,
			reset_token_expiry DATETIME,
			last_login DATETIME,
			organization_id TEXT,
			onboarding_personal TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		);`,
		`CREATE TABLE IF NOT EXISTS organizations (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			description TEXT,
			employee_count INTEGER NOT NULL DEFAULT 1,
			ecommerce_domain TEXT,
			industry TEXT,
			company_size TEXT,
			website TEXT,
			country TEXT,
			city TEXT,
			address TEXT,
			phone_number TEXT,
			is_active INTEGER DEFAULT 1,
			subscription_plan TEXT DEFAULT 'free',
			hear_about_us TEXT,
			work_on_multiple_platforms INTEGER DEFAULT 0,
			selected_brands TEXT,
			preferred_automation_ids TEXT,
			created_by TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		);`,
		`CREATE TABLE IF NOT EXISTS user_organizations (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			organization_id TEXT NOT NULL,
			role TEXT NOT NULL DEFAULT 'member',
			onboarding_job_title TEXT,
			joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			is_active INTEGER DEFAULT 1
		);`,
		`CREATE TABLE IF NOT EXISTS organization_invitations (
			id TEXT PRIMARY KEY,
			organization_id TEXT NOT NULL,
			email TEXT NOT NULL,
			role TEXT NOT NULL,
			status TEXT NOT NULL,
			invited_by TEXT NOT NULL,
			expires_at DATETIME NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		);`,
		`CREATE TABLE IF NOT EXISTS organization_business_profiles (
			id TEXT PRIMARY KEY,
			organization_id TEXT NOT NULL UNIQUE,
			business_hours TEXT,
			primary_markets TEXT,
			default_currency TEXT,
			supported_languages TEXT,
			support_email TEXT,
			support_channels TEXT,
			social_links TEXT,
			fulfillment_method TEXT,
			shipping_carriers TEXT,
			returns_policy_url TEXT,
			payment_gateways TEXT,
			tax_identifiers TEXT,
			primary_contacts TEXT,
			compliance_contacts TEXT,
			ecommerce_platforms TEXT,
			key_systems TEXT,
			holiday_blackout_dates TEXT,
			data_processing_addenda TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS logs (
			id TEXT PRIMARY KEY,
			timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			level TEXT NOT NULL,
			section TEXT,
			auth_result TEXT,
			message TEXT NOT NULL,
			user_id TEXT,
			organization_id TEXT,
			request_id TEXT,
			ip_address TEXT,
			endpoint TEXT,
			method TEXT,
			status_code INTEGER,
			response_time_ms INTEGER,
			metadata TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS assets (
			id TEXT PRIMARY KEY,
			organization_id TEXT,
			user_id TEXT,
			category TEXT,
			title TEXT,
			storage_provider TEXT NOT NULL DEFAULT 'local',
			path TEXT,
			url TEXT,
			mime_type TEXT,
			file_ext TEXT,
			size_bytes INTEGER,
			tags TEXT,
			metadata TEXT,
			created_by TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		);`,
		`CREATE TABLE IF NOT EXISTS secrets (
			id TEXT PRIMARY KEY,
			app TEXT,
			name TEXT NOT NULL,
			description TEXT,
			ciphertext BLOB NOT NULL,
			iv BLOB NOT NULL,
			algo TEXT NOT NULL DEFAULT 'AES-256-GCM',
			created_by TEXT NOT NULL,
			organization_id TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS todos (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			organization_id TEXT,
			title TEXT NOT NULL,
			description TEXT,
			priority TEXT NOT NULL DEFAULT 'medium',
			status TEXT NOT NULL DEFAULT 'todo',
			progress INTEGER NOT NULL DEFAULT 0,
			monetary_value REAL,
			icon TEXT,
			is_agent_task INTEGER DEFAULT 0,
			agent_name TEXT,
			agent_task_id TEXT,
			agent_config TEXT,
			scheduled_at DATETIME,
			due_date DATETIME,
			tags TEXT,
			metadata TEXT,
			created_by TEXT NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at DATETIME
		);`,
		`CREATE TABLE IF NOT EXISTS oauth_states (
			id TEXT PRIMARY KEY,
			state TEXT NOT NULL UNIQUE,
			user_id TEXT NOT NULL,
			selected_apps TEXT,
			scopes TEXT,
			credential_type TEXT,
			use_popup INTEGER DEFAULT 0,
			organization_id TEXT,
			expires_at DATETIME NOT NULL,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS oauth_popup_tokens (
			code TEXT PRIMARY KEY,
			token_data BLOB NOT NULL,
			expires_at DATETIME NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS credit_accounts (
			id TEXT PRIMARY KEY,
			owner_type TEXT NOT NULL,
			owner_id TEXT NOT NULL,
			plan_code TEXT NOT NULL DEFAULT 'starter',
			plan_id TEXT,
			total_credits INTEGER NOT NULL DEFAULT 0,
			credits_consumed INTEGER NOT NULL DEFAULT 0,
			cycle_start DATETIME NOT NULL,
			cycle_end DATETIME NOT NULL,
			status TEXT NOT NULL DEFAULT 'active',
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS credit_records (
			id TEXT PRIMARY KEY,
			credit_account_id TEXT NOT NULL,
			record_type TEXT NOT NULL,
			credits_delta INTEGER NOT NULL,
			total_credits_after INTEGER NOT NULL,
			credits_consumed_after INTEGER NOT NULL,
			action_key TEXT,
			reference_id TEXT,
			actor_user_id TEXT,
			metadata_json TEXT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS plans (
			id TEXT PRIMARY KEY,
			code TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			credits_per_cycle INTEGER NOT NULL,
			rules_json TEXT NOT NULL,
			is_active INTEGER DEFAULT 1,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		);`,
	}

	for _, stmt := range statements {
		if err := db.Exec(stmt).Error; err != nil {
			return err
		}
	}

	return nil
}

func registerUUIDCreateHook(db *gorm.DB) error {
	return db.Callback().Create().Before("gorm:create").Register("codex_assign_uuid_primary_keys", func(tx *gorm.DB) {
		assignUUIDPrimaryKeys(tx.Statement.Dest)
	})
}

func assignUUIDPrimaryKeys(dest interface{}) {
	if dest == nil {
		return
	}

	value := reflectValue(dest)
	switch value.Kind() {
	case reflect.Struct:
		assignUUIDPrimaryKey(value)
	case reflect.Slice, reflect.Array:
		for i := 0; i < value.Len(); i++ {
			item := value.Index(i)
			for item.Kind() == reflect.Ptr {
				if item.IsNil() {
					continue
				}
				item = item.Elem()
			}
			if item.IsValid() && item.Kind() == reflect.Struct {
				assignUUIDPrimaryKey(item)
			}
		}
	}
}

func reflectValue(dest interface{}) reflect.Value {
	value := reflect.ValueOf(dest)
	for value.IsValid() && value.Kind() == reflect.Ptr {
		if value.IsNil() {
			return reflect.Value{}
		}
		value = value.Elem()
	}
	return value
}

func assignUUIDPrimaryKey(value reflect.Value) {
	field := value.FieldByName("ID")
	if !field.IsValid() || !field.CanSet() || field.Type() != reflect.TypeOf(uuid.UUID{}) {
		return
	}
	if field.Interface().(uuid.UUID) == uuid.Nil {
		field.Set(reflect.ValueOf(uuid.New()))
	}
}
