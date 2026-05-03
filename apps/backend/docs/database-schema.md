# Database Schema
## Ignitic AI — Backend API
**Version:** 1.0  

---

## Overview

The database is PostgreSQL. All schema changes are applied automatically on startup via **Goose** SQL migration files located in `database/migrations/`. The migration state is tracked in the `goose_db_version` table.

All primary keys are UUIDs (`uuid_generate_v4()` / `gen_random_uuid()`). Soft-deletes are implemented with a `deleted_at` nullable timestamp column on tables that support logical deletion.

---

## Tables

### `users`

Stores individual user accounts.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `email` | VARCHAR(255) | NO | — | Unique |
| `password` | VARCHAR(255) | NO | — | bcrypt hash |
| `first_name` | VARCHAR(100) | NO | — | |
| `last_name` | VARCHAR(100) | NO | — | |
| `phone` | VARCHAR(20) | YES | NULL | |
| `company` | VARCHAR(200) | YES | NULL | |
| `role` | VARCHAR(50) | NO | `'user'` | System-level role |
| `is_active` | BOOLEAN | NO | `true` | |
| `email_verified` | BOOLEAN | NO | `false` | |
| `verification_token` | VARCHAR(255) | YES | NULL | Email verification token |
| `reset_token` | VARCHAR(255) | YES | NULL | Password reset token |
| `reset_token_expiry` | TIMESTAMP | YES | NULL | |
| `last_login` | TIMESTAMP | YES | NULL | |
| `organization_id` | UUID | YES | NULL | FK → `organizations.id` (SET NULL on delete) |
| `onboarding_personal` | JSONB | YES | NULL | Onboarding personal preferences |
| `created_at` | TIMESTAMP | NO | `CURRENT_TIMESTAMP` | |
| `updated_at` | TIMESTAMP | NO | `CURRENT_TIMESTAMP` | |
| `deleted_at` | TIMESTAMP | YES | NULL | Soft delete |

**Indexes:** `email`, `organization_id`, `deleted_at`, `verification_token`, `reset_token`, `role`

---

### `organizations`

Stores workspace/organization entities.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `name` | VARCHAR(255) | NO | — | |
| `description` | TEXT | YES | NULL | |
| `employee_count` | INTEGER | NO | `1` | |
| `ecommerce_domain` | VARCHAR(255) | YES | NULL | |
| `industry` | VARCHAR(255) | YES | NULL | |
| `company_size` | VARCHAR(50) | YES | NULL | |
| `website` | VARCHAR(255) | YES | NULL | |
| `country` | VARCHAR(100) | YES | NULL | |
| `city` | VARCHAR(100) | YES | NULL | |
| `address` | TEXT | YES | NULL | |
| `phone_number` | VARCHAR(50) | YES | NULL | |
| `is_active` | BOOLEAN | NO | `true` | |
| `subscription_plan` | VARCHAR(50) | NO | `'free'` | |
| `hear_about_us` | VARCHAR(255) | YES | NULL | |
| `work_on_multiple_platforms` | BOOLEAN | NO | `false` | |
| `selected_brands` | JSONB | YES | NULL | |
| `preferred_automation_ids` | JSONB | YES | NULL | |
| `created_by` | UUID | NO | — | FK → `users.id` (SET NULL on delete) |
| `created_at` | TIMESTAMP | NO | `CURRENT_TIMESTAMP` | |
| `updated_at` | TIMESTAMP | NO | `CURRENT_TIMESTAMP` | |
| `deleted_at` | TIMESTAMP | YES | NULL | Soft delete |

**Indexes:** `name`, `is_active`

---

### `user_organizations`

Junction table implementing a many-to-many relationship between users and organizations with a role.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `user_id` | UUID | NO | — | FK → `users.id` (CASCADE) |
| `organization_id` | UUID | NO | — | FK → `organizations.id` (CASCADE) |
| `role` | VARCHAR(50) | NO | `'member'` | `admin`, `member`, `viewer` |
| `onboarding_job_title` | VARCHAR(255) | YES | NULL | |
| `joined_at` | TIMESTAMP | NO | `CURRENT_TIMESTAMP` | |
| `is_active` | BOOLEAN | NO | `true` | |

