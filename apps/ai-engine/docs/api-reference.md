# API Reference
# Ignitic AI Engine

**Base URL:** `http://<host>:<port>/api/v1`  
**Default port:** `8010`  
**Authentication:** All endpoints (except health) require `Authorization: Bearer <jwt>`  
**Interactive docs:** `GET /docs` (Swagger UI) · `GET /redoc` (ReDoc)

---

## Health Endpoints

### `GET /`
Root health check.

**Response 200**
```json
{
  "message": "Welcome to AI Engine",
  "version": "1.0.0",
  "status": "healthy",
  "docs": "/docs",
  "redoc": "/redoc"
}
```

---

### `GET /health`
Full health check including RMQ service status.

**Response 200**
```json
{
  "status": "healthy",
  "service": "AI Engine",
  "version": "1.0.0",
  "rmq_services": {
    "agent_messages": "running",
    "asset_notifications": "running"
  }
}
```

---

### `GET /health/rmq`
RabbitMQ-specific health check.

**Response 200**
```json
{
  "status": "healthy",
  "services": { "agent_messages": "running" }
}
```

---

## Agents

### `GET /api/v1/agents`
List all agents for the authenticated user/org.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `is_org` | bool | `false` | Return org-scoped agents |

**Response 200** — array of Agent objects.

---

### `POST /api/v1/agents`
Create a custom agent.

**Request Body**
```json
{
  "name": "My Custom Agent",
  "description": "Handles customer queries",
  "system_prompt": "You are a helpful assistant...",
  "type": "worker",
  "parent": "super_agent",
  "tags": [],
  "tool_names": ["shopify_get_products"],
  "is_org": false
}
```

**Response 201** — created Agent object.

---

### `GET /api/v1/agents/{identifier}`
Get a single agent by identifier.

**Response 200** — Agent object.  
**Response 404** — Agent not found.

---

### `PATCH /api/v1/agents/{identifier}`
Update agent fields (name, description, system_prompt, tags, tool_names).

**Request Body** — partial Agent fields.

**Response 200** — updated Agent object.

---

### `DELETE /api/v1/agents/{identifier}`
Delete an agent.

**Response 200**
```json
{ "message": "Agent deleted successfully" }
```

---

### `POST /api/v1/agents/{identifier}/reset`
Reset a prebuilt agent to factory defaults.

**Response 200** — reset Agent object.

---

### `POST /api/v1/agents/{identifier}/reset-prompt`
Reset only the system prompt of a prebuilt agent.

**Response 200** — updated Agent object.

---

### `GET /api/v1/agents/available-tools`
List all tools available on the `/custom` MCP server (for configuring custom agents).

**Response 200**
```json
[
  { "name": "shopify_get_products", "description": "Retrieve Shopify products" },
  ...
]
```

---

## Chats

### `GET /api/v1/chats`
List all chats for the authenticated user.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 50 | Maximum results |
| `skip` | int | 0 | Offset |

**Response 200** — array of Chat objects.

---

### `POST /api/v1/chats`
Create a new chat session.

**Request Body**
```json
{
  "agents": ["shopify_agent", "analytics_agent"],
  "name": "Shopify Q&A"
}
```

**Response 201**
```json
{
  "id": "66a1b2c3d4e5f6a7b8c9d0e1",
  "thread_id": "550e8400-e29b-41d4-a716-446655440000",
  "u_id": "user_123",
  "agents": ["shopify_agent"],
  "name": "Shopify Q&A",
  "created_at": "2026-05-03T03:00:00Z"
}
```

---

### `GET /api/v1/chats/{chat_id}`
Get chat details.

**Response 200** — Chat object.

---

### `DELETE /api/v1/chats/{chat_id}`
Delete a chat and its messages.

**Response 200**
```json
{ "message": "Chat deleted" }
```

---

### `GET /api/v1/chats/{chat_id}/messages`
Get paginated message history.

**Query Parameters**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | int | 50 | Number of messages |
| `skip` | int | 0 | Offset |

**Response 200** — array of ChatMessage objects.

---

### `POST /api/v1/chats/{chat_id}/invoke`
Invoke agents in a chat and stream the response.

**Request Body**
```json
{
  "message": "What are my top selling products?",
  "files": [],
  "images": []
}
```

**Response 200** — `text/event-stream` (SSE)

SSE event types:
| Type | Payload | Description |
|------|---------|-------------|
| `token` | `{ "content": "..." }` | Streamed text token |
| `thinking` | `{ "content": "..." }` | Agent reasoning |
| `tool_call` | `{ "tool": "...", "status": "running" }` | Tool invocation start |
| `tool_result` | `{ "tool": "...", "status": "succeeded" }` | Tool completion |
| `agent_transfer` | `{ "from": "...", "to": "..." }` | Agent hand-off |
| `error` | `{ "message": "..." }` | Error during processing |
| `done` | `{}` | Stream complete |

---

### `POST /api/v1/chats/{chat_id}/share`
Create a share token for a chat.

