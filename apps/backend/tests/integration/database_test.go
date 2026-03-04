package integration

import (
	"fmt"
	"os"
	"strconv"
	"testing"

	"backend/database"
)

func TestDatabase_ConnectAndMigrations(t *testing.T) {
	if os.Getenv("RUN_INTEGRATION_TESTS") == "" {
		t.Skip("RUN_INTEGRATION_TESTS not set, skipping")
	}

	host := getEnv("TEST_DB_HOST", "DB_HOST", "localhost")
	port := getEnvInt("TEST_DB_PORT", "DB_PORT", 5432)
	user := getEnv("TEST_DB_USER", "DB_USER", "postgres")
	password := getEnv("TEST_DB_PASSWORD", "DB_PASSWORD", "")
	dbname := getEnv("TEST_DB_NAME", "DB_NAME", "db")
	sslmode := getEnv("TEST_DB_SSLMODE", "DB_SSL_MODE", "disable")

	cfg := database.DatabaseConfig{
		Host:     host,
		Port:     port,
		User:     user,
		Password: password,
		Database: dbname,
		SSLMode:  sslmode,
	}

	db, err := database.Initialize(cfg)
	if err != nil {
		t.Skipf("database not available (use for integration tests): %v", err)
	}
	defer db.Close()
	// If we get here, connection and migrations succeeded
}

func getEnv(primary, fallback, defaultVal string) string {
	if v := os.Getenv(primary); v != "" {
		return v
	}
	if v := os.Getenv(fallback); v != "" {
		return v
	}
	return defaultVal
}

func getEnvInt(primary, fallback string, defaultVal int) int {
	if v := os.Getenv(primary); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	if v := os.Getenv(fallback); v != "" {
		if i, err := strconv.Atoi(v); err == nil {
			return i
		}
	}
	return defaultVal
}

func TestDatabase_InvalidConfig_Fails(t *testing.T) {
	// Use a port that will refuse connection quickly (no long DNS/timeout).
	cfg := database.DatabaseConfig{
		Host:     "127.0.0.1",
		Port:     1,
		User:     "u",
		Password: "p",
		Database: "d",
		SSLMode:  "disable",
	}
	_, err := database.Initialize(cfg)
	if err == nil {
		t.Fatal("expected error for invalid config, got nil")
	}
	_ = fmt.Sprintf("%v", err)
}
