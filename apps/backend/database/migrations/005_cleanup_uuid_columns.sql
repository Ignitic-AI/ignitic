-- +goose Up
-- +goose StatementBegin
-- Remove UUID columns we added
ALTER TABLE users DROP COLUMN IF EXISTS uuid_id;
ALTER TABLE organizations DROP COLUMN IF EXISTS created_by_uuid;
ALTER TABLE user_organizations DROP COLUMN IF EXISTS user_uuid_id;
ALTER TABLE user_organizations DROP COLUMN IF EXISTS organization_uuid_id;
ALTER TABLE secrets DROP COLUMN IF EXISTS created_by_uuid;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Add back UUID columns if needed
ALTER TABLE users ADD COLUMN uuid_id UUID;
ALTER TABLE organizations ADD COLUMN created_by_uuid UUID;
ALTER TABLE user_organizations ADD COLUMN user_uuid_id UUID;
ALTER TABLE user_organizations ADD COLUMN organization_uuid_id UUID;
ALTER TABLE secrets ADD COLUMN created_by_uuid UUID;
-- +goose StatementEnd
