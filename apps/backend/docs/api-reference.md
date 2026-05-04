# API Reference
## Ignitic AI — Backend API
**Base URL:** `http://localhost:8080` (development) | `https://<production-domain>` (production)  
**API Version:** `v1`  
**Auth:** `Authorization: Bearer <JWT>` required on all routes except those marked **public**.

Interactive documentation is also available at `/swagger/index.html` when the server is running.

---

## Health

### `GET /health` — public

Returns service health status.

**Response 200**
```json
{
  "service": "backend",
  "status": "healthy",
  "version": "1.0.0"
}
```

---

## Authentication — `/api/v1/auth`

### `POST /api/v1/auth/register` — public

Register a new user account.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "first_name": "Jane",
  "last_name": "Doe"
}
```

**Response 201** — User created; verification email sent.

**Response 409** — Email already registered.

---

### `POST /api/v1/auth/verify-email` — public

Verify the user's email address.

**Request body**
```json
{ "token": "<verification_token>" }
```

**Response 200** — Email verified. Returns `message`, `token` (same JWT shape as login), and `user` (`id`, `email`, `first_name`, `last_name`, `role`).

**Response 200** (already verified) — `{"message":"Email already verified"}` with no `token` (sign in with password instead).

---

### `POST /api/v1/auth/login` — public

Authenticate and receive tokens.

**Request body**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response 200**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "user": { "id": "uuid", "email": "...", "first_name": "Jane", ... }
}
```

**Response 401** — Invalid credentials.

---

### `POST /api/v1/auth/refresh` — public

Refresh the JWT access token.

**Request body**
```json
{ "refresh_token": "eyJ..." }
```

**Response 200**
```json
{ "access_token": "eyJ..." }
```

---

### `POST /api/v1/auth/logout` ★

Logout the current session.

**Response 200**

---

### `GET /api/v1/auth/profile` ★

Get the authenticated user's profile.

**Response 200**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "",
  "company": "",
  "role": "user",
  "organization_id": null,
  "email_verified": true
}
```

---

### `PUT /api/v1/auth/profile` ★

Update the authenticated user's profile.

**Request body** (all fields optional)
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "+1234567890",
  "company": "Acme Inc."
}
```

**Response 200** — Updated user object.

---

### `POST /api/v1/auth/onboarding/personal` ★

Save personal onboarding preferences.

**Request body** — arbitrary JSON object stored as JSONB.

**Response 200**

---

### `POST /api/v1/auth/change-password` ★

Change the current user's password.

**Request body**
```json
{
  "current_password": "OldPass!",
  "new_password": "NewPass!"
}
```

**Response 200**

---

### `POST /api/v1/auth/forgot-password` — public

Initiate password reset; sends reset email.

**Request body**
```json
{ "email": "user@example.com" }
```

**Response 200** — Always returns 200 to prevent email enumeration.

---

### `POST /api/v1/auth/reset-password` — public

Reset password using a reset token.

**Request body**
```json
{
  "token": "<reset_token>",
  "new_password": "NewPass!"
}
```

**Response 200**

---

## Organizations — `/api/v1/organizations`

All routes require authentication (★).

### `POST /api/v1/organizations` ★

Create a new organization. The authenticated user becomes the admin.

**Request body**
```json
{
  "name": "Acme Store",
  "description": "Our e-commerce org",
  "employee_count": 5,
  "industry": "Retail",
  "country": "US"
}
```

**Response 201** — Organization object.

---

### `GET /api/v1/organizations` ★

List all organizations the current user belongs to.

**Response 200** — Array of organization objects.

---

### `GET /api/v1/organizations/:id` ★

Get a specific organization by ID.

**Response 200** — Organization object.

---

### `PUT /api/v1/organizations/:id` ★ (admin only)

Update organization details.

**Response 200** — Updated organization object.

---

### `DELETE /api/v1/organizations/:id` ★ (admin only)

Delete an organization.

**Response 200**

---

### `POST /api/v1/organizations/:id/join` ★

Join an organization.

**Response 200**

---

### `POST /api/v1/organizations/:id/leave` ★

Leave an organization.

**Response 200**

---

### `GET /api/v1/organizations/:id/members` ★

List organization members.

**Response 200** — Array of `{user, role, joined_at}` objects.

---

### `POST /api/v1/organizations/:id/members` ★ (admin only)

Add a member to the organization.

