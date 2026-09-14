-- +goose Up
-- +goose StatementBegin
-- Create todos table for task management
CREATE TABLE todos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    
    title TEXT NOT NULL,
    description TEXT,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    
    -- Monetary value (optional)
    monetary_value DECIMAL(10,2),
    
    -- Icon/Type identifier
    icon VARCHAR(50),
    
    -- Agent task association
    is_agent_task BOOLEAN NOT NULL DEFAULT false,
    agent_name VARCHAR(100),
    agent_task_id VARCHAR(255),
    agent_config JSONB,
    
    -- Scheduling
    scheduled_at TIMESTAMP WITH TIME ZONE,
    due_date TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    tags JSONB,
    metadata JSONB,
    
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for performance
CREATE INDEX idx_todos_user_id ON todos(user_id);
CREATE INDEX idx_todos_organization_id ON todos(organization_id);
CREATE INDEX idx_todos_status ON todos(status);
CREATE INDEX idx_todos_priority ON todos(priority);
CREATE INDEX idx_todos_created_by ON todos(created_by);
CREATE INDEX idx_todos_is_agent_task ON todos(is_agent_task);
CREATE INDEX idx_todos_due_date ON todos(due_date);
CREATE INDEX idx_todos_scheduled_at ON todos(scheduled_at);
CREATE INDEX idx_todos_deleted_at ON todos(deleted_at);

-- Create composite indexes for common queries
CREATE INDEX idx_todos_user_status ON todos(user_id, status);
CREATE INDEX idx_todos_user_priority ON todos(user_id, priority);
CREATE INDEX idx_todos_org_status ON todos(organization_id, status) WHERE organization_id IS NOT NULL;

-- Create function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_todos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
CREATE TRIGGER trigger_update_todos_updated_at
    BEFORE UPDATE ON todos
    FOR EACH ROW
    EXECUTE FUNCTION update_todos_updated_at();
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Drop trigger and function
DROP TRIGGER IF EXISTS trigger_update_todos_updated_at ON todos;
DROP FUNCTION IF EXISTS update_todos_updated_at();

-- Drop table
DROP TABLE IF EXISTS todos;
-- +goose StatementEnd







