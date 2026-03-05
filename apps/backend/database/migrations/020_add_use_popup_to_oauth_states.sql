-- +goose Up
-- +goose StatementBegin
ALTER TABLE oauth_states ADD COLUMN IF NOT EXISTS use_popup BOOLEAN DEFAULT false;
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
ALTER TABLE oauth_states DROP COLUMN IF EXISTS use_popup;
-- +goose StatementEnd
