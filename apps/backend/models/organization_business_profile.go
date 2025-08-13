package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

type OrganizationBusinessProfile struct {
	ID                    uuid.UUID      `gorm:"primaryKey;type:uuid;default:uuid_generate_v4()"`
	OrganizationID        uuid.UUID      `gorm:"type:uuid;not null;uniqueIndex"`
	BusinessHours         string         `gorm:"column:business_hours"`
	PrimaryMarkets        pq.StringArray `gorm:"type:text[]"`
	DefaultCurrency       string         `gorm:"column:default_currency"`
	SupportedLanguages    pq.StringArray `gorm:"type:text[]"`
	SupportEmail          string         `gorm:"column:support_email"`
	SupportChannels       pq.StringArray `gorm:"type:text[]"`
	SocialLinks           StringMap      `gorm:"type:jsonb"`
	FulfillmentMethod     string         `gorm:"column:fulfillment_method"`
	ShippingCarriers      pq.StringArray `gorm:"type:text[]"`
	ReturnsPolicyURL      string         `gorm:"column:returns_policy_url"`
	PaymentGateways       pq.StringArray `gorm:"type:text[]"`
	TaxIdentifiers        StringMap      `gorm:"type:jsonb"`
	PrimaryContacts       ContactArray   `gorm:"type:jsonb"`
	ComplianceContacts    ContactArray   `gorm:"type:jsonb"`
	EcommercePlatforms    PlatformArray  `gorm:"type:jsonb"`
	KeySystems            pq.StringArray `gorm:"type:text[]"`
	HolidayBlackoutDates  pq.StringArray `gorm:"type:text[]"`
	DataProcessingAddenda string         `gorm:"column:data_processing_addenda"`
	CreatedAt             time.Time      `gorm:"column:created_at;not null;default:now()"`
	UpdatedAt             time.Time      `gorm:"column:updated_at;not null;default:now()"`
}

func (OrganizationBusinessProfile) TableName() string {
	return "organization_business_profiles"
}

// StringMap is a type alias for map[string]string that implements SQL/JSON interfaces
type StringMap map[string]string

func (m StringMap) Value() (driver.Value, error) {
	if m == nil {
		return nil, nil
	}
	return json.Marshal(m)
}

func (m *StringMap) Scan(value interface{}) error {
	if value == nil {
		*m = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, m)
}

type OrgContact struct {
	Name  string `json:"name"`
	Role  string `json:"role"`
	Email string `json:"email"`
}

type ContactArray []OrgContact

func (a ContactArray) Value() (driver.Value, error) {
	return json.Marshal(a)
}

func (a *ContactArray) Scan(value interface{}) error {
	if value == nil {
		*a = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, &a)
}

type OrgPlatform struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	URL     string `json:"url"`
}

type PlatformArray []OrgPlatform

func (a PlatformArray) Value() (driver.Value, error) {
	return json.Marshal(a)
}

func (a *PlatformArray) Scan(value interface{}) error {
	if value == nil {
		*a = nil
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	return json.Unmarshal(bytes, &a)
}

type OrganizationBusinessProfileRequest struct {
	BusinessHours         string            `json:"business_hours"`
	PrimaryMarkets        []string          `json:"primary_markets"`
	DefaultCurrency       string            `json:"default_currency"`
	SupportedLanguages    []string          `json:"supported_languages"`
	SupportEmail          string            `json:"support_email"`
	SupportChannels       []string          `json:"support_channels"`
	SocialLinks           map[string]string `json:"social_links"`
	FulfillmentMethod     string            `json:"fulfillment_method"`
	ShippingCarriers      []string          `json:"shipping_carriers"`
	ReturnsPolicyURL      string            `json:"returns_policy_url"`
	PaymentGateways       []string          `json:"payment_gateways"`
	TaxIdentifiers        map[string]string `json:"tax_identifiers"`
	PrimaryContacts       []OrgContact      `json:"primary_contacts"`
	ComplianceContacts    []OrgContact      `json:"compliance_contacts"`
	EcommercePlatforms    []OrgPlatform     `json:"ecommerce_platforms"`
	KeySystems            []string          `json:"key_systems"`
	HolidayBlackoutDates  []string          `json:"holiday_blackout_dates"`
	DataProcessingAddenda string            `json:"data_processing_addenda"`
}

type OrganizationBusinessProfileResponse struct {
	ID                    uuid.UUID         `json:"id"`
	OrganizationID        uuid.UUID         `json:"organization_id"`
	BusinessHours         string            `json:"business_hours,omitempty"`
	PrimaryMarkets        []string          `json:"primary_markets,omitempty"`
	DefaultCurrency       string            `json:"default_currency,omitempty"`
	SupportedLanguages    []string          `json:"supported_languages,omitempty"`
	SupportEmail          string            `json:"support_email,omitempty"`
	SupportChannels       []string          `json:"support_channels,omitempty"`
	SocialLinks           map[string]string `json:"social_links,omitempty"`
	FulfillmentMethod     string            `json:"fulfillment_method,omitempty"`
	ShippingCarriers      []string          `json:"shipping_carriers,omitempty"`
	ReturnsPolicyURL      string            `json:"returns_policy_url,omitempty"`
	PaymentGateways       []string          `json:"payment_gateways,omitempty"`
	TaxIdentifiers        map[string]string `json:"tax_identifiers,omitempty"`
	PrimaryContacts       []OrgContact      `json:"primary_contacts,omitempty"`
	ComplianceContacts    []OrgContact      `json:"compliance_contacts,omitempty"`
	EcommercePlatforms    []OrgPlatform     `json:"ecommerce_platforms,omitempty"`
	KeySystems            []string          `json:"key_systems,omitempty"`
	HolidayBlackoutDates  []string          `json:"holiday_blackout_dates,omitempty"`
	DataProcessingAddenda string            `json:"data_processing_addenda,omitempty"`
	CreatedAt             time.Time         `json:"created_at"`
	UpdatedAt             time.Time         `json:"updated_at"`
}
