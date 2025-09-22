-- +goose Up
-- +goose StatementBegin
-- Create logs table for application logging
CREATE TABLE logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    level VARCHAR(10) NOT NULL CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR')),
    category VARCHAR(50) NOT NULL CHECK (category IN ('USER', 'RBAC', 'AGENTS', 'ASSETS', 'AUTH', 'SECRETS', 'SYSTEM', 'API')),
    subcategory VARCHAR(50),
    message TEXT NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    request_id VARCHAR(100),
    ip_address INET,
    endpoint VARCHAR(255),
    method VARCHAR(10),
    status_code INTEGER,
    response_time_ms INTEGER,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_logs_timestamp ON logs(timestamp);
CREATE INDEX idx_logs_category ON logs(category);
CREATE INDEX idx_logs_user_id ON logs(user_id);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_organization_id ON logs(organization_id);
CREATE INDEX idx_logs_request_id ON logs(request_id);
CREATE INDEX idx_logs_metadata ON logs USING GIN(metadata);

-- Create composite indexes for common queries
CREATE INDEX idx_logs_category_level ON logs(category, level);
CREATE INDEX idx_logs_user_timestamp ON logs(user_id, timestamp);
CREATE INDEX idx_logs_category_timestamp ON logs(category, timestamp);
-- +goose StatementEnd

-- +goose Down
-- Drop logs table
DROP TABLE IF EXISTS logs;
