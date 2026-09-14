# Backend Test Suite

This document describes the current test coverage under `backend/tests/` only. It is test-only documentation and does not change production code.

## Scope

The suite is split into four layers:

- Unit tests for isolated handlers, validators, helpers, and model logic
- Integration tests for DB-backed request flows and shared fixtures
- System tests for multi-step end-to-end workflows
- Non-functional tests for performance, reliability, and security checks

The tests use the SQLite test harness in `backend/tests/testutil/` and do not point at the main production database.

## Shared Test Utilities

`backend/tests/testutil/db.go`
- Creates the in-memory SQLite database used by tests.
- Registers the schema needed by the current suite.
- Adds SQLite helper functions for UUID generation and `NOW()`.
- Auto-fills UUID primary keys for test inserts when needed.

`backend/tests/testutil/http.go`
- Builds Gin test contexts.
- Adds trace logging for request/response data in verbose runs.
- Provides helpers to assert status and response body content.

`backend/tests/testutil/seed.go`
- Seeds a reusable demo dataset for integration smoke tests.
- Includes users, organizations, memberships, invitations, business profiles, todos, assets, secrets, credits, OAuth rows, a plan row, and a log row.

## How To Run

Run every backend test:

```bash
cd backend
go test ./tests/...
```

Run every backend test with request/response traces:

```bash
cd backend
go test -v ./tests/...
```

Run only unit tests:

```bash
cd backend
go test ./tests/unit/...
```

Run only integration tests:

```bash
cd backend
go test ./tests/integration
```

Run only system tests:

```bash
cd backend
go test ./tests/system
```

Run only non-functional tests:

```bash
cd backend
go test ./tests/nonfunctional
```

Run benchmarks:

```bash
cd backend
go test ./tests/nonfunctional -bench .
```

Run benchmarks with memory metrics:

```bash
cd backend
go test ./tests/nonfunctional -bench . -benchmem
```

Run one package or one test:

```bash
cd backend
go test -v ./tests/unit/auth -run TestRegisterLoginAndProfileFlow
```

## Unit Tests

### `backend/tests/unit/api/health_test.go`

`TestHealthRoute`
- Checks the `/health` route returns `200 OK`.
- Confirms the health handler is wired in the router.

### `backend/tests/unit/auth/auth_test.go`

`TestRegisterLoginAndProfileFlow`
- Registers a new user.
- Verifies the stored password is hashed.
- Logs in with valid credentials.
- Fetches the authenticated profile.

`TestAuthValidationBranches`
- Duplicate registration returns conflict.
- Bad login returns unauthorized.
- Refresh without auth context returns unauthorized.

`TestOnboardingAndProfileUpdates`
- Saves onboarding preferences.
- Updates profile data such as name, phone, and company.

`TestPasswordAndVerificationFlows`
- Changes the current password.
- Starts the forgot-password flow and stores a reset token.
- Resets the password with the stored token.
- Verifies the email with a token.

What this package covers:
- Register/login/logout-style flow logic
- Password validation and password lifecycle
- Onboarding and profile updates
- Auth failure branches and response codes
- Token-related behavior through handler paths

### `backend/tests/unit/asset/asset_test.go`

`TestGetCategories`
- Returns the supported asset categories.

`TestUploadAssetValidationBranches`
- Rejects upload without proper auth or payload.
- Rejects invalid asset category input.

`TestAssetListAndGetBranches`
- Lists assets for an organization-scoped user.
- Handles missing asset lookup cleanly.

What this package covers:
- Category listing
- Upload validation
- List/get branches
- Missing record behavior

### `backend/tests/unit/credential/credential_test.go`

`TestSecretCRUD`
- Creates a secret.
- Reads the secret back in decrypted form.
- Deletes the secret.

`TestSecretAccessAndListingBranches`
- Bulk upserts secrets.
- Lists user secrets.
- Lists organization secrets.
- Confirms org-scoped access behavior.

What this package covers:
- Secret creation, retrieval, deletion
- Encryption/decryption flow at handler level
- Personal vs org scope behavior
- Secret listing paths

### `backend/tests/unit/credits/credits_test.go`

`TestCreditsOverviewAndEntitlements`
- Loads the credits overview.
- Loads entitlements for the current user.

