# Testing Guide
## Ignitic AI — Backend API
**Version:** 1.0  

---

## Overview

The test suite lives entirely under `tests/` and uses an **in-memory SQLite** harness, so no running PostgreSQL or RabbitMQ instance is needed. The tests are organized into four layers:

| Layer | Location | Purpose |
|---|---|---|
| Unit | `tests/unit/` | Isolated handler, validator, model, and helper logic |
| Integration | `tests/integration/` | DB-backed flows across multiple modules |
| System | `tests/system/` | Multi-step end-to-end user workflows |
| Non-functional | `tests/nonfunctional/` | Performance benchmarks and security regression checks |

See `tests/TESTING.md` for the full per-test description.

---

## Prerequisites

- Go 1.23+
- No database or broker required; SQLite is used via the in-memory harness in `tests/testutil/db.go`.

---

## Running Tests

### Run the full suite

```bash
cd backend
GOCACHE=/tmp/codex-gocache go test ./tests/...
```

### Run with verbose output (request/response traces)

```bash
GOCACHE=/tmp/codex-gocache go test -v ./tests/...
```

### Run a specific layer

```bash
# Unit tests only
GOCACHE=/tmp/codex-gocache go test ./tests/unit/...

# Integration tests only
GOCACHE=/tmp/codex-gocache go test ./tests/integration

# System tests only
GOCACHE=/tmp/codex-gocache go test ./tests/system

# Non-functional tests only
GOCACHE=/tmp/codex-gocache go test ./tests/nonfunctional
```

### Run a specific package or test

```bash
GOCACHE=/tmp/codex-gocache go test -v ./tests/unit/auth -run TestRegisterLoginAndProfileFlow

GOCACHE=/tmp/codex-gocache go test -v ./tests/integration -run TestSeedDemoDataSmoke

GOCACHE=/tmp/codex-gocache go test -v ./tests/system -run TestEndToEndOrganizationTodoWorkflow
```

### Run benchmarks

```bash
GOCACHE=/tmp/codex-gocache go test ./tests/nonfunctional -bench .

# With memory allocation metrics
GOCACHE=/tmp/codex-gocache go test ./tests/nonfunctional -bench . -benchmem
```

---

## Test Infrastructure

### `tests/testutil/db.go`

Creates and seeds the in-memory SQLite database used by all tests:

- Registers SQLite helper functions for UUID generation and `NOW()`.
- Applies the schema needed by the current test suite.
- Auto-fills UUID primary keys for test inserts.

### `tests/testutil/http.go`

HTTP test helpers:

- Builds Gin test contexts with configurable auth context.
- Provides `AssertStatus` and `AssertBodyContains` helpers.
- Prints request/response traces in `-v` mode.

### `tests/testutil/seed.go`

Shared demo dataset used by integration smoke tests:

| Seeded Entity | Description |
|---|---|
| Admin user | `admin@example.com` |
| Member user | `member@example.com` |
| Personal user | `personal@example.com` |
| Demo organization | `Acme Demo Org` |
| Memberships | Admin and member `user_organizations` rows |
| Invitation | Pending invite |
| Business profile | Org business profile |
| Todos | Personal and org-scoped |
| Assets | Personal and org-scoped |
| Secrets | Personal and org-scoped |
| Credit account | Starter plan account |
| Credit record | Single debit record |
| OAuth state / popup token | For OAuth flow tests |
| Plan | `starter` plan |
| Log row | Sample API log |

---

## Unit Test Coverage

### `tests/unit/api/`

- `GET /health` returns `200 OK`.

### `tests/unit/auth/`

- Register, login, and profile fetch flow.
- Duplicate registration → 409; bad login → 401.
- Onboarding and profile update.
- Password change, forgot-password, reset-password, email verification.

### `tests/unit/asset/`

- Get categories endpoint.
- Upload validation (missing auth, invalid category).
- List and get assets (including missing-record behavior).

### `tests/unit/credential/`

- Secret create, read (decrypted), delete.
- Bulk upsert, list user secrets, list org secrets.
- Personal vs org scope.

### `tests/unit/credits/`

- Credits overview and entitlements loading.
- Records pagination.
- User-scoped reads.

### `tests/unit/google_oauth/`

- OAuth initiation and state persistence.
- Popup token retrieval, logout, stub endpoint status.

### `tests/unit/logs/`

