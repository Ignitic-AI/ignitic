package main

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Server      ServerConfig
	Database    DatabaseConfig
	Redis       RedisConfig
	Security    SecurityConfig
	Email       EmailConfig
	Backend     BackendConfig
	Cloudinary  CloudinaryConfig
	GoogleOAuth GoogleOAuthConfig
}

type ServerConfig struct {
	Port         string
	Environment  string
	AIEngineURL  string
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

type EmailConfig struct {
	APIKey      string
	SenderEmail string
	SenderName  string
	FrontendURL string
}

type BackendConfig struct {
	MaxWorkers        int
	TaskTimeout       int
	ComplianceMode    string
	AutomationEnabled bool
}

type CloudinaryConfig struct {
	CloudName string
	APIKey    string
	APISecret string
}

// GoogleOAuthConfig holds configuration for Google OAuth credentials.
type GoogleOAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURI  string
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
			AIEngineURL: getEnvOrDefault("AI_ENGINE_URL", "http://localhost:8010"),
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
		Email: EmailConfig{
			APIKey:      getEnvOrDefault("BREVO_API_KEY", ""),
			SenderEmail: getEnvOrDefault("SENDER_EMAIL", "noreply@yourapp.com"),
			SenderName:  getEnvOrDefault("SENDER_NAME", "Your App"),
			FrontendURL: getEnvOrDefault("FRONTEND_URL", "http://localhost:3000"),
		},
		Backend: BackendConfig{
			MaxWorkers:        getEnvOrDefaultInt("BACKEND_MAX_WORKERS", 10),
			TaskTimeout:       getEnvOrDefaultInt("BACKEND_TASK_TIMEOUT", 300),
			ComplianceMode:    getEnvOrDefault("BACKEND_COMPLIANCE_MODE", "SOC2_GDPR"),
			AutomationEnabled: getEnvOrDefaultBool("BACKEND_AUTOMATION_ENABLED", true),
		},
		Cloudinary: CloudinaryConfig{
			CloudName: getEnvOrDefault("CLOUDINARY_CLOUD_NAME", ""),
			APIKey:    getEnvOrDefault("CLOUDINARY_API_KEY", ""),
			APISecret: getEnvOrDefault("CLOUDINARY_API_SECRET", ""),
		},
		GoogleOAuth: GoogleOAuthConfig{
			ClientID:     getEnvOrDefault("GOOGLE_CLIENT_ID", ""),
			ClientSecret: getEnvOrDefault("GOOGLE_CLIENT_SECRET", ""),
			RedirectURI:  getEnvOrDefault("GOOGLE_REDIRECT_URI", "http://localhost:8080/api/v1/google-oauth/callback"),
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