**Response 201**
```json
{ "token": "abc123xyz", "chat_id": "..." }
```

---

### `DELETE /api/v1/chats/{chat_id}/share/{token}`
Revoke a share token.

**Response 200**
```json
{ "message": "Share revoked" }
```

---

## Analytics — Agent Runs

### `GET /api/v1/analytics/agent-runs`
List agent runs with pagination and filtering.

**Query Parameters**
| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | int | Max results (default 50) |
| `skip` | int | Offset |
| `agent_identifier` | string | Filter by agent |
| `chat_id` | string | Filter by chat |

**Response 200**
```json
{
  "items": [ { ...AgentRun } ],
  "total": 120
}
```

---

## Analytics — Tool Executions

### `GET /api/v1/analytics/tool-executions`
List tool executions with pagination.

**Query Parameters** — same pattern as agent runs.

**Response 200**
```json
{
  "items": [ { ...ToolExecution } ],
  "total": 340
}
```

---

## Workflow Templates (Generic)

### `GET /api/v1/workflow-template/`
List workflow templates.

**Query Parameters:** `limit` (default 10)

**Response 200** — array of WorkflowTemplate objects.

---

### `POST /api/v1/workflow-template/`
Create a workflow template.

**Response 201** — created WorkflowTemplate.

---

### `GET /api/v1/workflow-template/{id}`
Get a workflow template by ID.

---

### `DELETE /api/v1/workflow-template/{id}`
Delete a workflow template.

---

## n8n Workflow Templates

### `GET /api/v1/workflow-template/n8n/`
List n8n workflow templates.

**Query Parameters:** `limit` (default 10)

---

### `POST /api/v1/workflow-template/n8n/`
Create an n8n workflow template directly.

---

### `POST /api/v1/workflow-template/n8n/import`
Import a raw n8n workflow JSON as a template. Only accepts workflows whose first node type is `n8n-nodes-base.webhook`.

**Request Body** — raw n8n workflow JSON.

**Response 201** — created N8NWorkflowTemplate.

---

### `GET /api/v1/workflow-template/n8n/{id}`
Get n8n workflow template by ID.

---

### `DELETE /api/v1/workflow-template/n8n/{id}`
Delete n8n workflow template.

---

## n8n Workflow Deployment

### `GET /api/v1/workflow/n8n/`
List deployed n8n workflows for the authenticated user/org.

**Query Parameters:** `limit` (default 100)

---

### `GET /api/v1/workflow/n8n/{id}`
Get a deployed workflow by its MongoDB ID or `ignitic_identifier`.

---

### `POST /api/v1/workflow/n8n/deploy/template-{workflow_template_id}`
Deploy a workflow from a template to n8n.

**Response 201**
```json
{
  "status": "deployed",
  "workflow_id": "...",
  "webhook_url": "https://n8n.example.com/webhook/..."
}
```

---

### `POST /api/v1/workflow/n8n/activate/{workflow_id}`
Activate a deployed workflow.

**Response 200**
```json
{ "status": "activated", "workflow_id": "..." }
```

---

### `DELETE /api/v1/workflow/n8n/{workflow_id}`
Delete a deployed workflow from both n8n and the database.

---

## Workflow Sessions

### `GET /api/v1/workflow-session/`
List workflow sessions.

---

### `POST /api/v1/workflow-session/`
Create a workflow session.

**Request Body**
```json
{
  "template_id": "...",
  "ignitic_identifier": "send_email_workflow"
}
```

**Response 201** — WorkflowSession object.

---

### `GET /api/v1/workflow-session/{session_id}`
Get session details.

---

### `DELETE /api/v1/workflow-session/{session_id}`
Delete/cleanup a session and its n8n deployment.

---

## Credentials (Generic)

### `GET /api/v1/credential/`
List credentials.

### `POST /api/v1/credential/`
Create a credential.

### `GET /api/v1/credential/{id}`
Get credential by ID.

### `DELETE /api/v1/credential/{id}`
Delete credential.

---

## n8n Credentials

### `GET /api/v1/credential/n8n/`
List SMTP credentials (scoped to user/org). Default `limit=100`.

### `GET /api/v1/credential/n8n/{id}`
Get SMTP credential by ID.

### `POST /api/v1/credential/n8n/smtp`
Create and register an SMTP credential with n8n.

**Request Body**
```json
{
  "host": "smtp.example.com",
  "port": 587,
  "username": "user@example.com",
  "password": "secret",
  "ssl": true
}
```

**Response 201** — N8NCredential object.

### `DELETE /api/v1/credential/n8n/{credential_id}`
Delete credential from both database and n8n.

---

## Error Responses

| Status | Meaning |
|--------|---------|
| 400 | Bad request — validation failed |
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — resource belongs to a different user/org |
| 404 | Not found |
| 422 | Unprocessable entity — Pydantic validation error |
| 500 | Internal server error |

Error body:
```json
{ "detail": "Human-readable error description" }
```
