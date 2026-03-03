-- +goose Up

CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(32) UNIQUE NOT NULL CHECK (code IN ('starter', 'pro', 'business')),
    name VARCHAR(64) NOT NULL,
    credits_per_cycle BIGINT NOT NULL CHECK (credits_per_cycle >= 0),
    rules_json JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_type VARCHAR(20) NOT NULL CHECK (owner_type IN ('user', 'organization')),
    owner_id UUID NOT NULL,
    plan_id UUID NOT NULL REFERENCES plans(id),
    total_credits BIGINT NOT NULL DEFAULT 0 CHECK (total_credits >= 0),
    credits_consumed BIGINT NOT NULL DEFAULT 0 CHECK (credits_consumed >= 0),
    cycle_start TIMESTAMP NOT NULL DEFAULT now(),
    cycle_end TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    updated_at TIMESTAMP NOT NULL DEFAULT now(),
    UNIQUE(owner_type, owner_id),
    CHECK (credits_consumed <= total_credits)
);

CREATE TABLE IF NOT EXISTS credit_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credit_account_id UUID NOT NULL REFERENCES credit_accounts(id) ON DELETE CASCADE,
    record_type VARCHAR(32) NOT NULL CHECK (record_type IN ('consume', 'plan_change', 'cycle_reset', 'adjustment', 'grant_system')),
    credits_delta BIGINT NOT NULL,
    total_credits_after BIGINT NOT NULL,
    credits_consumed_after BIGINT NOT NULL,
    action_key VARCHAR(128),
    reference_id VARCHAR(255),
    actor_user_id UUID NULL,
    metadata_json JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT now(),
    CHECK (total_credits_after >= 0),
    CHECK (credits_consumed_after >= 0),
    CHECK (credits_consumed_after <= total_credits_after)
);

CREATE INDEX IF NOT EXISTS idx_credit_records_account_created_at
    ON credit_records(credit_account_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_records_idempotency
    ON credit_records(credit_account_id, record_type, reference_id)
    WHERE reference_id IS NOT NULL;

INSERT INTO plans (code, name, credits_per_cycle, rules_json)
VALUES
(
    'starter',
    'Starter',
    1000,
    '{
      "features": {
        "agent.chat": true,
        "agent.update": false,
        "workflow.import": false,
        "workflow.view": true,
        "workflow.delete": false,
        "secrets.read": true,
        "secrets.write": true,
        "secrets.delete": false,
        "analytics.agent_runs": true,
        "analytics.agent_usage": true,
        "analytics.tool_executions": false,
        "analytics.advanced": false
      },
      "limits": {
        "max_agents_per_chat": 2,
        "max_secrets": 10,
        "max_workflow_templates": 0,
        "allowed_models": ["z-ai/glm-4.5-air:free"],
        "allowed_tools": ["google_dork_search", "meta_tags_scraper_seo"]
      },
      "costs": {
        "action_costs": {
          "agent.chat": {"base": 5},
          "workflow.import": {"base": 10}
        },
        "model_multipliers": {
          "z-ai/glm-4.5-air:free": 1.0
        },
        "tool_costs": {}
      }
    }'::jsonb
),
(
    'pro',
    'Pro',
    5000,
    '{
      "features": {
        "agent.chat": true,
        "agent.update": true,
        "workflow.import": true,
        "workflow.view": true,
        "workflow.delete": true,
        "secrets.read": true,
        "secrets.write": true,
        "secrets.delete": true,
        "analytics.agent_runs": true,
        "analytics.agent_usage": true,
        "analytics.tool_executions": true,
        "analytics.advanced": false
      },
      "limits": {
        "max_agents_per_chat": 5,
        "max_secrets": 100,
        "max_workflow_templates": 25,
        "allowed_models": ["z-ai/glm-4.5-air:free", "openai/gpt-4o-mini"],
        "allowed_tools": ["*"]
      },
      "costs": {
        "action_costs": {
          "agent.chat": {"base": 4},
          "workflow.import": {"base": 8}
        },
        "model_multipliers": {
          "z-ai/glm-4.5-air:free": 1.0,
          "openai/gpt-4o-mini": 1.5
        },
        "tool_costs": {}
      }
    }'::jsonb
),
(
    'business',
    'Business',
    20000,
    '{
      "features": {
        "agent.chat": true,
        "agent.update": true,
        "workflow.import": true,
        "workflow.view": true,
        "workflow.delete": true,
        "secrets.read": true,
        "secrets.write": true,
        "secrets.delete": true,
        "analytics.agent_runs": true,
        "analytics.agent_usage": true,
        "analytics.tool_executions": true,
        "analytics.advanced": true
      },
      "limits": {
        "max_agents_per_chat": 20,
        "max_secrets": 1000,
        "max_workflow_templates": 500,
        "allowed_models": ["*"],
        "allowed_tools": ["*"]
      },
      "costs": {
        "action_costs": {
          "agent.chat": {"base": 3},
          "workflow.import": {"base": 5}
        },
        "model_multipliers": {
          "*": 1.0
        },
        "tool_costs": {}
      }
    }'::jsonb
)
ON CONFLICT (code) DO NOTHING;

-- +goose Down
DROP INDEX IF EXISTS idx_credit_records_idempotency;
DROP INDEX IF EXISTS idx_credit_records_account_created_at;
DROP TABLE IF EXISTS credit_records;
DROP TABLE IF EXISTS credit_accounts;
DROP TABLE IF EXISTS plans;
