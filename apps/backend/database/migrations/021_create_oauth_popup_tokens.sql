-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS oauth_popup_tokens (
    code VARCHAR(64) PRIMARY KEY,
    token_data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_oauth_popup_tokens_expires ON oauth_popup_tokens(expires_at);
-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS oauth_popup_tokens;
-- +goose StatementEnd
