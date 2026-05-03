# Database Schema Reference
# Ignitic AI Engine

**Database:** MongoDB  
**ODM:** Beanie (Motor async driver)  
**Database name:** `ai_engine_db` (configurable via `DB_NAME`)

---

## Collections Overview

| Collection | Document Class | Purpose |
|-----------|---------------|---------|
| `agents` | `Agent` | AI agent configurations |
| `chats` | `Chat` | Chat session metadata |
| `chat_messages` | `ChatMessage` | Individual serialised messages |
| `chat_shares` | `ChatShare` | Revocable public share tokens |
| `agent_runs` | `AgentRun` | Per-invocation analytics |
| `tool_executions` | `ToolExecution` | Per-tool-call tracking |
| `workflow_templates` | `WorkflowTemplate` | Generic workflow templates |
| `n8n_workflow_templates` | `N8NWorkflowTemplate` | n8n-specific workflow templates |
| `deployed_workflows` | `DeployedWorkflow` | Generic deployed workflow instances |
| `deployed_n8n_workflows` | `DeployedN8NWorkflow` | n8n deployed workflow instances |
| `workflow_credentials` | `WorkflowCredential` | Generic encrypted credentials |
| `n8n_credentials` | `N8NCredential` | n8n-registered encrypted credentials |
| `workflow_sessions` | `WorkflowSession` | Ephemeral tool invocation sessions |
| `chat_checkpoints` | *(LangGraph internal)* | LangGraph state checkpoints |

---

## Collection Schemas

### `agents`

Stores AI agent configurations created by users or seeded as prebuilt agents.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `identifier` | string | ✓ | Unique agent identifier (e.g. `shopify_agent`) |
| `u_id` | string | — | User ID (null for org-scoped agents) |
| `org_id` | string | — | Organization ID |
| `name` | string | ✓ | Display name |
| `description` | string | ✓ | Agent description |
| `type` | enum | ✓ | `orchestrator` or `worker` |
| `parent` | string | ✓ | Parent agent identifier; default `"super_agent"` |
| `system_prompt` | string | ✓ | LLM system prompt |
| `tags` | string[] | — | Tag IDs for categorization |
| `tool_names` | string[] | — | Allowlisted MCP tool names; empty = all tools |

**Indexes:** None explicitly defined (Beanie default `_id` index applies).

---

### `chats`

One document per chat session.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `u_id` | string | ✓ | User ID |
| `org_id` | string | — | Organization ID |
| `thread_id` | string | ✓ | LangGraph thread identifier (UUID) |
| `agents` | string[] | — | Agent identifiers active in this chat |
| `name` | string | — | Human-readable chat name |
| `created_at` | datetime | auto | Creation timestamp |
| `updated_at` | datetime | auto | Last update timestamp |

---

### `chat_messages`

Append-only log of all LangChain messages for a chat.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `chat_id` | string | ✓ | Parent `Chat._id` as string |
| `message_id` | string | ✓ | LangChain `BaseMessage.id` |
| `data` | object | ✓ | Serialized message from `messages_to_dict` |
| `created_at` | datetime | auto | Insertion timestamp (ordering) |

**Indexes:**
- `(chat_id ASC, created_at ASC)` — primary read pattern
- `(chat_id ASC, message_id ASC)` — **unique**, prevents duplicate inserts

---

### `chat_shares`

Public read-only share tokens for chats.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `token` | string | ✓ | Opaque share token |
| `chat_id` | string | ✓ | Parent `Chat._id` as string |
| `created_by_u_id` | string | ✓ | User who created the share |
| `org_id` | string | — | Organization ID |
| `is_revoked` | bool | — | Whether the token is revoked (default `false`) |
| `created_at` | datetime | auto | Creation timestamp |
| `updated_at` | datetime | auto | Last update timestamp |

**Indexes:**
- `(token ASC)` — **unique**
- `(chat_id ASC, is_revoked ASC)`

---

### `agent_runs`

Analytics record for every agent invocation.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `agent_identifier` | string | ✓ | Agent identifier |
| `agent_name` | string | ✓ | Agent display name |
| `u_id` | string | ✓ | User ID |
| `org_id` | string | — | Organization ID |
| `chat_id` | string | ✓ | Chat session ID |
| `thread_id` | string | ✓ | LangGraph thread ID |
| `message_id` | string | — | Input message ID |
| `tool_calls` | string[] | — | Tool call IDs made during this run |
| `input_tokens` | int | — | LLM input tokens |
| `output_tokens` | int | — | LLM output tokens |
| `total_tokens` | int | — | Total tokens |
| `cost` | float | — | Estimated USD cost |
| `model_used` | string | ✓ | LLM model name (e.g. `openai/gpt-4o`) |
| `provider_used` | string | — | LLM provider (default `openrouter`) |
| `duration_ms` | int | — | Wall-clock duration in milliseconds |
| `started_at` | datetime | ✓ | Run start time |
| `ended_at` | datetime | ✓ | Run end time |
| `created_at` | datetime | auto | Record creation time |

---

### `tool_executions`

Tracks every MCP tool call made by agents.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `tool_name` | string | ✓ | MCP tool name |
| `ignitic_identifier` | string | ✓ | Ignitic-internal tool identifier |
| `chat_id` | string | — | Parent chat ID |
| `u_id` | string | ✓ | User ID |
| `org_id` | string | — | Organization ID |
| `status` | enum | — | `running` / `succeeded` / `failed` |
| `input_payload` | object | — | Tool call arguments |
| `response_payload` | object | — | Tool response |
| `error` | string | — | Error message if failed |
| `is_workflow` | bool | — | Whether tool is an n8n workflow invocation |
| `workflow_provider` | string | — | Workflow provider (e.g. `n8n`) |
| `created_at` | datetime | auto | Creation timestamp |
| `updated_at` | datetime | auto | Last update timestamp |

