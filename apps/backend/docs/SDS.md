# Software Design Specification (SDS)
## Ignitic AI — Backend API
**Version:** 1.0  
**Status:** Active  

---

## 1. Overview

This document describes the internal design of the Ignitic AI Backend API: package structure, request lifecycle, service architecture, key design patterns, background processes, and inter-service communication.

---

## 2. Package Structure

```
backend/
├── main.go                          # Entry point — wires all components
├── config.go                        # Environment-driven configuration structs
├── middleware.go                    # Global HTTP middleware (auth, rate-limit, security)
├── go.mod / go.sum                  # Go module definition
├── Dockerfile                       # Multi-stage container build
│
├── api/                             # HTTP handler packages (one per domain)
│   ├── routes.go                    # Health check route
│   ├── agents/                      # Agent relay + WebSocket + CORS
│   ├── analytics/                   # Agent & tool analytics
│   ├── asset/                       # Asset upload / CRUD
│   ├── auth/                        # Registration, login, profile, OAuth
│   ├── credential/                  # Secret CRUD + Shopify OAuth
│   │   └── google_oauth/            # Google OAuth initiation + callback
│   ├── credits/                     # Credits overview, records, entitlements
│   ├── logs/                        # Log query endpoints
│   ├── organization/                # Org CRUD, members, invitations, profiles
│   ├── todo/                        # Todo CRUD + agent scheduling
│   └── workflow/                    # n8n workflow template management
│
├── corsorigin/                      # Origin normalization utility
│
├── database/
│   ├── database.go                  # GORM init + Goose migrations runner
│   └── migrations/                  # Numbered SQL migration files (Goose)
│
├── models/                          # GORM model definitions (plain structs)
│
├── services/
│   ├── cloudinary.go                # Cloudinary upload wrapper
│   ├── email.go                     # Brevo transactional email
│   ├── encryption.go                # AES-256-GCM encrypt/decrypt helpers
│   ├── logger.go                    # DatabaseLogger (Gin middleware + write helper)
│   └── policy/
│       ├── service.go               # Credit policy enforcement
│       ├── types.go                 # Plan/rule type definitions
│       └── plan_definitions.json   # Seeded plan rules (starter, pro, business)
│
├── assets/                          # Static files (email templates, etc.)
│
├── docs/                            # Swaggo-generated Swagger JSON/YAML + project docs
│
└── tests/
    ├── TESTING.md
    ├── testutil/                    # Shared in-memory SQLite harness
    ├── unit/                        # Handler-level unit tests per domain
    ├── integration/                 # Multi-module DB-backed tests
    ├── system/                      # End-to-end workflow tests
    └── nonfunctional/               # Benchmarks and security tests
```

---

## 3. Configuration

Configuration is loaded at startup via `config.go` using `godotenv` and `os.Getenv`. All values have documented defaults. The `Config` struct is populated once and injected into all subsystems; no global config variable is used.

Key configuration groups:

| Group | Key Variables |
|---|---|
| Server | `SERVER_PORT`, `ENVIRONMENT`, `AI_ENGINE_URL` |
| Database | `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_SSL_MODE` |
| Security | `JWT_SECRET`, `ENCRYPTION_KEY`, `RATE_LIMIT_RPS` |
| Email | `BREVO_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME`, `FRONTEND_URL` |
| RabbitMQ | `RABBITMQ_URL` |
| Cloudinary | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Google OAuth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` |
| CORS | `CORS_ALLOWED_ORIGINS` (comma-separated) |

---

## 4. HTTP Server Architecture

### 4.1 Dual Router Design

The main function creates **two separate Gin routers** and combines them with a standard `http.ServeMux`:

```
http.ServeMux
├── /api/v1/agents/ws  →  wsRouter  (gin.New, no middleware)
└── /                  →  apiRouter (gin.New + full middleware stack)
```

**Reason:** The WebSocket upgrade handshake is sensitive to middleware interference. Using a clean router for the WebSocket path guarantees the upgrade always succeeds regardless of future middleware additions to the main router.

### 4.2 Middleware Stack (apiRouter)

Applied in order on the main API router:

1. `RequestIDMiddleware` — propagates or generates `X-Request-ID`.
2. `DatabaseLogger.GinMiddleware` — records every request to the `logs` table (non-auth routes).
3. `RateLimiter` — global in-process rate limiter (production should use Redis).
4. `SecurityHeaders` — sets HSTS, CSP, X-Frame-Options, etc.
5. `ComplianceLogging` — SOC2/GDPR request/response metadata capture.
6. `gin.Logger` — stdout request log.
7. `gin.Recovery` — panic recovery.

### 4.3 Route Groups

```
/swagger/*any          — Swagger UI (public)
/health                — Health check (public)
/api/v1/               — StrictCORSMiddleware
    public/agents/...  — No auth required (shared chat)
    google-oauth/...   — Public OAuth callback
    (+ Auth middleware)
    /auth/...
    /organizations/...
    /invitations/...
    /secrets/...
    /agents/...
    /workflow-template/n8n/...
    /credits/...
    /logs/...
    /assets/...
    /todos/...
    /analytics/...
/api/v1/agents/ws      — WebSocket (isolated router, JWT in first message)
```

---

## 5. Domain Service Design

Each domain (`auth`, `organization`, `credential`, etc.) follows the same pattern:

```
api/<domain>/
  router.go   — SetupRoutes() registers handlers on a RouterGroup
  service.go  — Struct with DB reference; methods are handler functions
```

Handler methods are attached to a service struct that holds a `*database.DB` reference. There are no separate repository/service layers — the handler is also the service method. This keeps the codebase flat and approachable.

### 5.1 Authentication Service

- Reads/writes the `users` table via GORM.
- Hashes passwords with `bcrypt` (cost factor from standard library default).
- Issues JWTs with claims: `user_id`, `role`, `exp`.
- Uses `services.EmailService` to send verification and password-reset emails.
- Google OAuth state is persisted in `oauth_states` and `oauth_popup_tokens` tables.

### 5.2 Organization Service

- Creates organizations and automatically creates a `user_organizations` record for the creator as `admin`.
- Enforces role-based access: only `admin` can update, delete, add/remove members, manage business profile and invitations.
- `InvitationService` handles the invite lifecycle: create → resend → accept/cancel → expire.
- Accepted invitations create a `user_organizations` record for the invitee.

### 5.3 Credential Service

- Encrypts secret values using `services.AESEncrypt` (AES-256-GCM) before storage.
- Decrypts on read using `services.AESDecrypt`.
- Scoping logic: secrets belong to either a user (personal) or an organization; both can coexist for the same `app/name` key because the unique constraint is `(app, name, organization_id)`.
- Shopify OAuth flow: redirect → callback → store access token as a secret.

### 5.4 Agent Service

The agent domain is the most complex. It manages:

**RabbitMQ integration:**
- `InitializeRabbitMQ()` connects at startup and creates the `agent_requests` queue.
- `createAgentChatRequest()` publishes a message to the queue and stores a `ChatRequest` row.
- The AI Engine consumes messages, processes them, and publishes results back.

**WebSocket manager:**
- `WSManager` holds a map of active connections keyed by connection ID.
- Each connection has a buffered `Send` channel. A goroutine per connection drains this channel.
- The AI Engine pushes responses via the backend's `/api/v1/agents/ws` route back to the correct user connection.
- Authentication happens in the first WebSocket message (JWT payload), not via HTTP headers (browser WebSocket API limitation).

**Custom agents:**
- Agent definitions are persisted in the database.
- Tool call history is tracked per agent.

### 5.5 Policy (Credits) Service

- On first use, bootstraps a `credit_accounts` row for the owner (user or org).
- Reads plan rules from `plan_definitions.json` (seeded into `plans` table).
- `ConsumeCredits(ownerType, ownerID, actionKey, modelName)` checks entitlements, calculates cost, deducts from account, and writes a `credit_records` row.
- A background scheduler (`StartCycleResetScheduler`) resets credit cycles at the end of each billing period.

### 5.6 Asset Service

- Accepts multipart file uploads.
- Uploads file bytes to Cloudinary via `services.CloudinaryService`.
- Persists metadata (URL, MIME type, size, category, tags) to the `assets` table.
- Supports org-scoped and user-scoped assets.

### 5.7 Log Service

- `DatabaseLogger` is injected as Gin middleware on the main router.
- After each response, it writes a `Log` row with HTTP metadata.
- Auth endpoints are excluded from automatic middleware logging; instead the auth service writes logs directly with an `auth_result` field.
- Background `StartCleanupScheduler` periodically purges old log rows.

---

## 6. Database Layer

### 6.1 Connection Management

`database.Initialize(cfg)` opens a GORM connection, runs a connectivity ping, then invokes Goose migrations from `database/migrations/`. The returned `*database.DB` wraps both the GORM DB and the underlying `*sql.DB`.

### 6.2 Migration Strategy

- All schema changes live in `database/migrations/` as numbered SQL files (`001_...sql`, `002_...sql`, …).
- Goose tracks applied migrations in the `goose_db_version` table.
- Migrations are applied automatically on every server start (`goose.Up`).
- Each migration file contains `-- +goose Up` and `-- +goose Down` sections.

### 6.3 ORM Usage

- GORM is used for all CRUD operations; raw SQL is used only in background cleanup goroutines.
- Soft deletes are implemented via `gorm.DeletedAt` on `users`, `organizations`, `assets`, and `todos`.
- JSONB columns use custom `Value()`/`Scan()` implementations or `json.RawMessage`.

---

## 7. Security Design

### 7.1 Authentication Flow

```
Client → POST /api/v1/auth/login
  → Auth middleware: skipped (public route)
  → AuthService.Login():
      1. Look up user by email
      2. bcrypt.CompareHashAndPassword
      3. Issue JWT {user_id, role, exp}
      4. Return {access_token, refresh_token, user}
```

### 7.2 JWT Validation

The `Auth` middleware in `middleware.go`:
1. Extracts `Authorization: Bearer <token>`.
2. Parses with `golang-jwt/jwt` using the configured `JWT_SECRET`.
3. Validates UUID format of `user_id` claim.
4. Sets `user_id` and `user_role` in the Gin context for downstream handlers.

### 7.3 Secret Encryption

```go
// Encrypt
ciphertext, iv, err = AESEncrypt(plaintextBytes, encryptionKey)

// Decrypt
plaintext, err = AESDecrypt(ciphertext, iv, encryptionKey)
```

AES-256-GCM is used with a random 96-bit nonce (IV) per encryption. Both the ciphertext and IV are stored. The encryption key is sourced from `ENCRYPTION_KEY` environment variable (must be 32 bytes).

### 7.4 CORS

`StrictCORSMiddleware` uses gin-contrib/cors with an `AllowOriginFunc` that checks normalized origins against a runtime-built allowlist. The allowlist merges `CORS_ALLOWED_ORIGINS` and `FRONTEND_URL`.

---

## 8. Background Processes

| Process | Location | Interval | Purpose |
|---|---|---|---|
| Unverified user cleanup | `main.go:startUnverifiedUserCleanup` | 1 minute | Delete users with `email_verified=false` created > 1 min ago |
| Log cleanup | `services/logger.go:StartCleanupScheduler` | Configurable | Purge old log rows |
| Credit cycle reset | `services/policy:StartCycleResetScheduler` | Cycle boundary | Reset `credits_consumed` and advance `cycle_start/cycle_end` |
| Scheduled agent tasks | `api/todo:StartScheduledAgentWorker` | Polling | Execute agent tasks whose `scheduled_at` has passed |

---

## 9. Inter-Service Communication

### 9.1 Backend → AI Engine (REST)

The AI Engine URL is configured via `AI_ENGINE_URL`. The agents service makes HTTP calls to the AI Engine for certain operations (tool listing, agent management).

### 9.2 Backend → AI Engine (RabbitMQ)

Chat requests are published to the `agent_requests` AMQP queue. Message payload is JSON containing the user's chat request and metadata. The AI Engine consumes the queue asynchronously.

### 9.3 AI Engine → Client (WebSocket via Backend)

The AI Engine delivers responses by calling back into the backend, which routes them to the correct WebSocket connection via the `WSManager` in-memory map.

### 9.4 Backend → Cloudinary (HTTP)

The `CloudinaryService` wraps the Cloudinary Go SDK. Files are uploaded as byte streams; the SDK returns a secure URL and public ID.

### 9.5 Backend → Brevo (HTTP)

The `EmailService` wraps the Brevo (Sendinblue) API v3 Go library for sending transactional emails (verification, password reset, invitations).

---

## 10. Error Handling Conventions

- HTTP handlers return `gin.H{"error": "<message>"}` with an appropriate HTTP status code.
- GORM `ErrRecordNotFound` is mapped to `404 Not Found`.
- Validation failures return `400 Bad Request`.
- Unauthorized access returns `401 Unauthorized` or `403 Forbidden`.
- Internal errors return `500 Internal Server Error` with a generic message (detail is logged server-side).
- Panics are caught by Gin's `Recovery` middleware and return `500`.
