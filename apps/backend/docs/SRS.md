# Software Requirements Specification (SRS)
## Ignitic AI — Backend API
**Version:** 1.0  
**Status:** Active  

---

## 1. Introduction

### 1.1 Purpose

This document specifies the functional and non-functional requirements for the Ignitic AI Backend API — the Go-based service that provides authentication, multi-tenant organization management, encrypted credential storage, AI agent relay, asset management, analytics, credits/billing, and audit logging for the Ignitic AI platform.

### 1.2 Scope

The Backend API is one component of the Ignitic AI platform. It interacts with:

- A Next.js frontend SPA (via REST and WebSocket).
- A FastAPI + LangGraph AI Engine (via HTTP and RabbitMQ).
- An MCP Server (tool exposure layer for LLMs).
- Third-party services: Cloudinary (assets), Brevo (email), Google OAuth, Shopify OAuth, AWS ECS/ECR (hosting).

This document covers only the backend API service. Requirements for the AI Engine, MCP Server, frontend, and third-party services are out of scope.

### 1.3 Definitions

| Term | Definition |
|---|---|
| **Organization** | A multi-member workspace that groups users, secrets, assets, and todos |
| **Secret / Credential** | An encrypted third-party API key or OAuth token stored on behalf of a user or organization |
| **Agent** | An AI workflow instance in the AI Engine, addressable from the backend |
| **Chat** | A session of messages between a user and one or more agents |
| **Credit** | A unit of platform resource consumption; deducted per action based on plan rules |
| **Plan** | A subscription tier (starter, pro, business) with credit allocations and feature entitlements |
| **Workflow Template** | An importable n8n workflow JSON stored in the platform |
| **Todo** | A tracked task item, optionally associated with an agent task |
| **Asset** | A file (image, document, report) stored in Cloudinary and indexed in the database |
| **JWT** | JSON Web Token used for stateless user authentication |

---

## 2. Overall Description

### 2.1 Product Perspective

The backend is a stateless REST + WebSocket API server that acts as the SaaS layer of the Ignitic AI platform. It sits between the browser frontend and the AI Engine, providing authentication, data persistence, and access control.

### 2.2 User Classes

| User Class | Description |
|---|---|
| **End User** | Individual account holder who can use agents, manage todos, upload assets, and store credentials |
| **Organization Admin** | User who created an organization; has full admin access to org resources and members |
| **Organization Member** | User who has accepted an invitation; has read/write access to org-scoped resources |
| **Organization Viewer** | User with read-only access to org-scoped resources |
| **System / Scheduler** | Internal background processes (cleanup, cycle reset, scheduled agent tasks) |

### 2.3 Operating Environment

- **Runtime:** Docker container on AWS ECS (Fargate or EC2 launch type)
- **Database:** AWS RDS PostgreSQL
- **Message Broker:** RabbitMQ (self-hosted or managed)
- **Asset CDN:** Cloudinary
- **Email:** Brevo
- **OS:** Linux (Alpine-based Docker image)

### 2.4 Design and Implementation Constraints

- Must not store plaintext secrets — all credential values must be AES-256-GCM encrypted at rest.
- JWT tokens must be validated on every authenticated request.
- Unverified user accounts are automatically deleted after 1 minute.
- The WebSocket endpoint must be isolated from the main middleware stack to prevent interference with the WebSocket upgrade handshake.
- Database schema changes are managed exclusively through versioned Goose SQL migration files.

---

## 3. Functional Requirements

### 3.1 Authentication (AUTH)

| ID | Requirement |
|---|---|
| AUTH-01 | The system shall allow new users to register with email, password, first name, and last name. |
| AUTH-02 | Passwords shall be hashed with bcrypt before storage. |
| AUTH-03 | A verification email shall be sent upon registration. |
| AUTH-04 | Users with unverified email shall be deleted after 1 minute. |
| AUTH-05 | The system shall issue a JWT access token and refresh token on successful login. |
| AUTH-06 | The system shall validate email and password on login and return 401 on failure. |
| AUTH-07 | The system shall support JWT token refresh without re-authentication. |
| AUTH-08 | The system shall support logout by invalidating server-side session context. |
| AUTH-09 | Users shall be able to update their profile (name, phone, company). |
| AUTH-10 | Users shall be able to change their password when authenticated. |
| AUTH-11 | The system shall support a forgot-password flow that emails a time-limited reset token. |
| AUTH-12 | Users shall be able to reset their password using a valid reset token. |
| AUTH-13 | The system shall support Google OAuth 2.0 login (popup and redirect flows). |
| AUTH-14 | Users shall be able to save onboarding personal preferences. |