**Unique constraint:** `(user_id, organization_id)`  
**Indexes:** `user_id`, `organization_id`, `is_active`

---

### `organization_invitations`

Tracks pending, accepted, and expired invitations.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `gen_random_uuid()` | Primary key |
| `organization_id` | UUID | NO | — | FK → `organizations.id` |
| `email` | TEXT | NO | — | Invitee email |
| `role` | TEXT | NO | — | Proposed role |
| `status` | TEXT | NO | `'pending'` | `pending`, `accepted`, `expired` |
| `invited_by` | UUID | NO | — | FK → `users.id` |
| `expires_at` | TIMESTAMP | NO | — | |
| `created_at` | TIMESTAMP | NO | `CURRENT_TIMESTAMP` | |
| `updated_at` | TIMESTAMP | NO | `CURRENT_TIMESTAMP` | |

---

### `organization_business_profiles`

Extended business metadata for an organization (1:1 with organization).

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | NO | Primary key |
| `organization_id` | UUID | NO | Unique FK → `organizations.id` |
| `business_hours` | TEXT | YES | |
| `primary_markets` | TEXT[] | YES | PostgreSQL array |
| `default_currency` | TEXT | YES | |
| `supported_languages` | TEXT[] | YES | |
| `support_email` | TEXT | YES | |
| `support_channels` | TEXT[] | YES | |
| `social_links` | JSONB | YES | `{platform: url}` map |
| `fulfillment_method` | TEXT | YES | |
| `shipping_carriers` | TEXT[] | YES | |
| `returns_policy_url` | TEXT | YES | |
| `payment_gateways` | TEXT[] | YES | |
| `tax_identifiers` | JSONB | YES | |
| `primary_contacts` | JSONB | YES | Array of `{name, role, email}` |
| `compliance_contacts` | JSONB | YES | Array of `{name, role, email}` |
| `ecommerce_platforms` | JSONB | YES | Array of `{name, version, url}` |
| `key_systems` | TEXT[] | YES | |
| `holiday_blackout_dates` | TEXT[] | YES | |
| `data_processing_addenda` | TEXT | YES | |
| `created_at` | TIMESTAMPTZ | NO | `now()` |
| `updated_at` | TIMESTAMPTZ | NO | `now()` |

---

### `secrets`

Stores encrypted third-party credentials.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `app` | TEXT | YES | NULL | Namespace (e.g., `shopify`, `hubspot`) |
| `name` | TEXT | NO | — | Key name within app |
| `description` | TEXT | YES | NULL | |
| `ciphertext` | BYTEA | NO | — | AES-256-GCM encrypted value |
| `iv` | BYTEA | NO | — | 96-bit nonce |
| `algo` | TEXT | NO | `'AES-256-GCM'` | Encryption algorithm identifier |
| `created_by` | UUID | NO | — | FK → `users.id` (CASCADE) |
| `organization_id` | UUID | YES | NULL | FK → `organizations.id` (SET NULL) |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | |

**Unique constraint:** `(app, name, organization_id)`  
**Indexes:** `(app, name)`, `created_by`, `organization_id`, `created_at`

---

### `assets`

Stores file metadata for uploaded assets (files live in Cloudinary).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `organization_id` | UUID | YES | NULL | FK → `organizations.id` |
| `user_id` | UUID | YES | NULL | FK → `users.id` |
| `category` | TEXT | NO | — | `business_profile`, `brand_assets`, etc. |
| `title` | TEXT | YES | NULL | |
| `storage_provider` | TEXT | NO | `'local'` | `cloudinary` or `local` |
| `path` | TEXT | YES | NULL | Cloudinary public ID |
| `url` | TEXT | YES | NULL | CDN delivery URL |
| `mime_type` | TEXT | YES | NULL | |
| `file_ext` | TEXT | YES | NULL | |
| `size_bytes` | BIGINT | YES | NULL | |
| `tags` | JSONB | YES | NULL | JSON array of tag strings |
| `metadata` | JSONB | YES | NULL | Arbitrary metadata |
| `created_by` | UUID | NO | — | FK → `users.id` |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | |
| `deleted_at` | TIMESTAMP | YES | NULL | Soft delete |

