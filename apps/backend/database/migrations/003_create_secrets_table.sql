-- +goose Up
-- +goose StatementBegin
CREATE TABLE IF NOT EXISTS secrets (
    id           BIGSERIAL PRIMARY KEY,
    app          TEXT,
    name         TEXT NOT NULL,
    description  TEXT,
    ciphertext   BYTEA NOT NULL,
    iv           BYTEA NOT NULL,
    algo         TEXT NOT NULL DEFAULT 'AES-256-GCM',
    created_by   TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- +goose StatementEnd

-- Create unique constraint
ALTER TABLE secrets ADD CONSTRAINT secrets_app_name_unique UNIQUE (app, name);

-- Create indexes
CREATE INDEX idx_secrets_app_name ON secrets(app, name);
CREATE INDEX idx_secrets_created_by ON secrets(created_by);
CREATE INDEX idx_secrets_created_at ON secrets(created_at);

-- +goose Down
-- +goose StatementBegin
DROP TABLE IF EXISTS secrets CASCADE;
-- +goose StatementEnd
