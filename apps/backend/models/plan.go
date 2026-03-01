package models

import (
	"time"

	"github.com/google/uuid"
)

type Plan struct {
	ID              uuid.UUID `json:"id" gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	Code            string    `json:"code" gorm:"uniqueIndex;not null"`
	Name            string    `json:"name" gorm:"not null"`
	CreditsPerCycle int64     `json:"credits_per_cycle" gorm:"not null"`
	RulesJSON       JSONBMap  `json:"rules_json" gorm:"column:rules_json;type:jsonb;not null"`
	IsActive        bool      `json:"is_active" gorm:"default:true"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

func (Plan) TableName() string {
	return "plans"
}
