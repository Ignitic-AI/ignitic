# Software Design Specification (SDS)
# Ignitic AI Engine

**Version:** 1.0  
**Status:** Active  
**Last Updated:** 2026-05-03

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Module Design](#2-module-design)
3. [Agent Orchestration Design](#3-agent-orchestration-design)
4. [Memory Architecture](#4-memory-architecture)
5. [Data Flow Diagrams](#5-data-flow-diagrams)
6. [API Layer Design](#6-api-layer-design)
7. [Background Services Design](#7-background-services-design)
8. [Security Design](#8-security-design)
9. [Error Handling Strategy](#9-error-handling-strategy)
10. [Configuration Management](#10-configuration-management)

---

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        AI Engine Container                       │
│                                                                  │
│  ┌──────────┐   ┌───────────────────────────────────────────┐   │
│  │  FastAPI │   │              LangGraph Runtime             │   │
│  │  (ASGI)  │──▶│  SuperAgent → [Worker Agents]             │   │
│  └──────────┘   │  ├── AgentState (TypedDict)                │   │
│       │         │  ├── SummarizationNode                     │   │
│       │         │  ├── RouterNode                            │   │
│       │         │  └── AgentHooks (analytics)                │   │
│       │         └───────────────────────────────────────────┘   │
│       │                          │                               │
│       │         ┌────────────────▼──────────────┐               │
│       │         │         Service Layer          │               │
│       │         │  AgentService │ ChatService    │               │
│       │         │  WorkflowService │ N8NService  │               │
│       │         └──────────────────────────────┘               │
│       │                          │                               │
│  ┌────▼──────────────────────────▼──────────────────────────┐   │
│  │                   Infrastructure Layer                    │   │
│  │  MongoDB (Motor)  │  RabbitMQ (aio-pika)  │  HTTP Client  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
          │              │               │              │
       MongoDB       RabbitMQ         n8n          MCP Server
```

### 1.2 Layered Architecture

The AI Engine follows a strict layered architecture:

| Layer | Location | Responsibility |
|-------|----------|----------------|
| **API** | `api/` | HTTP routing, request validation, response serialization |
| **Service** | `services/` | Business logic, orchestration of domain operations |
| **Model** | `models/` | Data schema definitions (Beanie documents, Pydantic models) |
| **Core** | `core/` | Cross-cutting concerns: auth, DB init, external client wrappers |
| **Infrastructure** | env / Docker | External systems (MongoDB, RabbitMQ, n8n) |

Rules:
- `api/` imports from `services/` and `models/` — never the reverse.
- `services/` imports from `models/` and `core/` only.
- `core/` has no imports from `api/` or `services/`.

---

## 2. Module Design

### 2.1 `core/`

#### `core/db.py` — Database Initialization

```python
DOCUMENT_MODELS = [
    WorkflowTemplate, N8NWorkflowTemplate, WorkflowCredential, N8NCredential,
    DeployedWorkflow, DeployedN8NWorkflow, WorkflowSession,
    Chat, ChatMessage, ChatShare, Agent, AgentRun, ToolExecution,
]

async def init_db():   # Creates Motor client, runs ping, calls init_beanie()
async def close_db():  # Logs closure (Motor GC handles socket cleanup)
```

All Beanie document models are registered in one call on startup, which creates collections and indexes if they do not exist.

#### `core/auth.py` — Authentication

`AuthProvider` is a dependency-injected dataclass populated from the JWT claims:

```python
@dataclass
class AuthProvider:
    u_id: str
    org_id: Optional[str]
    token: str
```

`get_auth(request)` extracts and verifies the `Authorization: Bearer <token>` header using PyJWT with `JWT_SECRET` and `JWT_ALGORITHM`. All protected routes declare `auth: AuthProvider = Depends(get_auth)`.

#### `core/backend_client.py` — Backend API Client

Wraps HTTP calls to the Go Backend API using `httpx.AsyncClient`. Used to validate organization membership and retrieve org/user metadata.

#### `core/n8n_client.py` — n8n Client

Thin async wrapper around the n8n REST API v1. Methods: create workflow, activate/deactivate, delete, create credential, delete credential.

---

### 2.2 `models/`

All persistent models are **Beanie Documents** (MongoDB documents backed by Motor). Read-only and request/response shapes are plain **Pydantic BaseModel** subclasses.

#### Key Documents

| Class | Collection | Description |
|-------|-----------|-------------|
| `Agent` | `agents` | Agent configuration (identifier, system prompt, type, parent, tools) |
| `Chat` | `chats` | Thread metadata (u_id, org_id, thread_id, agent list) |
| `ChatMessage` | `chat_messages` | Individual serialised LangChain messages |
| `ChatShare` | `chat_shares` | Revocable public share tokens |
| `AgentRun` | `agent_runs` | Per-invocation analytics (tokens, cost, duration) |
| `ToolExecution` | `tool_executions` | Per-tool-call tracking |
| `WorkflowTemplate` | `workflow_templates` | Generic workflow template |
| `N8NWorkflowTemplate` | `n8n_workflow_templates` | n8n-specific workflow template with node graph |
| `DeployedWorkflow` | `deployed_workflows` | Active workflow instance |
| `DeployedN8NWorkflow` | `deployed_n8n_workflows` | n8n-specific deployed workflow |
| `WorkflowSession` | `workflow_sessions` | Ephemeral session (5-min TTL) for tool invocations |
| `WorkflowCredential` | `workflow_credentials` | Generic credentials |
| `N8NCredential` | `n8n_credentials` | n8n-registered encrypted credentials |

See [Database Schema](database-schema.md) for full field listings.

---

### 2.3 `services/agents/`

The agent subsystem is the most complex part of the AI Engine.

| Module | Purpose |
|--------|---------|
| `agent_service.py` | `AgentService.chat_stream()` — entry point for all chat invocations |
| `agent_resolver.py` | Builds the LangGraph `StateGraph` from an Agent list |
| `agent_nodes.py` | Node functions: `router_node`, `summarize_node`, `transfer_back_to_parent` |
| `agent_hooks.py` | `pre_agent_hook` / `post_agent_hook` — captures timing and token usage |
| `chat_service.py` | `ChatService` — CRUD for Chat and ChatMessage documents |
| `checkpointers.py` | `AsyncMongoDBSaver` init and helper utilities |
| `memory_stores.py` | MongoDB Atlas vector store init for long-term asset memory |
| `graphiti_client.py` | Graphiti (Neo4j) client init/close |
| `llms.py` | `get_llm()` and `get_summarization_llm()` — OpenRouter-backed ChatOpenAI |
| `mcp_client.py` | `MCPClientService` — connects to the MCP Server per-agent |
| `prompts.py` | System prompt strings for all prebuilt agents |
| `tool_loader.py` | Loads tools from MCP server and wraps them with logging |
| `utils.py` | Shared utilities (URL helpers, etc.) |

---

## 3. Agent Orchestration Design

### 3.1 Graph Topology

The LangGraph runtime builds a **StateGraph** from the set of agents loaded for a chat session. The graph topology follows the hierarchy defined by the `parent` field on each `Agent` document.

```
           ┌──────────────┐
           │  super_agent │  (implicit root, always present)
           └──────┬───────┘
                  │ delegates via transfer tool
         ┌────────┼─────────┐
         │        │         │
   shopify_agent  │   analytics_agent …
                marketer  (orchestrator)
                  │
          ┌───────┼────────┐
    facebook_page instagram email_marketing
```

### 3.2 `AgentState`

All nodes share a single typed state dict:

```python
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]
    remaining_steps: NotRequired[RemainingSteps]
    start_time: datetime
    active_agent: NotRequired[Optional[str]]    # current agent identifier
    agent_stack: NotRequired[List[str]]         # breadcrumb for parent returns
    summarized_messages: NotRequired[list[BaseMessage]]
    context: NotRequired[dict[str, RunningSummary]]
```

### 3.3 Graph Build Process (`AgentResolver`)

1. **Load agents** from the database for the given user/org.
2. **Detect cycles** via `detect_hierarchy_cycles()` — raises `ValueError` if any cycle found.
3. **Build tool lists** — for each agent, call `MCPClientService` to fetch the MCP tools allowed by `tool_names` allowlist.
4. **Wrap tools** with `ExecutionLoggingToolWrapper` to create `ToolExecution` records.
5. **Create LangGraph nodes** using `langgraph_prebuilt.create_react_agent` for each agent.
6. **Add routing edges** — `super_agent` routes to workers; workers can call `transfer_back_to_parent`.
7. **Compile graph** with `AsyncMongoDBSaver` as checkpointer.

### 3.4 Transfer Mechanism

Each agent exposes two auto-generated tools:
- `transfer_to_<worker_identifier>` — delegates to a child agent
- `transfer_back_to_parent` — pops the `agent_stack` and returns to the caller

These tools update `active_agent` and `agent_stack` in the shared state via LangGraph `Command` primitives.

### 3.5 Summarization

A `SummarizationNode` runs at the start of every turn. It uses a fast, cheap LLM (`SUMMARIZATION_MODEL`, defaulting to `openai/gpt-4o-mini`) to compress message history into a `RunningSummary`. Workers receive the summarized context to avoid exceeding the main model's context window.

### 3.6 Analytics Hooks

`AgentHooks` implements LangGraph's pre/post hooks:
- `pre_model_hook` — records `start_time`.
- `post_model_hook` — records `end_time`, extracts token usage from `response_metadata`, computes cost, and upserts an `AgentRun` document.

---

## 4. Memory Architecture

### 4.1 Short-Term Memory (Checkpoint)

LangGraph's `AsyncMongoDBSaver` writes the full `AgentState` (including all messages) to the `chat_checkpoints` collection keyed by `thread_id`. On each invocation, the previous state is restored before the graph runs.

```
collection: chat_checkpoints
key: { thread_id, checkpoint_ns, checkpoint_id }
value: serialized AgentState (messages, context, agent_stack)
```

### 4.2 Running Summary

`SummarizationNode` from `langmem` maintains a `RunningSummary` in `AgentState.context`. When the message list exceeds a token threshold, older messages are replaced with a compressed summary message. The raw message log in `chat_messages` is unaffected (it is append-only).

### 4.3 Long-Term Memory (Graphiti / Neo4j)

Graphiti maintains a temporal knowledge graph of entities and relationships extracted from conversations. It enables agents to recall facts about the business (e.g., "our Shopify store is called X") across separate chat sessions. Initialization is optional — the system starts without it and emits a warning.

### 4.4 Vector Store (Asset Memory)

Asset documents uploaded by users are chunked, embedded (using OpenRouter/text-embedding-3-small), and stored in MongoDB Atlas with vector indexes. The metadata schema is documented in [vector_store_metadata_schema.md](vector_store_metadata_schema.md).

Namespaces:
- `("user", u_id)` — personal assets
- `("org", org_id)` — org-shared assets

---

## 5. Data Flow Diagrams

### 5.1 Chat Invocation Flow

```
Client
  │
  │  POST /api/v1/chat/{chat_id}/invoke  (SSE)
  ▼
api/agents/chat_routes.py
  │  Validates JWT → AuthProvider
  │  Loads Chat + Agents from MongoDB
  ▼
services/agents/agent_service.py :: AgentService.chat_stream()
  │  Resolves or builds LangGraph compiled graph (cached)
  │  Attaches checkpointer (thread_id config)
  │  Streams events via graph.astream_events()
  │
  ├── Event: on_chat_model_stream  →  yield SSE "token"
  ├── Event: on_tool_start         →  yield SSE "tool_call"
  ├── Event: on_custom_event       →  yield SSE "agent_transfer"
  └── Event: on_chain_end          →  persist ChatMessages, yield SSE "done"
```

### 5.2 Workflow Deployment Flow

```
POST /api/v1/workflow/n8n/deploy/template-{id}
  │
  ▼
services/n8n/n8n_workflow_service.py :: deploy_workflow_from_template()
  │  Load N8NWorkflowTemplate from DB
  │  POST to n8n /workflows  → receive n8n_workflow_id
  │  Save DeployedN8NWorkflow to DB
  └▶ Return deployment info
```

### 5.3 RabbitMQ Asset Processing Flow

```
Backend API publishes asset_uploaded event to RabbitMQ
  │
  ▼
asset_notification_rmq_service.py :: consume()
  │
  ▼
asset_notification_message_processor.py :: process()
  │  Fetch asset URL from Backend API
  │  Download and chunk document
  │  Embed chunks via OpenRouter
  └▶ Upsert into MongoDB vector store
```

---

## 6. API Layer Design

### 6.1 Router Registration

All routers are registered in `main.py` under `/api/v1`:

| Router Prefix | Module | Tags |
|--------------|--------|------|
| `/agents` | `api/agents/agent_routes.py` | Chat Agents |
| `/chats` | `api/agents/chat_routes.py` | Chats |
| `/analytics/agent-runs` | `api/analytics/agent_analytics.py` | Agent Analytics |
| `/analytics/tool-executions` | `api/analytics/tool_analytics.py` | Tool Analytics |
| `/workflow` | `api/workflow_routes.py` | Workflows |
| `/workflow/n8n` | `api/n8n/n8n_workflow_routes.py` | N8N Workflows |
| `/workflow-template` | `api/workflow_template_routes.py` | Workflow Templates |
| `/workflow-template/n8n` | `api/n8n/n8n_workflow_template_routes.py` | N8N Workflow Templates |
| `/workflow-session` | `api/workflow_session_routes.py` | Workflow Sessions |
| `/credential` | `api/credential_routes.py` | Credentials |
| `/credential/n8n` | `api/n8n/n8n_credential_routes.py` | N8N Credentials |
| `/assets` | `api/asset_routes.py` | Assets |

### 6.2 Authentication Pattern

Every route (except health endpoints) uses:

```python
auth: AuthProvider = Depends(get_auth)
```

The dependency reads the `Authorization` header, decodes the HS256 JWT, and returns an `AuthProvider` with `u_id`, `org_id`, and the raw token.

### 6.3 Response Conventions

- **Successful GET list**: `{ "items": [...], "total": N }`
- **Successful GET single**: the document JSON with string `id`
- **Successful POST create**: `{ "id": "...", ...created_object }`
- **Successful DELETE**: `{ "message": "Deleted successfully" }`
- **Errors**: FastAPI default `{ "detail": "..." }` with appropriate HTTP status code

---

## 7. Background Services Design

### 7.1 RMQ Task Manager (`services/rmq/`)

The `RMQTaskManager` singleton manages a registry of `BaseRMQService` subclasses. On startup, it:
1. Calls `rmq_service_factory.register_all_services()` to instantiate and register all services.
2. Calls `rmq_task_manager.start_all_services()` to begin consuming from their respective queues.

Each service:
- Extends `BaseRMQService`
- Declares a queue name and a `BaseMessageProcessor` subclass
- Reconnects automatically on connection failure

Current services:

| Service | Queue | Processor |
|---------|-------|-----------|
| `AgentRMQService` | `agent_messages` | `AgentMessageProcessor` |
| `AssetNotificationRMQService` | `asset_notifications` | `AssetNotificationMessageProcessor` |

### 7.2 Message Processor Pattern

```python
class BaseMessageProcessor(ABC):
    async def process(self, message: aio_pika.IncomingMessage) -> None:
        ...

class AgentMessageProcessor(BaseMessageProcessor):
    async def process(self, message):
        # Deserialize, invoke agent graph, acknowledge or nack
```

---

## 8. Security Design

### 8.1 Authentication Flow

```
Client → Authorization: Bearer <jwt>
         │
         ▼ core/auth.py :: get_auth()
         PyJWT.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
         │
         ├─ Valid  → AuthProvider(u_id, org_id, token)
         └─ Invalid → HTTP 401
```

### 8.2 Multi-Tenancy Isolation

Every database query that reads or mutates user-owned data includes either:
- `Agent.find(Agent.u_id == auth.u_id)` (user scope), or
- `Agent.find(Agent.org_id == auth.org_id)` (org scope)

The `is_org` flag on relevant request bodies switches between user and org scoping.

### 8.3 Credential Encryption

Credentials are encrypted before storage using Fernet (symmetric authenticated encryption):

```python
from cryptography.fernet import Fernet
fernet = Fernet(PASS_ENCRYPTION_FERNET_KEY.encode())
encrypted = fernet.encrypt(plain_text.encode())
```

Decryption happens only when credentials are needed for n8n registration or tool invocation.

### 8.4 CORS

CORS is currently configured with `allow_origins=["*"]` for development. In production, this must be restricted to the Frontend origin.

---

## 9. Error Handling Strategy

### 9.1 FastAPI Exception Handlers

- Pydantic `ValidationError` → HTTP 422 (handled automatically by FastAPI)
- `HTTPException` raised in route/service → returned directly
- Unhandled exceptions → HTTP 500 with generic message (Sentry captures the stack trace)

### 9.2 Agent Graph Errors

Agent streaming errors are caught in `AgentService.chat_stream()` and emitted as SSE events of type `error` so the client can surface them without a broken stream.

### 9.3 LangGraph "remaining_steps" Warning

A custom `logging.Filter` suppresses the harmless "wrote to unknown channel remaining_steps" LangGraph warnings at startup.

---

## 10. Configuration Management

All configuration is loaded from environment variables at startup via `python-dotenv`. See [environment variables documentation](deployment.md#environment-variables) for the full reference.

Key design decisions:
- The application raises immediately if critical variables (`MONGO_URI`, `PORT`) are absent.
- Optional integrations (Graphiti, Sentry, Langfuse) degrade gracefully — the service starts and logs a warning.
- `env.example` provides a fully documented template that mirrors the production configuration shape.