- Log listing and section listing.
- Logger option wiring and section inference.

### `tests/unit/models/`

- Asset category and todo enum validity.
- JSONB map `Value()` / `Scan()` round-trip.
- GORM model hooks (Asset, Todo).
- Credit account balance calculation.
- Organization business profile custom scanner/valuer.
- JSON marshaling/unmarshaling for all model types.

### `tests/unit/organization/`

- Org create, get (with employee-count fallback).
- Member listing, add, role update.
- Join, leave organization.
- Invitation: send, accept, expire.
- Business profile CRUD.

### `tests/unit/policy/`

- Credit overview and consumption paths.
- System credit adjustments.
- Default account bootstrap.
- Credit math and side effects.

### `tests/unit/todo/`

- Todo CRUD (create, read, update, complete, list, delete).
- Filter by status and priority.
- Input validation branches.
- Personal access control (other user cannot access).

---

## Integration Tests

### `tests/integration/auth_organization_test.go`

Full cross-service flow:

1. Register → verify email → login → fetch profile → update profile → save onboarding
2. Forgot-password → reset-password
3. Create organization → list organizations
4. Invite member → accept invitation

### `tests/integration/seed_smoke_test.go`

Smoke test using the shared seed dataset:

- Org list/get returns seeded data.
- Todo status filtering returns seeded rows.
- Credits overview matches seeded account.
- Secret listing returns seeded org secrets.

---

## System Tests

### `tests/system/workflow_test.go` — `TestEndToEndOrganizationTodoWorkflow`

Full end-to-end user journey:

1. Register → verify email → login
2. Create organization
3. Invite member → accept invitation
4. Create org-scoped todo
5. Update todo
6. Mark todo complete
7. Delete todo

### `tests/system/rbac_workflow_test.go` — `TestOrganizationTodoRoleMatrixWorkflow`

Multi-user RBAC coverage:

1. Admin creates org, invites member and viewer.
2. Both accept invitations.
3. Viewer is denied creating org-scoped todos.
4. Member can create org-scoped todos.
5. Viewer can list org-scoped todos.
6. Member is denied deleting org-scoped todos.
7. Admin can delete org-scoped todos.

---

## Non-Functional Tests

### `tests/nonfunctional/performance_test.go`

Benchmarks:

| Benchmark | What It Measures |
|---|---|
| `BenchmarkAuthFlow` | Registration and login throughput |
| `BenchmarkTodoCreate` | Todo creation throughput |
| `BenchmarkTodoList` | Todo list filtering under seeded load |
| `BenchmarkTodoUpdate` | Todo update throughput |
| `BenchmarkCreditsOverview` | Credits read throughput |
| `BenchmarkCreditsRecords` | Credits records pagination throughput |
| `BenchmarkAssetList` | Asset list filtering for org-scoped assets |
| `BenchmarkAssetGet` | Asset get-by-id reads |
| `BenchmarkWSBroadcast` | WebSocket response broadcast fan-out |

### `tests/nonfunctional/security_test.go`

Security regression checks:

- Tampered JWT is rejected.
- Unauthorized secret access is denied.
- Weak JWT secret rotation failure mode.

---

## Expected Noise

Some log output during test runs is normal and does not indicate failure:

- `record not found` — expected during negative-path assertions.
- External email / API failure messages — services are stubbed or unreachable in tests.
- SQLite logger warnings for JSONB metadata fields — SQLite uses text; type mismatch is harmless.

---

## Debugging Failures

1. Add `-v` flag to see full request/response traces.
2. Check the request body and response body in the trace.
3. Verify the seeded rows for the specific test case.
4. Re-run the exact failing test with `-run <TestName>`.

```bash
# Example: debug a specific failing test
GOCACHE=/tmp/codex-gocache go test -v ./tests/unit/auth -run TestPasswordAndVerificationFlows
```

---

## Adding New Tests

1. Choose the appropriate layer (unit / integration / system / nonfunctional).
2. Use `testutil.NewTestDB(t)` for an isolated in-memory database.
3. Use `testutil.NewTestContext(t, db, userID, orgID, role)` to create a Gin context.
4. Use `testutil.AssertStatus(t, w, http.StatusOK)` to assert response codes.
5. For integration/system tests, use `testutil.SeedDemoData(t, db)` if you need pre-populated data.
6. Keep test helpers in `testutil/`; avoid duplicating setup logic across tests.
