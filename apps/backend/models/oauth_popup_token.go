package models

import (
	"database/sql/driver"
	"errors"
	"time"
)

type JSONB []byte

func (j JSONB) Value() (driver.Value, error) {
	if len(j) == 0 {
		return nil, nil
	}
	return []byte(j), nil
}

func (j *JSONB) Scan(value interface{}) error {
	if value == nil {
		*j = nil
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return errors.New("type assertion to []byte failed")
	}
	*j = append((*j)[0:0], b...)
	return nil
}

type OAuthPopupToken struct {
	Code      string    `gorm:"column:code;primaryKey;type:varchar(64)"`
	TokenData JSONB     `gorm:"column:token_data;type:jsonb;not null"`
	ExpiresAt time.Time `gorm:"column:expires_at;type:timestamptz;not null;index"`
}

func (OAuthPopupToken) TableName() string {
	return "oauth_popup_tokens"
}
