-- +goose Up
-- +goose StatementBegin
-- Add section and auth_result columns to logs for better filtering
ALTER TABLE logs
ADD COLUMN IF NOT EXISTS section VARCHAR(50),
ADD COLUMN IF NOT EXISTS auth_result VARCHAR(30);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_logs_section ON logs(section);
CREATE INDEX IF NOT EXISTS idx_logs_auth_result ON logs(auth_result);
-- +goose StatementEnd


DROP INDEX IF EXISTS idx_logs_section;
DROP INDEX IF EXISTS idx_logs_auth_result;
ALTER TABLE logs
DROP COLUMN IF EXISTS section,
DROP COLUMN IF EXISTS auth_result;
-- +goose StatementEnd


