package models

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// AssetCategory represents valid asset categories
type AssetCategory string

const (
	BusinessProfile  AssetCategory = "business_profile"
	BrandAssets      AssetCategory = "brand_assets"
	MarketingAssets  AssetCategory = "marketing_assets"
	AnalyticsReports AssetCategory = "analytics_reports"
	PolicyDocuments  AssetCategory = "policy_documents"
	MediaDocuments   AssetCategory = "media_documents"
)

// IsValid checks if the category is valid
func (c AssetCategory) IsValid() bool {
	switch c {
	case BusinessProfile, BrandAssets, MarketingAssets, AnalyticsReports, PolicyDocuments, MediaDocuments:
		return true
	}
	return false
}

type Asset struct {
	ID             uuid.UUID  `json:"id" gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	OrganizationID *uuid.UUID `json:"organization_id,omitempty" gorm:"type:uuid;index"`
	UserID         *uuid.UUID `json:"user_id,omitempty" gorm:"type:uuid;index"`

	Category string `json:"category" gorm:"type:text;index"`
	Title    string `json:"title" gorm:"type:text"`

	StorageProvider string `json:"storage_provider" gorm:"type:text;not null;default:'local'"`
	Path            string `json:"path" gorm:"type:text"`
	URL             string `json:"url" gorm:"type:text"`

	MimeType  string `json:"mime_type" gorm:"type:text"`
	FileExt   string `json:"file_ext" gorm:"type:text"`
	SizeBytes int64  `json:"size_bytes"`

	Tags         []string    `json:"-" gorm:"-"`
	TagsJSON     []byte      `json:"tags" gorm:"column:tags;type:jsonb"`
	Metadata     interface{} `json:"-" gorm:"-"`
	MetadataJSON []byte      `json:"metadata" gorm:"column:metadata;type:jsonb"`

	CreatedBy uuid.UUID      `json:"created_by" gorm:"type:uuid;not null;index"`
	CreatedAt time.Time      `json:"created_at" gorm:"not null;default:now()"`
	UpdatedAt time.Time      `json:"updated_at" gorm:"not null;default:now()"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// Optional relations
	Organization *Organization `json:"organization,omitempty" gorm:"foreignKey:OrganizationID"`
	User         *User         `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

// BeforeSave handles JSON marshaling
func (a *Asset) BeforeSave(tx *gorm.DB) error {
	if a.Tags != nil {
		data, err := json.Marshal(a.Tags)
		if err != nil {
			return err
		}
		a.TagsJSON = data
	}

	if a.Metadata != nil {
		data, err := json.Marshal(a.Metadata)
		if err != nil {
			return err
		}
		a.MetadataJSON = data
	}
	return nil
}

// AfterFind handles JSON unmarshaling
func (a *Asset) AfterFind(tx *gorm.DB) error {
	if a.TagsJSON != nil {
		if err := json.Unmarshal(a.TagsJSON, &a.Tags); err != nil {
			return err
		}
	}

	if a.MetadataJSON != nil {
		if err := json.Unmarshal(a.MetadataJSON, &a.Metadata); err != nil {
			return err
		}
	}
	return nil
}

type AssetUploadRequest struct {
	OrganizationID *uuid.UUID  `json:"organization_id,omitempty" form:"organization_id"`
	Category       string      `json:"category" form:"category" binding:"required"`
	Title          string      `json:"title,omitempty" form:"title"`       // Optional now
	Tags           []string    `json:"tags,omitempty" form:"tags"`         // Optional
	Metadata       interface{} `json:"metadata,omitempty" form:"metadata"` // Optional
}

type AssetResponse struct {
	ID              uuid.UUID   `json:"id"`
	OrganizationID  *uuid.UUID  `json:"organization_id,omitempty"`
	UserID          *uuid.UUID  `json:"user_id,omitempty"`
	Category        string      `json:"category"`
	Title           string      `json:"title"`
	StorageProvider string      `json:"storage_provider"`
	Path            string      `json:"path"`
	URL             string      `json:"url"`
	MimeType        string      `json:"mime_type"`
	FileExt         string      `json:"file_ext"`
	SizeBytes       int64       `json:"size_bytes"`
	Tags            []string    `json:"tags,omitempty"`
	Metadata        interface{} `json:"metadata,omitempty"`
	CreatedBy       uuid.UUID   `json:"created_by"`
	CreatedAt       time.Time   `json:"created_at"`
	UpdatedAt       time.Time   `json:"updated_at"`
}
