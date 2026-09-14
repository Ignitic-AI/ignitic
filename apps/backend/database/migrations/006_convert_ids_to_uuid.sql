-- +goose Up
-- +goose StatementBegin
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop foreign key constraints first
ALTER TABLE user_organizations DROP CONSTRAINT IF EXISTS user_organizations_user_id_fkey;
ALTER TABLE user_organizations DROP CONSTRAINT IF EXISTS user_organizations_organization_id_fkey;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_organization_id_fkey;
ALTER TABLE secrets DROP CONSTRAINT IF EXISTS secrets_organization_id_fkey;

-- Add temporary UUID columns
ALTER TABLE users ADD COLUMN temp_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE organizations ADD COLUMN temp_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE user_organizations ADD COLUMN temp_id UUID DEFAULT uuid_generate_v4();
ALTER TABLE secrets ADD COLUMN temp_id UUID DEFAULT uuid_generate_v4();

-- Drop primary key constraints
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_pkey;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_pkey;
ALTER TABLE user_organizations DROP CONSTRAINT IF EXISTS user_organizations_pkey;
ALTER TABLE secrets DROP CONSTRAINT IF EXISTS secrets_pkey;

-- Drop old ID columns
ALTER TABLE users DROP COLUMN id;
ALTER TABLE organizations DROP COLUMN id;
ALTER TABLE user_organizations DROP COLUMN id;
ALTER TABLE secrets DROP COLUMN id;

-- Rename temp_id to id
ALTER TABLE users RENAME COLUMN temp_id TO id;
ALTER TABLE organizations RENAME COLUMN temp_id TO id;
ALTER TABLE user_organizations RENAME COLUMN temp_id TO id;
ALTER TABLE secrets RENAME COLUMN temp_id TO id;

-- Add primary key constraints
ALTER TABLE users ADD PRIMARY KEY (id);
ALTER TABLE organizations ADD PRIMARY KEY (id);
ALTER TABLE user_organizations ADD PRIMARY KEY (id);
ALTER TABLE secrets ADD PRIMARY KEY (id);

-- Convert foreign key columns to UUID
ALTER TABLE users ALTER COLUMN organization_id TYPE UUID USING (CASE WHEN organization_id IS NULL THEN NULL ELSE uuid_generate_v4() END);
ALTER TABLE user_organizations ALTER COLUMN user_id TYPE UUID USING uuid_generate_v4();
ALTER TABLE user_organizations ALTER COLUMN organization_id TYPE UUID USING uuid_generate_v4();
ALTER TABLE secrets ALTER COLUMN created_by TYPE UUID USING uuid_generate_v4();
ALTER TABLE secrets ALTER COLUMN organization_id TYPE UUID USING (CASE WHEN organization_id IS NULL THEN NULL ELSE uuid_generate_v4() END);

-- Add back foreign key constraints
ALTER TABLE user_organizations ADD CONSTRAINT user_organizations_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE user_organizations ADD CONSTRAINT user_organizations_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
ALTER TABLE users ADD CONSTRAINT users_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE secrets ADD CONSTRAINT secrets_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_organization_id ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_user_id ON user_organizations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_organizations_organization_id ON user_organizations(organization_id);
CREATE INDEX IF NOT EXISTS idx_secrets_created_by ON secrets(created_by);
CREATE INDEX IF NOT EXISTS idx_secrets_organization_id ON secrets(organization_id);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- This migration cannot be safely reversed
-- Manual intervention would be required to restore integer IDs
-- +goose StatementEnd