`TestCreditsRecordsPagination`
- Seeds multiple credit records.
- Verifies record pagination response.

What this package covers:
- Credit account bootstrap behavior
- Overview and entitlement payloads
- Records pagination
- User-scoped credit reads

### `backend/tests/unit/google_oauth/google_oauth_test.go`

`TestInitiateAuth`
- Starts Google OAuth authorization.
- Persists OAuth state.

`TestPopupTokensAndStubEndpoints`
- Returns popup token data.
- Performs logout.
- Exercises stubbed not-implemented endpoints.

What this package covers:
- OAuth initiation and state persistence
- Popup token retrieval
- Logout behavior
- Stub endpoint status handling

### `backend/tests/unit/logs/logs_test.go`

`TestLogServiceHandlers`
- Lists logs.
- Lists log sections.

`TestDatabaseLoggerOptionsAndInference`
- Verifies logger option setters.
- Verifies section inference and helper behavior.

What this package covers:
- Log listing handlers
- Logger option wiring
- Section inference behavior

### `backend/tests/unit/models/models_test.go`

`TestAssetCategoryAndTodoEnums`
- Validates enum values for assets and todos.

`TestJSONBMapValueAndScan`
- Verifies JSONB map value conversion and scanning.

`TestJSONBValueAndScan`
- Verifies JSON wrapper value conversion and scanning.

`TestAssetAndTodoHooks`
- Exercises model hooks for asset and todo records.

`TestCreditAccountAvailableCredits`
- Verifies available credit calculations.

`TestOrganizationBusinessProfileScanners`
- Verifies custom scanner/value helpers for business profile fields.

`TestModelJSONMarshalling`
- Verifies JSON marshaling/unmarshaling behavior for model types.

What this package covers:
- Pure model logic
- Scanner and valuer behavior
- Hook behavior
- Enum and derived-field correctness

### `backend/tests/unit/organization/organization_test.go`

`TestCreateAndGetOrganization`
- Creates an organization.
- Verifies employee-count fallback logic.
- Reads the organization back.

`TestOrganizationMembershipAndRoles`
- Lists organizations for a member.
- Adds a member.
- Lists members.

`TestJoinLeaveAndRoleUpdate`
- Joins an organization.
- Updates member role.
- Leaves the organization.

What this package covers:
- Organization CRUD branches
- Membership management
- Role update flow
- Employee count fallback

### `backend/tests/unit/organization/invitation_test.go`

`TestInviteAndAcceptInvitation`
- Sends an invite.
- Verifies the invitation row is created.
- Accepts the invitation.
- Confirms the invitation state changes to accepted.

`TestExpiredInvitation`
- Seeds an expired invite.
- Confirms acceptance is rejected.

What this package covers:
- Invite creation
- Invitation acceptance
- Expiry rejection
- Membership side effects

### `backend/tests/unit/organization/business_profile_test.go`

`TestOrgBusinessProfileCRUD`
- Creates or updates the business profile.
- Reads it back.
- Deletes it.

What this package covers:
- Organization business profile lifecycle
- Admin-gated profile operations
- CRUD response behavior

### `backend/tests/unit/policy/policy_test.go`

`TestPolicyOverviewAndConsumption`
- Loads a credit account overview.
- Exercises credit consumption paths.

`TestPolicySystemAdjustments`
- Exercises system adjustment and credit balance changes.

What this package covers:
- Policy/credit engine logic
- Default account bootstrap
- Consumption and adjustment behavior
- Credit math and side effects

### `backend/tests/unit/todo/todo_test.go`

`TestTodoCRUDAndFilters`
- Creates a todo.
- Reads it back.
- Updates it.
- Marks it complete.
- Lists all todos.
- Filters by status.
- Filters by priority.
- Deletes it.

`TestTodoValidationBranches`
- Rejects invalid todo input.

`TestTodoPersonalAccessControl`
- Creates a personal todo for one user.
- Verifies another user cannot read, update, complete, or delete it.

What this package covers:
- Todo lifecycle
- Status and priority handling
- Filtering logic
- Validation branches
- Personal todo access control branches

## Integration Tests

### `backend/tests/integration/auth_organization_test.go`

This test file runs a longer real flow across auth and organization services:

- Register a user
- Verify email
- Login
- Fetch profile
- Update profile
- Save onboarding data
- Request forgot-password
- Reset the password
- Create an organization
- List organizations
- Invite a member
- Accept the invitation

What this covers:
- DB persistence across module boundaries
- Auth and organization handoff
- Invitation and membership side effects
- End-to-end response correctness

### `backend/tests/integration/seed_smoke_test.go`

This test uses the shared seed dataset from `backend/tests/testutil/seed.go`.

It verifies:
- Organization list/get returns seeded data
- Todo status filtering returns seeded todo rows
- Credits overview returns seeded account values
- Secret listing returns seeded organization secrets

What this covers:
- Reusable seed data
- Stable fixture-driven assertions
- Cross-module read paths

## System Tests

### `backend/tests/system/workflow_test.go`

`TestEndToEndOrganizationTodoWorkflow`

This is the current system-level workflow test. It covers:

- User registration
- Email verification
- Login
- Organization creation
- Member invitation
- Invitation acceptance
- Organization todo creation
- Todo update
- Todo completion
- Todo deletion

What this covers:
- Full multi-step backend workflow
- Cross-service state propagation
- Realistic user journey behavior
- Final DB state after delete/complete operations

### `backend/tests/system/rbac_workflow_test.go`

`TestOrganizationTodoRoleMatrixWorkflow`

This system workflow extends multi-user RBAC coverage:

- Admin creates an organization
- Admin invites a member and a viewer
- Both invited users accept invitations
- Viewer is denied when creating org-scoped todos
- Member can create org-scoped todos
- Viewer can list org-scoped todos
- Member is denied deleting org-scoped todos
- Admin can delete org-scoped todos

What this covers:
- Role propagation through invitation acceptance
- Organization todo permissions (`admin`, `member`, `viewer`)
- End-to-end authorization behavior across services

## Non-Functional Tests

### `backend/tests/nonfunctional/performance_test.go`

Benchmarks currently cover:

- Auth registration and login
- Todo creation
- Todo list filtering under seeded load
- Todo update throughput on an existing row
- Credits overview reads
- Credits records pagination reads
- Asset list filtering for org-scoped assets
- Asset get-by-id reads
- Agent WebSocket response broadcast fan-out

What this covers:
- Read/write throughput baselines for common todo operations
- Throughput baselines for credits endpoints
- Throughput baselines for asset read endpoints
- In-memory agent notification broadcast performance
- Allocation visibility with `-benchmem`
- Regression comparison across changes

### `backend/tests/nonfunctional/security_test.go`

Current checks cover:

- Tampered JWT handling
- Unauthorized secret access
- Weak JWT secret rotation failure mode

What this covers:
- Authentication integrity
- Access control boundaries
- Security regression checks

## Current Seeded Data

The shared seed fixture currently includes:

- Admin user
- Member user
- Personal user
- Demo organization
- Admin and member memberships
- Invitation
- Organization business profile
- Personal and organization todos
- Personal and organization assets
- Personal and organization secrets
- Credit account and credit record
- OAuth state and popup token
- Starter plan
- Log row

This seed data is used by the smoke test and can be reused for future integration coverage.

## What The Verbose Output Shows

The current helper layer prints request/response traces in `-v` mode for most HTTP-style tests.

Typical trace contents:

- Method and path
- Request JSON
- Status code
- Response JSON
- Response headers

This makes it easier to see:

- What was created
- What was fetched
- What was updated
- What was deleted
- Why a test failed

## Notes On Expected Noise

Some log lines are expected and do not indicate test failure:

- `record not found` during negative-path assertions
- External email/API failures from stubbed or unreachable services
- SQLite logger warnings for metadata fields stored as raw maps

If the test passes, these messages are usually part of the exercise path rather than a defect in the test itself.

## Practical Failure Debugging

If a test fails:

- Read the trace output first
- Check the request body and response body
- Verify the seeded rows for that test
- Re-run the exact package with `-v`
- Re-run the exact test with `-run`

Examples:

```bash
cd backend
go test -v ./tests/unit/auth -run TestPasswordAndVerificationFlows
```

```bash
cd backend
go test -v ./tests/integration -run TestSeedDemoDataSmoke
```

```bash
cd backend
go test -v ./tests/system -run TestEndToEndOrganizationTodoWorkflow
```
