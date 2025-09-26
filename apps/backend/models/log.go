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

// Section is a simpler, flat categorization replacing category/subcategory
// Example values: AUTH, ASSETS, SECRETS, AGENTS, ORGANIZATIONS, USERS, API
type Section string

const (
	SectionAuth          Section = "AUTH"
	SectionAssets        Section = "ASSETS"
	SectionSecrets       Section = "SECRETS"
	SectionAgents        Section = "AGENTS"
	SectionOrganizations Section = "ORGANIZATIONS"
	SectionUsers         Section = "USERS"
	SectionAPI           Section = "API"
	SectionSystem        Section = "SYSTEM"
)

type Log struct {
	ID             uuid.UUID              `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	Timestamp      time.Time              `gorm:"column:timestamp;not null;default:now()"`
	Level          LogLevel               `gorm:"column:level;not null"`
	Section        Section                `gorm:"column:section"`
	AuthResult     *string                `gorm:"column:auth_result"`
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