---

### `workflow_templates`

Root template collection. Subclassed by `N8NWorkflowTemplate` (polymorphic via Beanie `UnionDoc`).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `ignitic_identifier` | string | ✓ | Unique template identifier |
| `name` | string | ✓ | Template display name |
| `description` | string | ✓ | Template description |
| `inputs` | object | — | `{field_name: WorkflowInput}` map |
| `outputs` | object | — | `{field_name: WorkflowOutput}` map |
| `u_id` | string | — | Owner user ID |
| `org_id` | string | — | Owner org ID |
| `created_at` | datetime | auto | Creation timestamp |
| `updated_at` | datetime | auto | Last update timestamp |

`WorkflowInput` shape: `{ type, description, default, required }`  
`WorkflowOutput` shape: `{ type, description }`

---

### `n8n_workflow_templates`

Extends `workflow_templates` with n8n-specific fields.

Inherits all `WorkflowTemplate` fields plus:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `n8n_workflow` | object | — | Raw n8n workflow JSON (nodes, connections, settings) |
| `webhook_path` | string | — | Webhook URL path |
| `trigger_node_type` | string | — | Must be `n8n-nodes-base.webhook` |

---

### `deployed_workflows`

Generic deployed workflow record.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `ignitic_identifier` | string | — | Ignitic workflow identifier |
| `webhook_url` | string | — | Callable webhook URL |
| `active` | bool | — | Activation state (default `false`) |
| `template_id` | string | — | Source template ID |
| `u_id` | string | — | User ID |
| `org_id` | string | — | Organization ID |
| `createdAt` | datetime | auto | Creation timestamp |
| `updatedAt` | datetime | auto | Last update timestamp |

---

### `deployed_n8n_workflows`

n8n-specific deployed workflow, extends `deployed_workflows`.

Additional fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `n8n_workflow_id` | string | — | n8n internal workflow ID |
| `n8n_credential_ids` | string[] | — | Associated n8n credential IDs |

---

### `workflow_sessions`

Ephemeral sessions for single tool invocations (5-minute default TTL).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `template_id` | string | ✓ | Source template ID |
| `ignitic_identifier` | string | ✓ | Template ignitic identifier |
| `workflow_id` | string | — | Deployed workflow ID |
| `workflow_url` | string | — | Tool webhook URL |
| `status` | enum | — | `creating` / `active` / `executing` / `expired` / `cleaning_up` |
| `created_at` | datetime | auto | Session creation time |
| `expires_at` | datetime | auto | Expiry time (now + 5 min) |
| `last_activity_at` | datetime | auto | Last activity timestamp |
| `active_executions_count` | int | — | In-progress execution count |
| `u_id` | string | ✓ | User ID |
| `org_id` | string | — | Organization ID |

---

### `n8n_credentials`

Encrypted credentials registered with n8n.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `type` | string | ✓ | Credential type (e.g. `smtp`) |
| `u_id` | string | ✓ | User ID |
| `org_id` | string | — | Organization ID |
| `n8n_credential_id` | string | — | ID returned by n8n on registration |
| `data` | object | ✓ | Encrypted credential payload |
| `updatedAt` | datetime | auto | Last update timestamp |

---

### `workflow_credentials`

Generic workflow credential storage.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `_id` | ObjectId | auto | MongoDB document ID |
| `type` | string | ✓ | Credential type |
| `u_id` | string | ✓ | User ID |
| `org_id` | string | — | Organization ID |
| `data` | object | ✓ | Credential data (encrypted) |
| `updatedAt` | datetime | auto | Last update timestamp |

---

### `chat_checkpoints` (LangGraph internal)

Managed entirely by `langgraph-checkpoint-mongodb`. Do not write to this collection directly.

| Field | Description |
|-------|-------------|
| `thread_id` | LangGraph thread identifier |
| `checkpoint_ns` | Checkpoint namespace (sub-graph path) |
| `checkpoint_id` | Unique checkpoint ID |
| `channel_values` | Serialized `AgentState` |
| `channel_versions` | Channel version vector |
| `versions_seen` | Node version tracking |
| `pending_sends` | Pending messages (interrupt support) |
| `metadata` | LangGraph run metadata |

---

## Vector Store

Asset document embeddings are stored in MongoDB Atlas using the `langgraph-store-mongodb` vector store. See [vector_store_metadata_schema.md](vector_store_metadata_schema.md) for the full metadata schema and index configuration.

**Collection name:** `asset_vectors` (configurable)  
**Embedding dimensions:** 1536 (OpenAI text-embedding-3-small)  
**Namespace pattern:** `("user", u_id)` or `("org", org_id)`

---

## Indexes Summary

| Collection | Index | Type | Purpose |
|-----------|-------|------|---------|
| `chat_messages` | `(chat_id, created_at)` | Compound | Ordered message retrieval |
| `chat_messages` | `(chat_id, message_id)` | Unique | Deduplication |
| `chat_shares` | `token` | Unique | Token lookup |
| `chat_shares` | `(chat_id, is_revoked)` | Compound | Active shares for a chat |

> All other collections rely on MongoDB's default `_id` index. Additional application-level indexes (e.g. on `u_id`, `org_id`, `thread_id`) should be added based on query profiling in production.