**Indexes:** `organization_id`, `user_id`, `category`, `created_by`

---

### `todos`

Tracks task items for users, optionally tied to agent tasks.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `user_id` | UUID | NO | — | FK → `users.id` |
| `organization_id` | UUID | YES | NULL | FK → `organizations.id` |
| `title` | TEXT | NO | — | |
| `description` | TEXT | YES | NULL | |
| `priority` | VARCHAR(20) | NO | `'medium'` | `high`, `medium`, `low` |
| `status` | VARCHAR(20) | NO | `'todo'` | `todo`, `in_progress`, `done` |
| `progress` | INTEGER | NO | `0` | 0–100; check constraint |
| `monetary_value` | DECIMAL(10,2) | YES | NULL | |
| `icon` | VARCHAR(50) | YES | NULL | |
| `is_agent_task` | BOOLEAN | NO | `false` | |
| `agent_name` | VARCHAR(100) | YES | NULL | |
| `agent_task_id` | VARCHAR(255) | YES | NULL | Reference to AI Engine task ID |
| `agent_config` | JSONB | YES | NULL | Agent task configuration |
| `scheduled_at` | TIMESTAMP | YES | NULL | |
| `due_date` | TIMESTAMP | YES | NULL | |
| `tags` | JSONB | YES | NULL | JSON array of strings |
| `metadata` | JSONB | YES | NULL | |
| `created_by` | UUID | NO | — | FK → `users.id` |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | |
| `deleted_at` | TIMESTAMP | YES | NULL | Soft delete |

**Indexes:** `user_id`, `organization_id`, `created_by`

---

### `plans`

Subscription plan definitions (seeded from `plan_definitions.json`).

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `code` | TEXT | NO | — | Unique plan code (`starter`, `pro`, `business`) |
| `name` | TEXT | NO | — | Human-readable name |
| `credits_per_cycle` | BIGINT | NO | — | Credit allocation per billing cycle |
| `rules_json` | JSONB | NO | — | Feature flags, limits, action costs |
| `is_active` | BOOLEAN | NO | `true` | |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | |

---

### `credit_accounts`

Tracks credit balances for users or organizations.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `owner_type` | TEXT | NO | — | `user` or `organization` |
| `owner_id` | UUID | NO | — | References `users.id` or `organizations.id` |
| `plan_code` | VARCHAR(32) | NO | `'starter'` | Active plan code |
| `plan_id` | UUID | YES | NULL | FK → `plans.id` |
| `total_credits` | BIGINT | NO | `0` | Total credits for current cycle |
| `credits_consumed` | BIGINT | NO | `0` | Credits used in current cycle |
| `cycle_start` | TIMESTAMPTZ | NO | — | |
| `cycle_end` | TIMESTAMPTZ | NO | — | |
| `status` | TEXT | NO | `'active'` | |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |
| `updated_at` | TIMESTAMPTZ | NO | `now()` | |

---

### `credit_records`

Immutable ledger of credit transactions.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `credit_account_id` | UUID | NO | — | FK → `credit_accounts.id` |
| `record_type` | TEXT | NO | — | `consumption`, `adjustment`, `reset` |
| `credits_delta` | BIGINT | NO | — | Positive = added, negative = consumed |
| `total_credits_after` | BIGINT | NO | — | Balance after this record |
| `credits_consumed_after` | BIGINT | NO | — | |
| `action_key` | TEXT | YES | NULL | e.g., `agent.chat` |
| `reference_id` | TEXT | YES | NULL | Chat request ID or other reference |
| `actor_user_id` | UUID | YES | NULL | FK → `users.id` |
| `metadata_json` | JSONB | YES | NULL | |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |

---

### `logs`

