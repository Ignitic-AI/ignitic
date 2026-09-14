-- +goose Up

ALTER TABLE credit_accounts ADD COLUMN IF NOT EXISTS plan_code VARCHAR(32);

-- Backfill from plans table if it exists and plan_id is available.
-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='credit_accounts' AND column_name='plan_id'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name='plans'
    ) THEN
        UPDATE credit_accounts ca
        SET plan_code = p.code
        FROM plans p
        WHERE ca.plan_code IS NULL
          AND ca.plan_id IS NOT NULL
          AND ca.plan_id = p.id;
    END IF;
END $$;
-- +goose StatementEnd

UPDATE credit_accounts SET plan_code = 'starter' WHERE plan_code IS NULL OR plan_code = '';

ALTER TABLE credit_accounts ALTER COLUMN plan_code SET DEFAULT 'starter';
ALTER TABLE credit_accounts ALTER COLUMN plan_code SET NOT NULL;

-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='credit_accounts' AND column_name='plan_id'
    ) THEN
        ALTER TABLE credit_accounts DROP CONSTRAINT IF EXISTS credit_accounts_plan_id_fkey;
        ALTER TABLE credit_accounts ALTER COLUMN plan_id DROP NOT NULL;
    END IF;
END $$;
-- +goose StatementEnd

-- +goose Down

-- +goose StatementBegin
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='credit_accounts' AND column_name='plan_id'
    ) THEN
        ALTER TABLE credit_accounts ALTER COLUMN plan_id SET NOT NULL;
    END IF;
END $$;
-- +goose StatementEnd

ALTER TABLE credit_accounts ALTER COLUMN plan_code DROP NOT NULL;
ALTER TABLE credit_accounts ALTER COLUMN plan_code DROP DEFAULT;