### 3.2 Organization Management (ORGS)

| ID | Requirement |
|---|---|
| ORG-01 | Authenticated users shall be able to create an organization and become its admin. |
| ORG-02 | Users shall be able to list, get, update, and delete organizations they belong to (admin only for update/delete). |
| ORG-03 | Users shall be able to join an organization and leave an organization. |
| ORG-04 | Admins shall be able to add, remove, and update the role of organization members. |
| ORG-05 | Admins shall be able to invite users by email with a specified role. |
| ORG-06 | Invitations shall expire after a configurable period. |
| ORG-07 | Invited users shall be able to accept invitations. |
| ORG-08 | Admins shall be able to cancel and resend invitations. |
| ORG-09 | Each organization shall support an optional business profile (hours, markets, channels, contacts, platforms). |
| ORG-10 | Business profiles shall be createable, updatable, retrievable, and deletable by organization admins. |

### 3.3 Credential / Secret Management (SECRETS)

| ID | Requirement |
|---|---|
| SEC-01 | Users shall be able to store encrypted secrets scoped to an app name and key name. |
| SEC-02 | Secrets shall be encrypted with AES-256-GCM before database persistence. |
| SEC-03 | Users shall be able to retrieve a decrypted secret value. |
| SEC-04 | Users shall be able to delete individual secrets. |
| SEC-05 | Users shall be able to bulk upsert all secrets for an app. |
| SEC-06 | Users shall be able to bulk delete all secrets for an app. |
| SEC-07 | Users shall be able to list all their personal secrets. |
| SEC-08 | Users shall be able to list all secrets scoped to an organization. |
| SEC-09 | Users shall be able to share personal app secrets to an organization scope. |
| SEC-10 | The system shall support Shopify OAuth to automatically store OAuth tokens as secrets. |

### 3.4 AI Agent Relay (AGENTS)

| ID | Requirement |
|---|---|
| AGT-01 | Authenticated users shall be able to submit a chat message to the agent system. |
| AGT-02 | Chat requests shall be queued via RabbitMQ to the AI Engine. |
| AGT-03 | Users shall be able to poll the status of a chat request by request ID. |
| AGT-04 | The system shall expose a WebSocket endpoint for real-time agent response streaming. |
| AGT-05 | WebSocket connections shall be authenticated via a JWT passed in the first message. |
| AGT-06 | The system shall support creating, listing, updating, and deleting custom agents. |
| AGT-07 | Users shall be able to list and retrieve chat sessions. |
| AGT-08 | Users shall be able to retrieve messages within a chat session. |
| AGT-09 | Users shall be able to share a chat session via a public token. |
| AGT-10 | Public shared chats shall be accessible without authentication. |
| AGT-11 | The system shall expose available agent tools for frontend display. |
| AGT-12 | The system shall expose per-agent tool call history. |
| AGT-13 | Each chat request shall be subject to credit policy enforcement. |

### 3.5 Asset Management (ASSETS)

| ID | Requirement |
|---|---|
| AST-01 | Authenticated users shall be able to upload files to Cloudinary. |
| AST-02 | Assets shall be categorized (business_profile, brand_assets, marketing_assets, analytics_reports, policy_documents, media_documents). |
| AST-03 | Assets shall be scoped to either a user or an organization. |
| AST-04 | Users shall be able to list, retrieve, update, and delete their assets. |
| AST-05 | The system shall return available asset categories. |

### 3.6 Credits & Billing (CREDITS)

| ID | Requirement |
|---|---|
| CRD-01 | Every user and organization shall have a credit account created automatically on first use. |
| CRD-02 | Credit accounts shall be associated with a subscription plan (starter, pro, business). |
| CRD-03 | The system shall deduct credits per configurable action costs defined in the plan. |
| CRD-04 | Users shall be able to view their credits overview (total, consumed, available, cycle dates). |
| CRD-05 | Users shall be able to view their credit transaction records with pagination. |
| CRD-06 | Users shall be able to view their feature entitlements for the current plan. |
| CRD-07 | Credit cycles shall be automatically reset on a scheduled basis. |

### 3.7 Audit Logging (LOGS)

