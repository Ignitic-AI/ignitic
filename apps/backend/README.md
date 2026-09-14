# Ignitic AI — Backend API

The **Backend API** is the SaaS core of the Ignitic AI platform — a real-time e-commerce automation system that uses AI agents to replace traditional sequential workflow labor. Built with Go and Gin, it handles authentication, multi-tenant organization management, encrypted credential storage, AI agent relay, asset management, credits/billing, analytics, and audit logging.

> **Part of the Ignitic AI platform:**
> Frontend SPA (Next.js) → **Backend API (this repo)** → AI Engine (FastAPI + LangGraph) → MCP Server

---

## Documentation

| Document | Description |
|---|---|
| [Introduction](docs/introduction.md) | Project background, architecture overview, and technology choices |
| [SRS](docs/SRS.md) | Software Requirements Specification — functional and non-functional requirements |
| [SDS](docs/SDS.md) | Software Design Specification — package structure, service design, patterns |
| [Database Schema](docs/database-schema.md) | All tables, columns, indexes, and migration history |
| [API Reference](docs/api-reference.md) | Complete endpoint documentation with request/response examples |
| [Testing Guide](docs/testing.md) | How to run tests, test layers, coverage summary |
| [Deployment & CI/CD](docs/deployment.md) | AWS ECS deployment, Docker build, GitHub Actions, environment variables |

Interactive API documentation (Swagger UI) is available at `/swagger/index.html` when the server is running.

---

## Technology Stack

| Concern | Technology |
|---|---|
| Language | Go 1.23 |
| HTTP framework | Gin |
| Database | PostgreSQL + GORM ORM |
| Migrations | Goose (SQL-first) |
| Auth | JWT (golang-jwt/jwt v5) + bcrypt |
| Secret encryption | AES-256-GCM |
| Message queue | RabbitMQ (amqp091-go) |
| WebSocket | gorilla/websocket |
| File storage | Cloudinary |
| Email | Brevo (Sendinblue) |
| Containerisation | Docker (multi-stage) |
| Deployment | AWS ECS + ECR |
| CI/CD | GitHub Actions |

---

## Repository Structure

```
backend/
├── main.go                          # Entry point
├── config.go                        # Environment-driven configuration
├── middleware.go                    # JWT auth, rate limiting, security headers
├── api/                             # HTTP handler packages (one per domain)
│   ├── agents/                      # AI agent relay, WebSocket, chat sessions
│   ├── analytics/                   # Agent and tool analytics
│   ├── asset/                       # File upload and asset management
│   ├── auth/                        # Registration, login, profile, password
│   ├── credential/                  # Encrypted secret storage + OAuth
│   │   └── google_oauth/            # Google OAuth flow
│   ├── credits/                     # Credit accounts and billing
│   ├── logs/                        # Audit log queries
│   ├── organization/                # Orgs, members, invitations, profiles
│   ├── todo/                        # Tasks and agent scheduling
│   └── workflow/                    # n8n workflow templates
├── corsorigin/                      # Origin normalization
├── database/
│   ├── database.go                  # GORM init + migration runner
│   └── migrations/                  # Numbered Goose SQL migrations (022 files)
├── models/                          # GORM model structs
├── services/
│   ├── cloudinary.go                # Cloudinary upload wrapper
│   ├── email.go                     # Brevo transactional email
│   ├── encryption.go                # AES-256-GCM helpers
│   ├── logger.go                    # Database-backed request logger
│   └── policy/                      # Credit policy enforcement + plan rules
├── docs/                            # Project documentation + Swagger JSON/YAML
└── tests/
    ├── unit/                        # Isolated handler and model tests
    ├── integration/                 # Multi-module DB-backed tests
    ├── system/                      # End-to-end workflow tests
    └── nonfunctional/               # Benchmarks and security tests
```

---

## API Summary

All authenticated routes require `Authorization: Bearer <JWT>`.

| Module | Base Path | Key Operations |
|---|---|---|
| Health | `/health` | Service status |
| Auth | `/api/v1/auth` | Register, login, refresh, profile, password reset, Google OAuth |
| Organizations | `/api/v1/organizations` | CRUD, members, invitations, business profile |
| Secrets | `/api/v1/secrets` | Encrypted credential CRUD, bulk ops, Shopify OAuth |
| Agents | `/api/v1/agents` | Chat, custom agents, tool calls, chat history |
| Agents WS | `/api/v1/agents/ws` | Real-time streaming via WebSocket |
| Workflows | `/api/v1/workflow-template/n8n` | Import and manage n8n workflow templates |
| Credits | `/api/v1/credits` | Overview, transaction records, entitlements |
| Logs | `/api/v1/logs` | Audit log queries and section listing |
| Assets | `/api/v1/assets` | File upload, categorize, manage |
| Todos | `/api/v1/todos` | Task CRUD, status/priority filtering, agent scheduling |
| Analytics | `/api/v1/analytics` | Agent runs, usage metrics, tool executions |

See [docs/api-reference.md](docs/api-reference.md) for the full endpoint reference.

---

## Running Locally

**Prerequisites:** Go 1.23+, PostgreSQL 14+

1. Copy and configure environment variables:
   ```bash
   cp env.example .env
   # Edit .env with your local database and service credentials
   ```

2. (Optional) Start RabbitMQ for agent chat:
   ```bash
   ./start-rabbitmq.sh
   ```

3. Start the server:
   ```bash
   go run *.go
   ```

4. The server starts on `http://localhost:8080`.
   Swagger UI: `http://localhost:8080/swagger/index.html`

Database migrations run automatically on startup.

---

## Testing

The test suite uses an in-memory SQLite harness — no running database is required.

```bash
# Run all tests
GOCACHE=/tmp/codex-gocache go test ./tests/...

# Run with verbose output
GOCACHE=/tmp/codex-gocache go test -v ./tests/...

# Run benchmarks
GOCACHE=/tmp/codex-gocache go test ./tests/nonfunctional -bench . -benchmem
```

See [docs/testing.md](docs/testing.md) for the full testing guide.

---

## Deployment

Deployments trigger automatically on push to the `prod` branch via GitHub Actions:

1. Build Docker image for `linux/amd64`.
2. Push image to AWS ECR.
3. Force ECS service redeployment (rolling update).

See [docs/deployment.md](docs/deployment.md) for full deployment, infrastructure, and environment variable documentation.

---

## Security

- JWT-based stateless authentication on all protected routes.
- bcrypt password hashing (never stored or returned in plaintext).
- AES-256-GCM encryption for all stored credentials.
- CORS enforced via explicit origin allowlist.
- Security headers on all responses: HSTS, CSP, X-Frame-Options, X-XSS-Protection.
- Non-root Docker container user.
- SOC2/GDPR compliance logging middleware.

---

**Built with Go + Gin · Deployed on AWS ECS · Part of the Ignitic AI Platform**
