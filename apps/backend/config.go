package main

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Redis    RedisConfig
	Security SecurityConfig
	backend  BackendConfig
}

type ServerConfig struct {
	Port        string
	Environment string
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Database string
	SSLMode  string
}

type RedisConfig struct {
	Host     string
	Port     string
	Password string
	DB       int
}

type SecurityConfig struct {
	JWTSecret     string
	EncryptionKey string
	RateLimitRPS  int
}

type BackendConfig struct {
	MaxWorkers        int
	TaskTimeout       int
	ComplianceMode    string
	AutomationEnabled bool
}

func Load() (*Config, error) {
	// Load .env file if it exists
	if err := godotenv.Load(); err != nil {
		// .env file is optional, so we don't return error
		fmt.Println("No .env file found, using environment variables")
	}

	config := &Config{
		Server: ServerConfig{
			Port:        getEnvOrDefault("SERVER_PORT", "8080"),
			Environment: getEnvOrDefault("ENVIRONMENT", "development"),
		},
		Database: DatabaseConfig{
			Host:     getEnvOrDefault("DB_HOST", "localhost"),
			Port:     getEnvOrDefaultInt("DB_PORT", 5432),
			User:     getEnvOrDefault("DB_USER", "postgres"),
			Password: getEnvOrDefault("DB_PASSWORD", ""),
			Database: getEnvOrDefault("DB_NAME", "db"),
			SSLMode:  getEnvOrDefault("DB_SSL_MODE", "disable"),
		},
		Redis: RedisConfig{
			Host:     getEnvOrDefault("REDIS_HOST", "localhost"),
			Port:     getEnvOrDefault("REDIS_PORT", "6379"),
			Password: getEnvOrDefault("REDIS_PASSWORD", ""),
			DB:       getEnvOrDefaultInt("REDIS_DB", 0),
		},
		Security: SecurityConfig{
			JWTSecret:     getEnvOrDefault("JWT_SECRET", "your-secret-key-change-this"),
			EncryptionKey: getEnvOrDefault("ENCRYPTION_KEY", "your-encryption-key-32-bytes-long"),
			RateLimitRPS:  getEnvOrDefaultInt("RATE_LIMIT_RPS", 100),
		},
		backend: BackendConfig{
			MaxWorkers:        getEnvOrDefaultInt("backend_MAX_WORKERS", 10),
			TaskTimeout:       getEnvOrDefaultInt("backend_TASK_TIMEOUT", 300),
			ComplianceMode:    getEnvOrDefault("backend_COMPLIANCE_MODE", "SOC2_GDPR"),
			AutomationEnabled: getEnvOrDefaultBool("backend_AUTOMATION_ENABLED", true),
		},
	}

	return config, nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvOrDefaultInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvOrDefaultBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
