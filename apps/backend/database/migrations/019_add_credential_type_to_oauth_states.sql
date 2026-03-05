-- +goose Up
-- +goose StatementBegin
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS credential_type VARCHAR(128);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE oauth_states DROP COLUMN IF EXISTS credential_type;
-- +goose StatementEnd
