-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    category TEXT,
    title TEXT NOT NULL,
    
    storage_provider TEXT NOT NULL DEFAULT 'local',
    path TEXT,
    url TEXT,
    
    mime_type TEXT,
    file_ext TEXT,
    size_bytes BIGINT,
    
    tags JSONB,
    metadata JSONB,
    
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,

    CONSTRAINT check_owner CHECK (
        (organization_id IS NOT NULL AND user_id IS NULL) OR
        (organization_id IS NULL AND user_id IS NOT NULL)
    )
);

CREATE INDEX idx_assets_organization_id ON assets(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX idx_assets_user_id ON assets(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX idx_assets_category ON assets(category);
CREATE INDEX idx_assets_created_by ON assets(created_by);
CREATE INDEX idx_assets_deleted_at ON assets(deleted_at);

-- Create trigger for updated_at
CREATE TRIGGER update_assets_updated_at
    BEFORE UPDATE ON assets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TRIGGER IF EXISTS update_assets_updated_at ON assets;
DROP TABLE IF EXISTS assets;
-- +goose StatementEnd