**Request body**
```json
{ "user_id": "uuid", "role": "member" }
```

---

### `DELETE /api/v1/organizations/:id/members/:memberId` ★ (admin only)

Remove a member.

---

### `PUT /api/v1/organizations/:id/members/:memberId/role` ★ (admin only)

Update a member's role.

**Request body**
```json
{ "role": "viewer" }
```

---

### `POST /api/v1/organizations/:id/invite` ★ (admin only)

Invite a user by email.

**Request body**
```json
{ "email": "invite@example.com", "role": "member" }
```

---

### `GET /api/v1/organizations/:id/invitations` ★ (admin only)

List pending invitations for an organization.

---

### `DELETE /api/v1/organizations/:id/invitations/:invitationId` ★ (admin only)

Cancel a pending invitation.

---

### `POST /api/v1/organizations/:id/invitations/:invitationId/resend` ★ (admin only)

Resend an invitation email.

---

### `POST /api/v1/invitations/:id/accept` ★

Accept an invitation by invitation ID.

---

### `PUT /api/v1/organizations/:id/business-profile` ★ (admin only)

Create or update the organization's business profile.

---

### `GET /api/v1/organizations/:id/business-profile` ★

Get the organization's business profile.

---

### `DELETE /api/v1/organizations/:id/business-profile` ★ (admin only)

Delete the organization's business profile.

---

## Secrets / Credentials — `/api/v1/secrets`

All routes require authentication (★).

### `PUT /api/v1/secrets/:app/:name` ★

Create or update a secret.

**Request body**
```json
{
  "value": "sk_live_abc123",
  "description": "Shopify Admin API key",
  "organization_id": "uuid-optional"
}
```

---

### `GET /api/v1/secrets/:app/:name` ★

Retrieve a specific secret (returns decrypted value).

---

### `DELETE /api/v1/secrets/:app/:name` ★

Delete a specific secret.

---

### `GET /api/v1/secrets/:app/values` ★

List all secrets for an app with decrypted values.

---

### `PUT /api/v1/secrets/:app` ★

Bulk upsert all secrets for an app.

**Request body**
```json
{
  "secrets": [
    { "name": "api_key", "value": "...", "description": "..." }
  ],
  "organization_id": "uuid-optional"
}
```

---

### `DELETE /api/v1/secrets/:app` ★

Bulk delete all secrets for an app.

---

### `GET /api/v1/secrets/user/all` ★

List all personal secrets for the current user.

---

### `GET /api/v1/secrets/organization/:orgId` ★

List all secrets scoped to an organization.

---

### `POST /api/v1/secrets/:app/share-to-organization` ★

Copy personal app secrets into organization scope.

---

### `GET /api/v1/secrets/oauth/shopify/authorize` ★

Initiate Shopify OAuth authorization flow. Returns redirect URL.

---

### `GET /api/v1/secrets/oauth/shopify/callback` — public

Shopify OAuth callback. Stores access token as a secret.

---

### `GET /api/v1/secrets/oauth/shopify/status` ★

Check Shopify OAuth connection status.

---

### `DELETE /api/v1/secrets/oauth/shopify/disconnect` ★

Disconnect Shopify OAuth integration.

---

## Google OAuth — `/api/v1/google-oauth`

### `GET /api/v1/google-oauth/authorize` ★

Initiate Google OAuth flow. Returns the Google authorization URL.

---

### `GET /api/v1/google-oauth/callback` — public

Google OAuth callback. Exchanges code for tokens and stores them.

---

### `GET /api/v1/google-oauth/popup-token` ★

Retrieve the popup OAuth completion token.

---

### `POST /api/v1/google-oauth/logout` ★

Revoke Google OAuth tokens.

---

## AI Agents — `/api/v1/agents`

### `POST /api/v1/agents/chat` ★

Submit a chat request to the agent system (queued via RabbitMQ).

**Request body**
```json
{
  "message": "What are my top-selling products this month?",
  "agent_id": "uuid-optional",
  "organization_id": "uuid-optional",
  "chat_id": "uuid-optional"
}
```

**Response 202**
```json
{ "request_id": "uuid", "status": "queued" }
```

---

### `GET /api/v1/agents/chat/:request_id` ★

Poll the status of a chat request.

**Response 200**
```json
{
  "request_id": "uuid",
  "status": "completed",
  "response": "Your top products are..."
}
```

