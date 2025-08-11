-- +goose Up
-- +goose StatementBegin
-- Add organization_id column to secrets table
ALTER TABLE secrets ADD COLUMN organization_id BIGINT;

-- Add foreign key constraint
ALTER TABLE secrets ADD CONSTRAINT fk_secrets_organization 
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

-- Create index for organization lookups
CREATE INDEX idx_secrets_organization_id ON secrets(organization_id);

-- Update unique constraint to include organization_id
ALTER TABLE secrets DROP CONSTRAINT secrets_app_name_unique;
ALTER TABLE secrets ADD CONSTRAINT secrets_app_name_org_unique 
    UNIQUE (app, name, organization_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Remove foreign key constraint
ALTER TABLE secrets DROP CONSTRAINT fk_secrets_organization;

-- Remove organization_id column
ALTER TABLE secrets DROP COLUMN organization_id;

-- Restore original unique constraint
ALTER TABLE secrets DROP CONSTRAINT secrets_app_name_org_unique;
ALTER TABLE secrets ADD CONSTRAINT secrets_app_name_unique UNIQUE (app, name);
-- +goose StatementEnd
