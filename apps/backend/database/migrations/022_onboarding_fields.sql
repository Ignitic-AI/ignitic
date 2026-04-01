-- +goose Up
ALTER TABLE organizations
    ADD COLUMN IF NOT EXISTS hear_about_us VARCHAR(255) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS work_on_multiple_platforms BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS selected_brands JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS preferred_automation_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE user_organizations
    ADD COLUMN IF NOT EXISTS onboarding_job_title VARCHAR(255) NOT NULL DEFAULT '';

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS onboarding_personal JSONB;

-- +goose Down
ALTER TABLE users DROP COLUMN IF EXISTS onboarding_personal;
ALTER TABLE user_organizations DROP COLUMN IF EXISTS onboarding_job_title;
ALTER TABLE organizations DROP COLUMN IF EXISTS preferred_automation_ids;
ALTER TABLE organizations DROP COLUMN IF EXISTS selected_brands;
ALTER TABLE organizations DROP COLUMN IF EXISTS work_on_multiple_platforms;
ALTER TABLE organizations DROP COLUMN IF EXISTS hear_about_us;
