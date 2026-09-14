package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Organization represents an organization in the system
type Organization struct {
	ID               uuid.UUID      `json:"id" gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	Name             string         `json:"name" gorm:"not null"`
	Description      string         `json:"description" gorm:""`
	EmployeeCount    int            `json:"employee_count" gorm:"not null;default:1"`
	EcommerceDomain  string         `json:"ecommerce_domain" gorm:""`
	Industry         string         `json:"industry" gorm:""`
	CompanySize      string         `json:"company_size" gorm:""`
	Website          string         `json:"website" gorm:""`
	Country          string         `json:"country" gorm:""`
	City             string         `json:"city" gorm:""`
	Address          string         `json:"address" gorm:""`
	PhoneNumber      string         `json:"phone_number" gorm:""`
	IsActive         bool           `json:"is_active" gorm:"default:true"`
	SubscriptionPlan        string          `json:"subscription_plan" gorm:"default:'free'"`
	HearAboutUs             string          `json:"hear_about_us" gorm:"size:255"`
	WorkOnMultiplePlatforms bool            `json:"work_on_multiple_platforms" gorm:"default:false"`
	SelectedBrands          json.RawMessage `json:"selected_brands" gorm:"type:jsonb"`
	PreferredAutomationIDs  json.RawMessage `json:"preferred_automation_ids" gorm:"type:jsonb"`
	CreatedBy        uuid.UUID      `json:"created_by" gorm:"type:uuid;not null"`
	CreatedAt        time.Time      `json:"created_at"`
	UpdatedAt        time.Time      `json:"updated_at"`
	DeletedAt        gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Users []User `json:"users,omitempty" gorm:"foreignKey:OrganizationID"`
}

// TableName specifies the table name for GORM
func (Organization) TableName() string {
	return "organizations"
}

// UserOrganization represents the many-to-many relationship between users and organizations
type UserOrganization struct {
	ID             uuid.UUID `json:"id" gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	UserID         uuid.UUID `json:"user_id" gorm:"type:uuid;not null"`
	OrganizationID uuid.UUID `json:"organization_id" gorm:"type:uuid;not null"`
	Role               string    `json:"role" gorm:"not null;default:'member'"` // admin, member, viewer
	OnboardingJobTitle string    `json:"onboarding_job_title" gorm:"size:255"`
	JoinedAt       time.Time `json:"joined_at" gorm:"default:CURRENT_TIMESTAMP"`
	IsActive       bool      `json:"is_active" gorm:"default:true"`

	// Relationships
	User         User         `json:"user,omitempty" gorm:"foreignKey:UserID"`
	Organization Organization `json:"organization,omitempty" gorm:"foreignKey:OrganizationID"`
}

// TableName specifies the table name for GORM
func (UserOrganization) TableName() string {
	return "user_organizations"
}
