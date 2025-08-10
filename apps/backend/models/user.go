package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents a user in the system
type User struct {
	ID                uuid.UUID      `json:"id" gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	Email             string         `json:"email" gorm:"uniqueIndex;not null"`
	Password          string         `json:"-" gorm:"not null"`
	FirstName         string         `json:"first_name" gorm:"not null"`
	LastName          string         `json:"last_name" gorm:"not null"`
	Phone             string         `json:"phone" gorm:""`
	Company           string         `json:"company" gorm:""`
	Role              string         `json:"role" gorm:"not null;default:'user'"`
	IsActive          bool           `json:"is_active" gorm:"default:true"`
	EmailVerified     bool           `json:"email_verified" gorm:"default:false"`
	VerificationToken string         `json:"-" gorm:""`
	ResetToken        string         `json:"-" gorm:""`
	ResetTokenExpiry  *time.Time     `json:"-" gorm:""`
	LastLogin         *time.Time     `json:"last_login"`
	OrganizationID    *uuid.UUID     `json:"organization_id" gorm:"type:uuid"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
	DeletedAt         gorm.DeletedAt `json:"-" gorm:"index"`

	// Relationships
	Organization      *Organization      `json:"organization,omitempty" gorm:"foreignKey:OrganizationID"`
	UserOrganizations []UserOrganization `json:"user_organizations,omitempty" gorm:"foreignKey:UserID"`
}

// TableName specifies the table name for GORM
func (User) TableName() string {
	return "users"
}
