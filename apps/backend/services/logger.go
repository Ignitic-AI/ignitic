package services

import (
	"backend/database"
	"backend/models"
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type DatabaseLogger struct {
	db *database.DB
}

func NewDatabaseLogger(db *database.DB) *DatabaseLogger {
	return &DatabaseLogger{db: db}
}

// Basic log method
func (l *DatabaseLogger) Log(ctx context.Context, level models.LogLevel, section models.Section, message string, options ...LogOption) error {
	log := &models.Log{
		Level:   level,
		Section: section,
		Message: message,
	}

	for _, opt := range options {
		opt(log)
	}

	return l.db.Create(log).Error
}

// Log options
type LogOption func(*models.Log)

func WithUserID(userID uuid.UUID) LogOption {
	return func(l *models.Log) {
		l.UserID = &userID
	}
}

func WithOrganizationID(orgID uuid.UUID) LogOption {
	return func(l *models.Log) {
		l.OrganizationID = &orgID
	}
}

func WithRequestID(requestID string) LogOption {
	return func(l *models.Log) {
		l.RequestID = &requestID
	}
}

func WithIPAddress(ip string) LogOption {
	return func(l *models.Log) {
		l.IPAddress = &ip
	}
}

func WithEndpoint(endpoint string) LogOption {
	return func(l *models.Log) {
		l.Endpoint = &endpoint
	}
}

func WithMethod(method string) LogOption {
	return func(l *models.Log) {
		l.Method = &method
	}
}

func WithStatusCode(code int) LogOption {
	return func(l *models.Log) {
		l.StatusCode = &code
	}
}

func WithResponseTime(ms int) LogOption {
	return func(l *models.Log) {
		l.ResponseTimeMs = &ms
	}
}

// Deprecated no-op kept for compatibility
func WithSubcategory(_ string) LogOption { return func(_ *models.Log) {} }

func WithSection(section models.Section) LogOption {
	return func(l *models.Log) {
		l.Section = section
	}
}

func WithAuthResult(result string) LogOption {
	return func(l *models.Log) {
		l.AuthResult = &result
	}
}

func WithMetadata(metadata map[string]interface{}) LogOption {
	return func(l *models.Log) {
		l.Metadata = metadata
	}
}

// Convenience methods for categories
func (l *DatabaseLogger) LogUser(ctx context.Context, level models.LogLevel, subcategory, message string, options ...LogOption) error {
	return l.Log(ctx, level, models.SectionUsers, message, options...)
}

func (l *DatabaseLogger) LogRBAC(ctx context.Context, level models.LogLevel, subcategory, message string, options ...LogOption) error {
	return l.Log(ctx, level, models.SectionUsers, message, options...)
}

func (l *DatabaseLogger) LogAgents(ctx context.Context, level models.LogLevel, subcategory, message string, options ...LogOption) error {
	return l.Log(ctx, level, models.SectionAgents, message, options...)
}

func (l *DatabaseLogger) LogAssets(ctx context.Context, level models.LogLevel, subcategory, message string, options ...LogOption) error {
	return l.Log(ctx, level, models.SectionAssets, message, options...)
}

func (l *DatabaseLogger) LogAuth(ctx context.Context, level models.LogLevel, subcategory, message string, options ...LogOption) error {
	return l.Log(ctx, level, models.SectionAuth, message, options...)
}

func (l *DatabaseLogger) LogSecrets(ctx context.Context, level models.LogLevel, subcategory, message string, options ...LogOption) error {
	return l.Log(ctx, level, models.SectionSecrets, message, options...)
}

func (l *DatabaseLogger) LogSystem(ctx context.Context, level models.LogLevel, subcategory, message string, options ...LogOption) error {
	return l.Log(ctx, level, models.SectionSystem, message, options...)
}

// Simple Gin middleware
func (l *DatabaseLogger) GinMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()

		latency := time.Since(start)

		// Get user info if available
		var userID *uuid.UUID
		if uid, exists := c.Get("user_id"); exists {
			if u, err := uuid.Parse(uid.(string)); err == nil {
				userID = &u
			}
		}

		// Log API request (async)
		go func() {
			ctx := context.Background()
			options := []LogOption{
				WithEndpoint(c.Request.URL.Path),
				WithMethod(c.Request.Method),
				WithStatusCode(c.Writer.Status()),
				WithResponseTime(int(latency.Milliseconds())),
				WithIPAddress(c.ClientIP()),
			}

			if requestID := c.GetString("request_id"); requestID != "" {
				options = append(options, WithRequestID(requestID))
			}

			if userID != nil {
				options = append(options, WithUserID(*userID))
			}

			// Infer section from path
			section := inferSectionFromPath(c.Request.URL.Path)

			// Set auth_result on 401/403
			if c.Writer.Status() == 401 {
				options = append(options, WithAuthResult("UNAUTHORIZED"))
			} else if c.Writer.Status() == 403 {
				options = append(options, WithAuthResult("FORBIDDEN"))
			}

			// Avoid duplicate logs for auth endpoints; rely on domain logs in auth service
			if section == models.SectionAuth {
				return
			}

			l.Log(ctx, models.LogLevelInfo, section,
				fmt.Sprintf("%s %s - %d", c.Request.Method, c.Request.URL.Path, c.Writer.Status()),
				options...)
		}()
	}
}

func inferSectionFromPath(path string) models.Section {
	p := strings.ToLower(path)
	switch {
	case strings.Contains(p, "/auth"):
		return models.SectionAuth
	case strings.Contains(p, "/assets"):
		return models.SectionAssets
	case strings.Contains(p, "/secrets"):
		return models.SectionSecrets
	case strings.Contains(p, "/agents"):
		return models.SectionAgents
	case strings.Contains(p, "/organizations"):
		return models.SectionOrganizations
	default:
		return models.SectionAPI
	}
}

// Log cleanup for old logs
func (l *DatabaseLogger) CleanupOldLogs() error {
	// Keep logs for 30 days
	cutoffDate := time.Now().AddDate(0, 0, -30)

	result := l.db.Where("timestamp < ?", cutoffDate).Delete(&models.Log{})
	if result.Error != nil {
		return result.Error
	}

	return nil
}

// Start cleanup scheduler
func (l *DatabaseLogger) StartCleanupScheduler() {
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()

		for range ticker.C {
			if err := l.CleanupOldLogs(); err != nil {
				// Log error but don't crash
				l.LogSystem(context.Background(), models.LogLevelError, "CLEANUP",
					"Failed to cleanup old logs: "+err.Error())
			}
		}
	}()
}
