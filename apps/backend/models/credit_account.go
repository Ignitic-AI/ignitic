package models

import (
	"time"

	"github.com/google/uuid"
)

type CreditAccount struct {
	ID              uuid.UUID  `json:"id" gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	OwnerType       string     `json:"owner_type" gorm:"not null"`
	OwnerID         uuid.UUID  `json:"owner_id" gorm:"type:uuid;not null"`
	PlanCode        string     `json:"plan_code" gorm:"type:varchar(32);not null;default:'starter'"`
	PlanID          *uuid.UUID `json:"plan_id,omitempty" gorm:"type:uuid"`
	TotalCredits    int64      `json:"total_credits" gorm:"not null;default:0"`
	CreditsConsumed int64      `json:"credits_consumed" gorm:"not null;default:0"`
	CycleStart      time.Time  `json:"cycle_start"`
	CycleEnd        time.Time  `json:"cycle_end"`
	Status          string     `json:"status" gorm:"not null;default:'active'"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

func (CreditAccount) TableName() string {
	return "credit_accounts"
}

func (c CreditAccount) AvailableCredits() int64 {
	return c.TotalCredits - c.CreditsConsumed
}
