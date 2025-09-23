-- +goose Up
-- +goose StatementBegin
-- Drop legacy category/subcategory columns and related indexes
DO $do$
BEGIN
    -- Backfill section from existing category if present
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='logs' AND column_name='category'
    ) THEN
        EXECUTE $stmt$
            UPDATE logs SET section = 
                CASE UPPER(category)
                    WHEN 'AUTH' THEN 'AUTH'
                    WHEN 'ASSETS' THEN 'ASSETS'
                    WHEN 'SECRETS' THEN 'SECRETS'
                    WHEN 'AGENTS' THEN 'AGENTS'
                    WHEN 'USER' THEN 'USERS'
                    WHEN 'RBAC' THEN 'USERS'
                    WHEN 'SYSTEM' THEN 'SYSTEM'
                    ELSE 'API'
                END
            WHERE section IS NULL
        $stmt$;
    END IF;

    -- Drop indexes if exist
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_logs_category') THEN
        EXECUTE 'DROP INDEX idx_logs_category';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_logs_category_level') THEN
        EXECUTE 'DROP INDEX idx_logs_category_level';
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_logs_user_timestamp') THEN
        -- keep this as it doesn't depend on category
        NULL;
    END IF;

    -- Drop columns if exist
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='logs' AND column_name='subcategory'
    ) THEN
        EXECUTE 'ALTER TABLE logs DROP COLUMN subcategory';
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='logs' AND column_name='category'
    ) THEN
        EXECUTE 'ALTER TABLE logs DROP COLUMN category';
    END IF;
END$do$;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Re-add columns (without constraints) for rollback
ALTER TABLE logs
    ADD COLUMN IF NOT EXISTS category VARCHAR(50),
    ADD COLUMN IF NOT EXISTS subcategory VARCHAR(50);

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_logs_category ON logs(category);
-- composite index optional
-- CREATE INDEX IF NOT EXISTS idx_logs_category_level ON logs(category, level);
-- +goose StatementEnd


