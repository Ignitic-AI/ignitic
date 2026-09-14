package models

import (
	"time"

	"github.com/google/uuid"
)

type OrganizationInvitation struct {
	ID             uuid.UUID `gorm:"type:uuid;primary_key;default:gen_random_uuid()" json:"id"`
	OrganizationID uuid.UUID `gorm:"type:uuid;not null" json:"organization_id"`
	Email          string    `gorm:"not null" json:"email"`
	Role           string    `gorm:"not null" json:"role"`
	Status         string    `gorm:"not null;default:'pending'" json:"status"` // pending, accepted, expired
	InvitedBy      uuid.UUID `gorm:"type:uuid;not null" json:"invited_by"`
	ExpiresAt      time.Time `gorm:"not null" json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`

	// Relationships
	Organization Organization `gorm:"foreignKey:OrganizationID" json:"organization,omitempty"`
	Inviter      User         `gorm:"foreignKey:InvitedBy" json:"inviter,omitempty"`
}

// TableName specifies the table name for the model
func (OrganizationInvitation) TableName() string {
	return "organization_invitations"
}
