-- +goose Up
-- +goose StatementBegin
-- Drop the existing constraint
ALTER TABLE assets DROP CONSTRAINT IF EXISTS check_owner;

-- Add the corrected constraint that allows both organization_id and user_id to be set
-- for organization assets, but requires at least one of them to be set
ALTER TABLE assets ADD CONSTRAINT check_owner CHECK (
    (organization_id IS NOT NULL) OR (user_id IS NOT NULL)
);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
-- Revert to the original constraint
ALTER TABLE assets DROP CONSTRAINT IF EXISTS check_owner;

ALTER TABLE assets ADD CONSTRAINT check_owner CHECK (
    (organization_id IS NOT NULL AND user_id IS NULL) OR
    (organization_id IS NULL AND user_id IS NOT NULL)
);
-- +goose StatementEnd
