package models

import (
	"time"

	"github.com/google/uuid"
)

type OAuthState struct {
	ID               uuid.UUID  `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	State            string     `gorm:"column:state;uniqueIndex;not null;type:varchar(255)"`
	UserID           uuid.UUID  `gorm:"column:user_id;type:uuid;not null;index"`
	SelectedApps     string     `gorm:"column:selected_apps;type:text"`   // JSON array of app codes
	Scopes           string     `gorm:"column:scopes;type:text"`           // JSON array of scopes
	CredentialType   string     `gorm:"column:credential_type;type:varchar(128)"` // e.g. googleDriveOAuth2Api
	UsePopup         bool       `gorm:"column:use_popup;default:false"`            // if true, callback returns HTML with postMessage instead of redirect
	OrganizationID   *uuid.UUID `gorm:"column:organization_id;type:uuid"`
	ExpiresAt        time.Time  `gorm:"column:expires_at;type:timestamptz;not null;index"`
	CreatedAt        time.Time  `gorm:"column:created_at;type:timestamptz;not null;default:now()"`
}

func (OAuthState) TableName() string {
	return "oauth_states"
}

