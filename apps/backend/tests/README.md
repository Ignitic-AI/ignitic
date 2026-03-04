# Backend tests

Tests are grouped by type under the `tests/` folder.

## Structure

| Folder | Purpose |
|--------|--------|
| `tests/unit/` | Unit tests for single components (services, models, schemas). No DB or network. |
| `tests/http/` | HTTP handler tests using `gin` + `httptest`. Exercises API routes in isolation. |
| `tests/integration/` | Integration tests (e.g. API + database). Require a running Postgres; skipped if unavailable. |
| `tests/system/` | System tests against a full app router (middleware + all routes). Require DB; skipped if unavailable. |

### Unit tests (`tests/unit/`)

| File | Coverage |
|------|----------|
| `encryption_test.go` | `services.EncryptionService`: round-trip, invalid key, missing key, wrong AAD |
| `policy_types_test.go` | `services/policy`: endpoint roles, error sentinels, `AuthorizeResult` zero value |
| `models_test.go` | `models`: `User`, `Organization`, `UserOrganization` table names |
| `models_todo_asset_test.go` | `models`: `TodoPriority`/`TodoStatus`/`Todo`, `AssetCategory`, `Log` (IsValid, TableName) |
| `agents_schemas_test.go` | `api/agents`: `AgentResponse`, `AgentStreamChunk` JSON unmarshaling |

### HTTP tests (`tests/http/`)

| File | Coverage |
|------|----------|
| `health_test.go` | `GET /health`: status 200, body `status`/`service` |
| `auth_handlers_test.go` | Auth login/register: invalid JSON, missing/invalid email → 400 |

### Integration tests (`tests/integration/`)

| File | Coverage |
|------|----------|
| `database_test.go` | DB connect + migrations (skip if no DB); invalid config fails |
| `auth_flow_test.go` | Register + login flow with real DB (skip if no DB) |

### System tests (`tests/system/`)

| File | Coverage |
|------|----------|
| `api_test.go` | Full router: `GET /health` 200; `POST /api/v1/auth/login` invalid body → 400/401 (skip if no DB) |

## Running tests

From the **backend** root:

```bash
# All tests (unit + http always run; integration/system skip if no DB)
go test ./...

# Only tests under tests/
go test ./tests/...

# Only unit tests
go test ./tests/unit/...

# Only HTTP tests
go test ./tests/http/...

# Integration tests (require Postgres; use same env as app or set TEST_* vars)
RUN_INTEGRATION_TESTS=1 go test ./tests/integration/... -v

# System tests (require Postgres)
RUN_SYSTEM_TESTS=1 go test ./tests/system/... -v
```

## Integration and system tests

- **Integration** and **system** tests need a real PostgreSQL instance (same as dev, or a dedicated test DB).
- If `RUN_INTEGRATION_TESTS` or `RUN_SYSTEM_TESTS` is not set (or DB connection fails), those tests are skipped.
- Use your normal `.env` DB settings, or override with `TEST_DB_HOST`, `TEST_DB_PORT`, `TEST_DB_USER`, `TEST_DB_PASSWORD`, `TEST_DB_NAME` for integration/system.