---

### `GET /api/v1/agents/status` ★

Get agent system status (RabbitMQ health, queue info).

---

### `GET /api/v1/agents/queues` ★

Get queue sizes and information.

---

### `GET /api/v1/agents/available-tools` ★

List available tools for custom agents.

---

### `POST /api/v1/agents/` ★

Create a custom agent.

**Request body**
```json
{
  "name": "My Sales Agent",
  "description": "Handles sales queries",
  "tools": ["shopify_orders", "email_sender"],
  "organization_id": "uuid"
}
```

---

### `GET /api/v1/agents/` ★

List all custom agents for the current user/organization.

---

### `GET /api/v1/agents/:agent/get-agent` ★

Get a specific agent by name/ID.

---

### `PUT /api/v1/agents/:agent/update-agent` ★

Update a custom agent.

---

### `DELETE /api/v1/agents/:agent` ★

Delete a custom agent.

---

### `GET /api/v1/agents/:agent/tools` ★

List tools assigned to a specific agent.

---

### `GET /api/v1/agents/:agent/tool-calls` ★

List tool call history for a specific agent.

---

### `GET /api/v1/agents/chats` ★

List chat sessions for the current user.

---

### `GET /api/v1/agents/chats/:chat_id` ★

Get a specific chat session.

---

### `GET /api/v1/agents/chats/:chat_id/messages` ★

Get messages within a chat session.

---

### `POST /api/v1/agents/chats/:chat_id/share` ★

Create a public share token for a chat session.

**Response 200**
```json
{ "token": "share_abc123", "url": "https://..." }
```

---

### `DELETE /api/v1/agents/chats/:chat_id` ★

Delete a chat session.

---

### `GET /api/v1/public/agents/chats/shared/:token` — public

Access a shared chat session by token.

---

### `WS /api/v1/agents/ws` — WebSocket

Real-time agent response streaming. Authentication is performed via JWT in the first message payload.

**First message (client → server)**
```json
{ "type": "auth", "token": "eyJ..." }
```

**Streamed responses (server → client)**
```json
{ "type": "message", "request_id": "uuid", "content": "...", "done": false }
```

---

## Workflow Templates — `/api/v1/workflow-template/n8n`

### `POST /api/v1/workflow-template/n8n/import` ★

Import an n8n workflow from a JSON payload.

**Request body** — n8n workflow JSON export object.

---

### `GET /api/v1/workflow-template/n8n/` ★

List all workflow templates.

---

### `GET /api/v1/workflow-template/n8n/:id` ★

Get a specific workflow template by ID.

---

### `DELETE /api/v1/workflow-template/n8n/:id` ★

Delete a workflow template.

---

## Credits — `/api/v1/credits`

### `GET /api/v1/credits/overview` ★

Get credit account overview for the current user.

**Response 200**
```json
{
  "owner_type": "user",
  "owner_id": "uuid",
  "plan_code": "starter",
  "total_credits": 999999999,
  "credits_consumed": 0,
  "available_credits": 999999999,
  "cycle_start": "2025-01-01T00:00:00Z",
  "cycle_end": "2025-02-01T00:00:00Z",
  "status": "active"
}
```

---

### `GET /api/v1/credits/records` ★

Get paginated credit transaction records.

**Query parameters**
- `page` (int, default 1)
- `per_page` (int, default 20)

---

### `GET /api/v1/credits/entitlements` ★

Get feature entitlements for the current plan.

**Response 200**
```json
{
  "features": {
    "agent.chat": true,
    "analytics.advanced": true
  },
  "limits": {
    "max_agents_per_chat": 999999,
    "max_secrets": 999999
  }
}
```

---

## Logs — `/api/v1/logs`

### `GET /api/v1/logs` ★

List recent logs.

**Query parameters**
- `section` — Filter by section (`AUTH`, `AGENTS`, etc.)
- `level` — Filter by level (`INFO`, `ERROR`, etc.)
- `user_id` — Filter by user UUID
- `organization_id` — Filter by organization UUID
- `limit` — Number of results (default 50)

---

### `GET /api/v1/logs/sections` ★

List distinct log sections that have entries.

**Response 200**
```json
{ "sections": ["AUTH", "AGENTS", "API"] }
```

---

### `GET /api/v1/logs/sections/:section` ★

List logs for a specific section.

**Query parameters**
- `level` — Filter by log level

