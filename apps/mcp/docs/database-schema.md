# Data Models Reference
# Ignitic AI MCP Server

**Version:** 1.0  
**Status:** Active  
**Last Updated:** 2026-05-03

---

## Overview

The MCP Server does not own a database. It uses Pydantic models for in-memory data representation, request/response validation, and inter-service communication. The underlying persistence is managed by the **AI Engine** (MongoDB via Beanie/Motor).

This document describes every data model used by the MCP Server, including the schemas of the documents it reads from or writes to the AI Engine.

---

## Table of Contents

1. [User](#1-user)
2. [Credential](#2-credential)
3. [ToolExecution](#3-toolexecution)
4. [WorkflowTemplate](#4-workflowtemplate)
5. [WorkflowInput / WorkflowOutput](#5-workflowinput--workflowoutput)
6. [WorkflowSession](#6-workflowsession)

---

## 1. User

**Module:** `models/user.py`

Represents an authenticated user, populated from JWT claims by the AI Engine's authentication layer.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `str` | Yes | Unique user identifier (from JWT `user_id` claim) |
| `email` | `EmailStr` | Yes | User's email address (from JWT `email` claim) |
| `name` | `str \| None` | No | User's display name |
| `role` | `"admin" \| "user"` | No | User's role; defaults to `"user"` |
| `org_id` | `str \| None` | No | Organisation identifier |

### Example

```json
{
  "id": "usr_123abc",
  "email": "alice@example.com",
  "name": "Alice Smith",
  "role": "user",
  "org_id": "org_456def"
}
```

### Usage

The `User` model is constructed by `core/auth.py` from decoded JWT claims. It is not persisted by the MCP Server. The `auth_header` (raw JWT) is passed to tool functions so they can call the AI Engine for credential retrieval on behalf of the user.

---

## 2. Credential

**Module:** `models/credential.py`

Represents a third-party API credential stored in the AI Engine on behalf of a user.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `str` | Yes | Credential type identifier (e.g., `"shopify"`, `"hubspot"`, `"google_ads"`) |
| `u_id` | `str` | Yes | User ID that owns this credential |
| `org_id` | `str \| None` | No | Organisation ID (for org-scoped credentials) |
| `data` | `Dict[str, Any]` | Yes | The credential payload — structure varies by type (see below) |
| `updatedAt` | `datetime` | No | Last update timestamp; defaults to now |

### Credential Data Payloads by Type

The `data` field contains the actual secrets. Structure varies by platform:

| Credential Type | Key Fields in `data` |
|----------------|----------------------|
| `shopify` | `shop_url`, `access_token` |
| `hubspot` | `access_token` |
| `google_drive` | `access_token`, `refresh_token`, `token_uri`, `client_id`, `client_secret` |
| `google_analytics` | `property_id`, `access_token`, `refresh_token`, `client_id`, `client_secret` |
| `google_ads` | `customer_id`, `developer_token`, `access_token`, `refresh_token`, `client_id`, `client_secret` |
| `facebook_page` | `page_access_token`, `page_id` |
| `instagram` | `access_token`, `instagram_business_account_id` |
| `meta_ads` | `access_token`, `ad_account_id` |
| `brevo` | `api_key` |
| `mailchimp` | `api_key`, `server_prefix` |
| `zendesk` | `subdomain`, `email`, `api_token` |
| `apify` | `api_token` |

### Example

```json
{
  "type": "shopify",
  "u_id": "usr_123abc",
  "org_id": "org_456def",
  "data": {
    "shop_url": "my-store.myshopify.com",
    "access_token": "shpat_..."
  },
  "updatedAt": "2026-01-15T10:30:00"
}
```

### Security

Credential `data` payloads are encrypted at rest in the AI Engine using a Fernet symmetric key (`PASS_ENCRYPTION_FERNET_KEY`). The MCP Server receives decrypted credential data when it calls `GET /api/v1/credential/{type}` — credentials are never stored on the MCP Server and are not logged.

---

## 3. ToolExecution

**Module:** `models/tool_execution.py`

Records every tool invocation for observability and audit. Created by `ExecutionLoggingMiddleware` before each tool call and updated after completion.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `str \| None` | No | MongoDB document ID (alias: `_id`) |
| `tool_name` | `str` | Yes | Name of the tool function (e.g., `get_products`) |
| `ignitic_identifier` | `str` | Yes | Dot-separated tool identifier (e.g., `tools.shopify_agent.get_products`) |
| `chat_id` | `str \| None` | No | Chat session ID from `X-Chat-ID` header |
| `u_id` | `str` | Yes | User ID extracted from JWT |
| `org_id` | `str \| None` | No | Organisation ID extracted from JWT |
| `status` | `"running" \| "succeeded" \| "failed"` | No | Current execution status; defaults to `"running"` |
| `input_payload` | `Dict[str, Any]` | No | Tool input arguments; defaults to `{}` |
| `response_payload` | `Dict[str, Any] \| None` | No | Tool response on success |
| `error` | `str \| None` | No | Error message on failure |
| `is_workflow` | `bool` | No | Whether this is an n8n workflow tool; defaults to `false` |
| `workflow_provider` | `str \| None` | No | `"n8n"` for workflow tools |
| `created_at` | `datetime` | No | Creation timestamp; defaults to now |
| `updated_at` | `datetime` | No | Last update timestamp; defaults to now |

### Lifecycle

```
Tool invocation received
        │
        ▼
ToolExecution created (status: "running")
        │
        ├─ Tool succeeds → status: "succeeded", response_payload set
        │
        └─ Tool fails → status: "failed", error set
```

### Example

```json
{
  "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
  "tool_name": "get_products",
  "ignitic_identifier": "tools.shopify_agent.get_products",
  "chat_id": "chat_789ghi",
  "u_id": "usr_123abc",
  "org_id": "org_456def",
  "status": "succeeded",
  "input_payload": { "limit": 10 },
  "response_payload": {
    "content": [{ "type": "text", "text": "[{\"id\": 1234, ...}]" }]
  },
  "error": null,
  "is_workflow": false,
  "workflow_provider": null,
  "created_at": "2026-05-03T10:00:00",
  "updated_at": "2026-05-03T10:00:02"
}
```

### AI Engine Endpoints

| Operation | HTTP Method | Path |
|-----------|-------------|------|
| Create | `POST` | `/api/v1/analytics/tool/executions` |
| Update | `PATCH` | `/api/v1/analytics/tool/executions/{id}` |

---

## 4. WorkflowTemplate

**Module:** `models/automations/workflow_template.py`

Defines an n8n workflow that is dynamically registered as an MCP tool at server startup. Stored in the AI Engine's MongoDB.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `str \| None` | No | MongoDB document ID |
| `ignitic_identifier` | `str` | Yes | Unique dot-separated identifier (e.g., `tools.marketer.send_campaign`) |
| `name` | `str` | Yes | Human-readable template name |
| `description` | `str` | Yes | Used as the tool's docstring (visible to the LLM) |
| `inputs` | `Dict[str, WorkflowInput] \| None` | No | Input parameter schema |
| `outputs` | `Dict[str, WorkflowOutput] \| None` | No | Output parameter schema |
| `u_id` | `str \| None` | No | Owner user ID (for user-created templates) |
| `org_id` | `str \| None` | No | Owner organisation ID |
| `created_at` | `datetime` | No | Creation timestamp |
| `updated_at` | `datetime` | No | Last update timestamp |

### Validation

- `ignitic_identifier` is required and must be non-empty after stripping whitespace.
- `name` is required and must be non-empty after stripping whitespace.
- The tool name registered in FastMCP is derived from the last segment of `ignitic_identifier`:
  - `tools.marketer.send_campaign` → tool name: `send_campaign`

### Example

```json
{
  "id": "64f1a2b3c4d5e6f7a8b9c0d2",
  "ignitic_identifier": "tools.marketer.send_welcome_campaign",
  "name": "Send Welcome Campaign",
  "description": "Sends a welcome email campaign to new subscribers via n8n.",
  "inputs": {
    "subscriber_email": {
      "type": "string",
      "description": "Email address of the new subscriber",
      "required": true
    },
    "campaign_id": {
      "type": "string",
      "description": "Brevo campaign ID to send",
      "required": true
    }
  },
  "outputs": {
    "success": {
      "type": "boolean",
      "description": "Whether the campaign was sent successfully"
    },
    "message": {
      "type": "string",
      "description": "Status message"
    }
  },
  "u_id": null,
  "org_id": "org_456def",
  "created_at": "2026-04-01T09:00:00",
  "updated_at": "2026-04-15T14:30:00"
}
```

---

## 5. WorkflowInput / WorkflowOutput

**Module:** `models/automations/workflow_template.py`

Sub-models used within `WorkflowTemplate` to define input and output parameters.

### WorkflowInput Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `str` | Yes | Data type: `"string"`, `"integer"`, `"number"`, `"boolean"`, `"object"`, `"array"` |
| `description` | `str \| None` | No | Human-readable description used in the LLM tool schema |
| `default` | `Any \| None` | No | Default value if not provided |
| `required` | `bool` | No | Whether the input must be provided; defaults to `true` |

### WorkflowOutput Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `str` | Yes | Data type of the output |
| `description` | `str \| None` | No | Human-readable description |

### Dynamic Model Generation

At startup, `utils/dynamic_models.py` converts `WorkflowTemplate.inputs` into a Pydantic `BaseModel` class:

```python
# Given inputs:
{
  "email": WorkflowInput(type="string", description="Email", required=True),
  "count": WorkflowInput(type="integer", description="Count", default=5, required=False)
}

# Generates a Pydantic model equivalent to:
class send_welcome_campaign_input(BaseModel):
    email: str = Field(..., description="Email")
    count: int = Field(default=5, description="Count")
```

This allows FastMCP to generate a correct JSON Schema for the tool that the LLM can use to construct valid tool calls.

---

## 6. WorkflowSession

**Module:** `models/automations/workflow_session.py`

Represents an ephemeral n8n workflow session. Created by the AI Engine when a workflow tool is invoked. Provides a time-limited webhook URL for the MCP Server to POST the tool's inputs to.

### Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | `str \| None` | No | Session ID (alias: `_id`) |
| `template_id` | `str` | Yes | The `WorkflowTemplate` ID this session belongs to |
| `ignitic_identifier` | `str` | Yes | Template's ignitic identifier |
| `workflow_id` | `str \| None` | No | The deployed n8n workflow ID |
| `workflow_url` | `HttpUrl \| None` | No | Webhook URL to POST tool inputs to |
| `status` | `SessionStatus` | No | Current status of the session |
| `created_at` | `datetime` | No | Session creation time |
| `expires_at` | `datetime` | No | Expiry time; defaults to 5 minutes after creation |
| `last_activity_at` | `datetime` | No | Last activity timestamp |
| `active_executions_count` | `int` | No | Number of in-progress executions; defaults to `0` |
| `u_id` | `str` | Yes | User ID that triggered the session |
| `org_id` | `str \| None` | No | Organisation ID |

### Session Status Enum (`SessionStatus`)

| Value | Description |
|-------|-------------|
| `creating` | Session is being set up |
| `active` | Session is ready to accept requests |
| `executing` | A workflow execution is in progress |
| `expired` | Session has passed its `expires_at` time |
| `cleaning_up` | Session is being torn down |

### Session Lifecycle

```
WorkflowTemplate selected by agent
           │
           ▼
POST /api/v1/workflow-session/  (MCP Server → AI Engine)
           │
           ▼
WorkflowSession created (status: "active", expires: +5 min)
           │
           ▼
MCP Server POSTs tool inputs to session.workflow_url
           │
           ├─ n8n executes the workflow
           │
           └─ MCP Server returns result to AI Engine
```

### Example

```json
{
  "_id": "sess_abc123xyz",
  "template_id": "64f1a2b3c4d5e6f7a8b9c0d2",
  "ignitic_identifier": "tools.marketer.send_welcome_campaign",
  "workflow_id": "n8n-wf-001",
  "workflow_url": "https://n8n.example.com/webhook/send-welcome-campaign",
  "status": "active",
  "created_at": "2026-05-03T10:00:00",
  "expires_at": "2026-05-03T10:05:00",
  "last_activity_at": "2026-05-03T10:00:00",
  "active_executions_count": 0,
  "u_id": "usr_123abc",
  "org_id": "org_456def"
}
```

---

## Data Flow Summary

```
JWT → User (in memory, not persisted)
  │
  ▼
Tool invoked
  │
  ├─ GET /api/v1/credential/{type} → Credential (decrypted, in memory only)
  │
  ├─ POST /api/v1/analytics/tool/executions → ToolExecution (persisted by AI Engine)
  │
  └─ (workflow tools only)
       POST /api/v1/workflow-session/ → WorkflowSession (persisted by AI Engine)
                │
                ▼
       Startup: GET /api/v1/workflow-template/ → WorkflowTemplate[]
               → DynamicModel generated (in memory)
               → Tool registered on FastMCP server
```