Structured audit log for all API activity.

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | Primary key |
| `timestamp` | TIMESTAMPTZ | NO | `now()` | |
| `level` | TEXT | NO | — | `DEBUG`, `INFO`, `WARN`, `ERROR` |
| `section` | TEXT | YES | NULL | `AUTH`, `ASSETS`, `SECRETS`, `AGENTS`, `ORGANIZATIONS`, `USERS`, `API`, `SYSTEM` |
| `auth_result` | TEXT | YES | NULL | `SUCCESS`, `UNAUTHORIZED`, `FORBIDDEN` |
| `message` | TEXT | NO | — | Human-readable description |
| `user_id` | UUID | YES | NULL | FK → `users.id` |
| `organization_id` | UUID | YES | NULL | FK → `organizations.id` |
| `request_id` | TEXT | YES | NULL | `X-Request-ID` header value |
| `ip_address` | TEXT | YES | NULL | |
| `endpoint` | TEXT | YES | NULL | URL path |
| `method` | TEXT | YES | NULL | HTTP method |
| `status_code` | INTEGER | YES | NULL | |
| `response_time_ms` | INTEGER | YES | NULL | |
| `metadata` | JSONB | YES | NULL | |
| `created_at` | TIMESTAMPTZ | NO | `now()` | |

**Indexes:** `timestamp`, `user_id`, `organization_id`, `section`, `level`, `status_code`

---

### `oauth_states`

Temporary storage for OAuth 2.0 state parameters.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | NO | Primary key |
| `state` | TEXT | NO | Random state string; unique |
| `user_id` | UUID | YES | FK → `users.id` |
| `credential_type` | TEXT | YES | e.g., `google`, `shopify` |
| `use_popup` | BOOLEAN | NO | Whether the popup OAuth flow is used |
| `created_at` | TIMESTAMPTZ | NO | |
| `expires_at` | TIMESTAMPTZ | NO | |

---

### `oauth_popup_tokens`

Short-lived tokens for the popup OAuth completion flow.

| Column | Type | Nullable | Notes |
|---|---|---|---|
| `id` | UUID | NO | Primary key |
| `token` | TEXT | NO | Unique token |
| `user_id` | UUID | NO | FK → `users.id` |
| `access_token` | TEXT | YES | |
| `refresh_token` | TEXT | YES | |
| `expires_at` | TIMESTAMPTZ | NO | |
| `created_at` | TIMESTAMPTZ | NO | |

---

## Entity-Relationship Summary

```
users ─────────────────── user_organizations ──── organizations
  │                             │                      │
  │                             └── role               ├── organization_business_profiles
  ├── secrets (personal)                               ├── organization_invitations
  ├── assets (personal)                                ├── secrets (org-scoped)
  ├── todos (personal)                                 ├── assets (org-scoped)
  ├── credit_accounts (user-type)                      ├── todos (org-scoped)
  ├── oauth_states                                     └── credit_accounts (org-type)
  └── oauth_popup_tokens

credit_accounts ─── credit_records
plans ──────────────► credit_accounts (plan_code)

logs (references user_id, organization_id — no FK constraint)
```

---

## Migration History

| File | Description |
|---|---|
| `001` | Create `users` table |
| `002` | Create `organizations` table |
| `003` | Create `secrets` table |
| `004` | Add `organization_id` to secrets |
| `005` | Clean up UUID columns |
| `006` | Convert IDs to UUID |
| `007` | Recreate core tables with UUID PKs |
| `008` | Create `organization_business_profiles` table |
| `009` | Create `assets` table |
| `010` | Create `organization_invitations` table |
| `011` | Fix assets owner constraint |
| `012` | Create `logs` table |
| `013` | Add `section` and `auth_result` to logs |
| `014` | Drop legacy logs `category`/`subcategory` columns |
| `015` | Create `todos` table |
| `016` | Create `plans` and `credit_accounts`/`credit_records` tables |
| `017` | Update `credit_accounts` to use `plan_code` |
| `018` | Create `oauth_states` table |
| `019` | Add `credential_type` to `oauth_states` |
| `020` | Add `use_popup` to `oauth_states` |
| `021` | Create `oauth_popup_tokens` table |
| `022` | Add onboarding fields to `users` and `organizations` |
