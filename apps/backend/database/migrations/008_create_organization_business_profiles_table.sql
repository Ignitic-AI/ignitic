-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS organization_business_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL,
    business_hours TEXT,
    primary_markets TEXT[],
    default_currency VARCHAR(10),
    supported_languages TEXT[],
    support_email VARCHAR(255),
    support_channels TEXT[],
    social_links JSONB,
    fulfillment_method VARCHAR(50),
    shipping_carriers TEXT[],
    returns_policy_url TEXT,
    payment_gateways TEXT[],
    tax_identifiers JSONB,
    primary_contacts JSONB,
    compliance_contacts JSONB,
    ecommerce_platforms JSONB,
    key_systems TEXT[],
    holiday_blackout_dates TEXT[],
    data_processing_addenda TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
    CONSTRAINT unique_org_business_profile UNIQUE (organization_id)
);

-- Create index for faster lookups
CREATE INDEX idx_org_business_profiles_org_id ON organization_business_profiles(organization_id);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_org_business_profiles_updated_at
    BEFORE UPDATE ON organization_business_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER IF EXISTS update_org_business_profiles_updated_at ON organization_business_profiles;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP INDEX IF EXISTS idx_org_business_profiles_org_id;
DROP TABLE IF EXISTS organization_business_profiles;
-- +goose StatementEnd