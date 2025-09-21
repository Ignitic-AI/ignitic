package models

import (
	"time"

	"github.com/google/uuid"
)

type LogLevel string

const (
	LogLevelDebug LogLevel = "DEBUG"
	LogLevelInfo  LogLevel = "INFO"
	LogLevelWarn  LogLevel = "WARN"
	LogLevelError LogLevel = "ERROR"
)

type LogCategory string

const (
	LogCategoryUser    LogCategory = "USER"
	LogCategoryRBAC    LogCategory = "RBAC"
	LogCategoryAgents  LogCategory = "AGENTS"
	LogCategoryAssets  LogCategory = "ASSETS"
	LogCategoryAuth    LogCategory = "AUTH"
	LogCategorySecrets LogCategory = "SECRETS"
	LogCategorySystem  LogCategory = "SYSTEM"
	LogCategoryAPI     LogCategory = "API"
)

type Log struct {
	ID             uuid.UUID              `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	Timestamp      time.Time              `gorm:"column:timestamp;not null;default:now()"`
	Level          LogLevel               `gorm:"column:level;not null"`
	Category       LogCategory            `gorm:"column:category;not null"`
	Subcategory    *string                `gorm:"column:subcategory"`
	Message        string                 `gorm:"column:message;not null"`
	UserID         *uuid.UUID             `gorm:"column:user_id;type:uuid"`
	OrganizationID *uuid.UUID             `gorm:"column:organization_id;type:uuid"`
	RequestID      *string                `gorm:"column:request_id"`
	IPAddress      *string                `gorm:"column:ip_address"`
	Endpoint       *string                `gorm:"column:endpoint"`
	Method         *string                `gorm:"column:method"`
	StatusCode     *int                   `gorm:"column:status_code"`
	ResponseTimeMs *int                   `gorm:"column:response_time_ms"`
	Metadata       map[string]interface{} `gorm:"column:metadata;type:jsonb"`
	CreatedAt      time.Time              `gorm:"column:created_at;not null;default:now()"`
}

func (Log) TableName() string {
	return "logs"
}
