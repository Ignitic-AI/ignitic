package models

import (
	"time"

	"github.com/google/uuid"
)

type Secret struct {
	ID             uuid.UUID  `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	App            *string    `gorm:"column:app"`
	Name           string     `gorm:"column:name;not null"`
	Description    *string    `gorm:"column:description"`
	Ciphertext     []byte     `gorm:"column:ciphertext;not null"`
	IV             []byte     `gorm:"column:iv;not null"`
	Algo           string     `gorm:"column:algo;not null;default:'AES-256-GCM'"`
	CreatedBy      uuid.UUID  `gorm:"column:created_by;type:uuid;not null"`
	OrganizationID *uuid.UUID `gorm:"column:organization_id;type:uuid"`
	CreatedAt      time.Time  `gorm:"column:created_at;not null;default:now()"`
	UpdatedAt      time.Time  `gorm:"column:updated_at;not null;default:now()"`
}

func (Secret) TableName() string {
	return "secrets"
}

type SecretRequest struct {
	Value          string     `json:"value" binding:"required"`
	Description    string     `json:"description"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
}

type SecretResponse struct {
	App            string     `json:"app"`
	Name           string     `json:"name"`
	Description    string     `json:"description,omitempty"`
	CreatedBy      uuid.UUID  `json:"created_by"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