| ID | Requirement |
|---|---|
| LOG-01 | Every API request (except auth endpoints) shall be logged to the `logs` table with method, endpoint, status code, response time, IP, and request ID. |
| LOG-02 | Auth events shall log success or failure with an `auth_result` field. |
| LOG-03 | Logs shall be classified by section (AUTH, ASSETS, SECRETS, AGENTS, ORGANIZATIONS, USERS, API, SYSTEM). |
| LOG-04 | Users shall be able to list logs with filters (section, level, user_id, organization_id). |
| LOG-05 | Users shall be able to list distinct log sections. |
| LOG-06 | Old logs shall be periodically cleaned up by a background scheduler. |

### 3.8 Workflow Templates (WORKFLOWS)

| ID | Requirement |
|---|---|
| WF-01 | Users shall be able to import n8n workflow templates from JSON. |
| WF-02 | Users shall be able to list, retrieve, and delete workflow templates. |

### 3.9 Todo / Task Management (TODOS)

| ID | Requirement |
|---|---|
| TODO-01 | Users shall be able to create, read, update, and delete todos. |
| TODO-02 | Todos shall support priority (high, medium, low), status (todo, in_progress, done), and progress (0–100). |
| TODO-03 | Progress reaching 100 shall automatically set status to done. |
| TODO-04 | Todos shall support optional scheduling (scheduled_at, due_date). |
| TODO-05 | Users shall be able to filter todos by status or priority. |
| TODO-06 | Todos shall support agent task association (agent_name, agent_task_id, agent_config). |
| TODO-07 | Users shall be able to schedule agent tasks from a todo. |
| TODO-08 | The system shall be able to suggest todos using AI based on a user-provided goal. |
| TODO-09 | Only the creator of a personal todo shall be able to read, update, or delete it. |

### 3.10 Analytics (ANALYTICS)

| ID | Requirement |
|---|---|
| ANL-01 | Users shall be able to retrieve agent run history. |
| ANL-02 | Users shall be able to retrieve agent usage metrics. |
| ANL-03 | Users shall be able to retrieve tool execution history. |
| ANL-04 | Users shall be able to retrieve a specific tool execution by ID. |

---

## 4. Non-Functional Requirements

### 4.1 Security

| ID | Requirement |
|---|---|
| SEC-NF-01 | All API endpoints except public routes shall require a valid JWT in the `Authorization: Bearer` header. |
| SEC-NF-02 | Passwords shall never be stored or returned in plaintext. |
| SEC-NF-03 | All secret values shall be encrypted at rest using AES-256-GCM. |
| SEC-NF-04 | Security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS, CSP, Referrer-Policy) shall be set on all responses. |
| SEC-NF-05 | CORS shall be enforced using an explicit origin allowlist. |
| SEC-NF-06 | Rate limiting shall be applied globally (configurable RPS, default 100). |
| SEC-NF-07 | JWT secrets and encryption keys shall be configurable via environment variables and never hardcoded in production. |
| SEC-NF-08 | The container shall run as a non-root user (`appuser`). |

### 4.2 Performance

| ID | Requirement |
|---|---|
| PERF-01 | The health endpoint shall respond within 50 ms under normal load. |
| PERF-02 | Authentication endpoints shall complete within 500 ms under normal load. |
| PERF-03 | Database queries shall use indexed columns for all filter and join operations. |
| PERF-04 | The application shall support at least 100 concurrent REST requests without degradation. |

### 4.3 Reliability

| ID | Requirement |
|---|---|
| REL-01 | If RabbitMQ is unavailable at startup, the server shall still start and retry on first use. |
| REL-02 | Database migrations shall be idempotent and applied automatically on startup. |
| REL-03 | Panics in HTTP handlers shall be recovered by Gin's Recovery middleware. |

### 4.4 Scalability

| ID | Requirement |
|---|---|
| SCA-01 | The service shall be stateless so that multiple instances can run behind a load balancer. |
| SCA-02 | Session state shall not be stored in application memory. |

### 4.5 Compliance

| ID | Requirement |
|---|---|
| COMP-01 | The compliance logging middleware shall record all request/response metadata for SOC2/GDPR audit trails. |
| COMP-02 | Deleted user records shall use soft deletes with timestamps to preserve audit history. |
| COMP-03 | The backend compliance mode shall be configurable (`BACKEND_COMPLIANCE_MODE`, default `SOC2_GDPR`). |

### 4.6 Maintainability

| ID | Requirement |
|---|---|
| MNT-01 | All configuration values shall be sourced from environment variables with documented defaults. |
| MNT-02 | Database schema changes shall use numbered Goose SQL migration files. |
| MNT-03 | All API endpoints shall be documented with Swagger annotations. |
| MNT-04 | The codebase shall include unit, integration, system, and non-functional tests. |
