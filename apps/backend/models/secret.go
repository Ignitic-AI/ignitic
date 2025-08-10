package models

import (
	"time"
)

type Secret struct {
	ID          uint      `gorm:"primaryKey;column:id"`
	App         *string   `gorm:"column:app"`                
	Name        string    `gorm:"column:name;not null"`      
	Description *string   `gorm:"column:description"`         
	Ciphertext  []byte    `gorm:"column:ciphertext;not null"`
	IV          []byte    `gorm:"column:iv;not null"`        
	Algo        string    `gorm:"column:algo;not null;default:'AES-256-GCM'"`
	CreatedBy   string    `gorm:"column:created_by;not null"`
	CreatedAt   time.Time `gorm:"column:created_at;not null;default:now()"`
	UpdatedAt   time.Time `gorm:"column:updated_at;not null;default:now()"`
}

func (Secret) TableName() string {
	return "secrets"
}

type SecretRequest struct {
	Value       string `json:"value" binding:"required"`
	Description string `json:"description"`
}

type SecretResponse struct {
	App         string    `json:"app"`
	Name        string    `json:"name"`
	Description string    `json:"description,omitempty"`
	CreatedBy   string    `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