---

## Assets — `/api/v1/assets`

### `GET /api/v1/assets/categories` ★

Get all valid asset categories.

**Response 200**
```json
{
  "categories": [
    "business_profile",
    "brand_assets",
    "marketing_assets",
    "analytics_reports",
    "policy_documents",
    "media_documents"
  ]
}
```

---

### `POST /api/v1/assets` ★

Upload a new asset. Multipart form data.

**Form fields**
- `file` (required) — File bytes
- `category` (required) — Asset category
- `title` (optional)
- `organization_id` (optional) — UUID
- `tags` (optional) — Comma-separated or JSON array
- `metadata` (optional) — JSON object

**Response 201** — Asset object with Cloudinary URL.

---

### `GET /api/v1/assets` ★

List assets.

**Query parameters**
- `organization_id` — Filter by organization
- `category` — Filter by category

---

### `GET /api/v1/assets/:id` ★

Get a specific asset by ID.

---

### `PUT /api/v1/assets/:id` ★

Update asset metadata (title, tags, metadata).

---

### `DELETE /api/v1/assets/:id` ★

Delete an asset (removes from Cloudinary and database).

---

## Todos — `/api/v1/todos`

### `GET /api/v1/todos` ★

List todos for the current user.

**Query parameters**
- `organization_id` — Filter by organization

---

### `POST /api/v1/todos` ★

Create a new todo.

**Request body**
```json
{
  "title": "Set up email campaign",
  "description": "Create welcome sequence for new customers",
  "priority": "high",
  "status": "todo",
  "organization_id": "uuid-optional",
  "due_date": "2025-06-01T00:00:00Z",
  "tags": ["marketing", "email"]
}
```

---

### `GET /api/v1/todos/:id` ★

Get a specific todo.

---

### `PUT /api/v1/todos/:id` ★

Update a todo.

---

### `DELETE /api/v1/todos/:id` ★

Delete a todo.

---

### `PATCH /api/v1/todos/:id/complete` ★

Mark a todo as done (sets progress to 100 and status to `done`).

---

### `POST /api/v1/todos/:id/schedule-agent` ★

Schedule an agent task associated with this todo.

**Request body**
```json
{
  "agent_name": "email_agent",
  "agent_config": { "template": "welcome" },
  "scheduled_at": "2025-06-01T09:00:00Z"
}
```

---

### `GET /api/v1/todos/status/:status` ★

Filter todos by status (`todo`, `in_progress`, `done`).

---

### `GET /api/v1/todos/priority/:priority` ★

Filter todos by priority (`high`, `medium`, `low`).

---

### `POST /api/v1/todos/suggest` ★

Get AI-generated todo suggestions based on a goal.

**Request body**
```json
{
  "goal": "Increase Black Friday sales by 30%",
  "context": "We sell outdoor gear",
  "organization_id": "uuid-optional",
  "max_suggestions": 5
}
```

**Response 200**
```json
{
  "goal": "Increase Black Friday sales by 30%",
  "count": 3,
  "suggestions": [
    {
      "title": "Create early-access email campaign",
      "description": "...",
      "priority": "high",
      "agent_name": "email_agent",
      "reasoning": "Early access campaigns drive..."
    }
  ]
}
```

---

## Analytics — `/api/v1/analytics`

### `GET /api/v1/analytics/agent/runs` ★

Get agent run history.

**Query parameters**
- `agent_id` — Filter by agent
- `from` — ISO 8601 start date
- `to` — ISO 8601 end date

---

### `GET /api/v1/analytics/agent/usage` ★

Get aggregated agent usage metrics.

---

### `GET /api/v1/analytics/tool/executions` ★

List tool execution records.

---

### `GET /api/v1/analytics/tool/executions/:execution_id` ★

Get a specific tool execution by ID.

---

## Common Error Responses

| Status | Meaning |
|---|---|
| `400 Bad Request` | Invalid or missing request body/params |
| `401 Unauthorized` | Missing, invalid, or expired JWT |
| `403 Forbidden` | Authenticated but insufficient role/permissions |
| `404 Not Found` | Resource does not exist |
| `409 Conflict` | Duplicate resource (e.g., email already registered) |
| `429 Too Many Requests` | Rate limit exceeded |
| `500 Internal Server Error` | Unexpected server-side error |

All error responses use the format:
```json
{ "error": "<human-readable message>" }
```
