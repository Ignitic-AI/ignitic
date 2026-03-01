package models

import (
	"time"

	"github.com/google/uuid"
)

type CreditRecord struct {
	ID                uuid.UUID  `json:"id" gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	CreditAccountID   uuid.UUID  `json:"credit_account_id" gorm:"type:uuid;not null"`
	RecordType        string     `json:"record_type" gorm:"not null"`
	CreditsDelta      int64      `json:"credits_delta" gorm:"not null"`
	TotalCreditsAfter int64      `json:"total_credits_after" gorm:"not null"`
	CreditsUsedAfter  int64      `json:"credits_consumed_after" gorm:"column:credits_consumed_after;not null"`
	ActionKey         *string    `json:"action_key,omitempty"`
	ReferenceID       *string    `json:"reference_id,omitempty"`
	ActorUserID       *uuid.UUID `json:"actor_user_id,omitempty" gorm:"type:uuid"`
	MetadataJSON      JSONBMap   `json:"metadata_json,omitempty" gorm:"column:metadata_json;type:jsonb"`
	CreatedAt         time.Time  `json:"created_at"`

	CreditAccount CreditAccount `json:"credit_account,omitempty" gorm:"foreignKey:CreditAccountID"`
}

func (CreditRecord) TableName() string {
	return "credit_records"
}
