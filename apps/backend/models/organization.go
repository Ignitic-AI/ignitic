package models

import (
	"time"

	"gorm.io/gorm"
)

// Organization represents an organization in the system
type Organization struct {
	ID               uint           `json:"id" gorm:"primaryKey"`
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
	SubscriptionPlan string         `json:"subscription_plan" gorm:"default:'free'"`
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
	ID             uint      `json:"id" gorm:"primaryKey"`
	UserID         uint      `json:"user_id" gorm:"not null"`
	OrganizationID uint      `json:"organization_id" gorm:"not null"`
	Role           string    `json:"role" gorm:"not null;default:'member'"` // admin, member, viewer
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
