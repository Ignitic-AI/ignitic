# Software Design Specification (SDS)
# Ignitic AI MCP Server

**Version:** 1.0  
**Status:** Active  
**Last Updated:** 2026-05-03

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Module Design](#2-module-design)
3. [Middleware Pipeline](#3-middleware-pipeline)
4. [Tool Design Pattern](#4-tool-design-pattern)
5. [Dynamic Workflow Tools](#5-dynamic-workflow-tools)
6. [Lifespan Composition](#6-lifespan-composition)
7. [Security Design](#7-security-design)
8. [Error Handling](#8-error-handling)

---

## 1. System Architecture

### 1.1 Top-Level Application

The MCP Server is a **Starlette** application (`main.py`) that composes 15 FastMCP HTTP applications under path-based routes.

```
Starlette app (port 8011)
│
├── Route: GET /health                        → JSON health response
├── Mount: /product_researcher               → FastMCP HTTP app
├── Mount: /business_analyst                 → FastMCP HTTP app
├── Mount: /marketer                         → FastMCP HTTP app
├── Mount: /seo_agent                        → FastMCP HTTP app
├── Mount: /shopify_agent                    → FastMCP HTTP app
├── Mount: /hubspot_agent                    → FastMCP HTTP app
├── Mount: /gdrive_agent                     → FastMCP HTTP app
├── Mount: /facebook_page_agent              → FastMCP HTTP app
├── Mount: /instagram_agent                  → FastMCP HTTP app
├── Mount: /email_marketing_agent            → FastMCP HTTP app
├── Mount: /customer_support_agent           → FastMCP HTTP app
├── Mount: /analytics_agent                  → FastMCP HTTP app
├── Mount: /meta_ads_agent                   → FastMCP HTTP app
├── Mount: /google_ads_agent                 → FastMCP HTTP app
└── Mount: /custom                           → FastMCP HTTP app (dynamic)
```

Path values are derived from the `Agent` enum in `models/agent.py` (shared with the AI Engine container), ensuring path names are always in sync with agent identifiers.

### 1.2 Request Lifecycle

```
AI Engine sends:
  POST /shopify_agent/<tool_call>
  Authorization: Bearer <jwt>
  X-Chat-ID: <chat_id>

    │
    ▼ Starlette routing
    │
    ▼ FastMCP HTTP app (/shopify_agent)
    │
    ▼ AuthenticationMiddleware.on_message()
    │   → Extract & store auth header in FastMCP context
    │
    ▼ ExecutionLoggingMiddleware.on_call_tool()
    │   → POST /analytics/tool-executions (AI Engine) [status: running]
    │
    ▼ Tool function execution (e.g. get_products)
    │   → Shopify API call
    │
    ▼ ExecutionLoggingMiddleware.on_call_tool() (post)
    │   → PATCH /analytics/tool-executions/{id} [status: succeeded/failed]
    │
    ▼ FastMCP returns MCP ToolResult
    │
    ▼ Starlette returns HTTP 200 SSE response
```

---

## 2. Module Design

### 2.1 `main.py` — Application Entry Point

Responsibilities:
- Imports all MCP app instances
- Calls `.http_app()` on each FastMCP app to get Starlette-compatible ASGI apps
- Defines the application lifespan (registers workflow tools on startup)
- Composes all app lifespans via `combine_lifespans()`
- Creates and runs the Starlette application

### 2.2 `servers/<name>_mcp.py` — MCP Server Modules

Each server module follows the same pattern:

```python
from fastmcp import FastMCP
from servers.tools.<domain>.<module> import tool_function_1, tool_function_2
from servers.middlewares import AuthenticationMiddleware, ExecutionLoggingMiddleware

app = FastMCP("<Server Name> MCP", streamable_http_path="/")

app.tool(tool_function_1, meta={"ignitic_identifier": "tools.<agent>.<tool>"})
app.tool(tool_function_2, meta={"ignitic_identifier": "tools.<agent>.<tool>"})

app.add_middleware(AuthenticationMiddleware())
app.add_middleware(ExecutionLoggingMiddleware())
```

Key design decisions:
- `streamable_http_path="/"` makes the tool endpoint relative to the Starlette `Mount` prefix.
- Middleware is registered on each server independently (not at the Starlette level) so it operates within the FastMCP context that has tool metadata available.

### 2.3 `servers/tools/<domain>/` — Tool Implementations

Tool functions are pure async Python functions with type-annotated parameters and docstrings. FastMCP auto-generates the JSON Schema for each tool from its signature.

```python
async def get_products(
    limit: int = 50,
    page_info: Optional[str] = None,
) -> list[dict]:
    """
    Retrieve products from the Shopify store.

    Args:
        limit: Maximum number of products to return (1-250).
        page_info: Cursor for pagination.
    """
    # Tool implementation
    ...
```

### 2.4 `servers/middlewares.py` — Shared Middleware

Two middleware classes applied to every MCP server:

**`AuthenticationMiddleware`** (extends `fastmcp.server.middleware.Middleware`)
- Hook: `on_message()` — runs before any message type
- Uses `get_http_headers()` (FastMCP dependency) to read HTTP headers
- Stores `auth_header` and `chat_id` in the FastMCP request context via `fastmcp_context.set_state()`
- Raises `NotFoundError` (MCP error) if the header is missing

**`ExecutionLoggingMiddleware`** (extends `fastmcp.server.middleware.Middleware`)
- Hook: `on_call_tool()` — runs only for tool invocations
- Retrieves `auth_header` and `chat_id` from the FastMCP context
- Looks up the tool's `ignitic_identifier` via `fastmcp.get_tool(tool_name)`
- Calls `AIEngineClient.log_tool_execution()` before the tool runs
- Calls `AIEngineClient.update_tool_execution()` after the tool completes or fails
- Never blocks the tool on logging failures

### 2.5 `services/ai_engine_client.py` — AI Engine HTTP Client

Wraps HTTP calls to the AI Engine REST API:
- `log_tool_execution(tool_name, ignitic_identifier, chat_id, input_payload, ...)` → creates `ToolExecution` record
- `update_tool_execution(execution_id, status, response_payload, error)` → updates the record
- `get_workflow_templates()` → fetches workflow templates for dynamic tool registration
- `get_user_credentials(credential_type)` → retrieves user credentials for external API calls

### 2.6 `utils/dynamic_models.py` — Dynamic Pydantic Models

Generates Pydantic `BaseModel` subclasses at runtime from workflow template input schemas. This allows n8n workflow tools to have proper type-annotated parameters without code generation.

```python
def create_workflow_input_model(
    model_name: str,
    inputs: dict[str, WorkflowInput]
) -> type[BaseModel]:
    """Dynamically create a Pydantic model for workflow tool inputs."""
    ...
```

### 2.7 `utils/lifespan.py` — Lifespan Composition

`combine_lifespans(*lifespans)` takes an arbitrary number of async context managers and runs them sequentially in a single combined lifespan. This is needed because Starlette only accepts one `lifespan` argument on the app constructor.

---

## 3. Middleware Pipeline

### 3.1 Middleware Order

Middleware is applied in **reverse registration order** in FastMCP (last-added runs first):

```python
app.add_middleware(AuthenticationMiddleware())    # registered first → runs second
app.add_middleware(ExecutionLoggingMiddleware())  # registered second → runs first
```

Wait — FastMCP wraps middleware in the order they are added, so `AuthenticationMiddleware` wraps `ExecutionLoggingMiddleware`. The call order is:

```
AuthenticationMiddleware.on_message()
  → ExecutionLoggingMiddleware.on_call_tool()
       → actual tool function
```

This means authentication happens before logging, which is the correct order.

### 3.2 Context State Flow

```
HTTP request headers
       │
       ▼
AuthenticationMiddleware
  context.set_state("auth_header", ...)
  context.set_state("chat_id", ...)
       │
       ▼
ExecutionLoggingMiddleware
  auth = context.get_state("auth_header")
  chat_id = context.get_state("chat_id")
  AIEngineClient(auth=auth).log_tool_execution(...)
       │
       ▼
Tool function executes
  (tool retrieves user credentials from AI Engine using auth_header)
```

---

## 4. Tool Design Pattern

### 4.1 Tool Function Signature

```python
async def tool_name(
    param1: type,
    param2: Optional[type] = default,
    ctx: Context = None,  # FastMCP context (optional)
) -> return_type:
    """
    One-line summary.

    Detailed description of what the tool does.

    Args:
        param1: Description.
        param2: Description with default.

    Returns:
        Description of the return value.
    """
```

### 4.2 Credential Retrieval Pattern

Tools that need user credentials (e.g. Shopify token) retrieve them from the AI Engine:

```python
from fastmcp.server.dependencies import get_http_headers

async def get_products(limit: int = 50):
    headers = get_http_headers()
    auth_header = headers.get("Authorization")
    engine_client = AIEngineClient(auth=auth_header)
    credentials = await engine_client.get_user_credentials("shopify")
    # Use credentials to call Shopify API
```

### 4.3 Error Handling in Tools

Tools raise standard Python exceptions; FastMCP catches them and returns structured MCP error responses. Do not swallow exceptions — let FastMCP handle the error contract.

```python
async def create_product(name: str, price: float):
    if price < 0:
        raise ValueError("Price must be non-negative")
    # ...
```

### 4.4 Tool Registration

```python
app.tool(
    function,
    meta={
        "ignitic_identifier": "tools.<agent_identifier>.<function_name>",
        "is_workflow": False,              # True for n8n workflow tools
        "workflow_provider": "n8n",        # Only when is_workflow=True
    }
)
```

---

## 5. Dynamic Workflow Tools

### 5.1 Registration Flow

At startup, `register_workflow_tools()` in `servers/tools/workflow_tools.py`:
1. Calls the AI Engine's workflow template API to list all templates.
2. For each template, generates a Pydantic input model from `template.inputs`.
3. Creates a closure (async function) that invokes the template's webhook URL.
4. Registers the closure on the `/custom` MCP server with workflow metadata.

### 5.2 Tool Metadata for Workflows

```python
app.tool(
    workflow_fn,
    meta={
        "ignitic_identifier": f"tools.workflow.{template.ignitic_identifier}",
        "is_workflow": True,
        "workflow_provider": "n8n",
    }
)
```

### 5.3 Workflow Tool Invocation

```python
async def invoke_workflow(inputs: WorkflowInputModel) -> dict:
    session = await engine_client.create_workflow_session(template_id)
    response = await http_client.post(session.workflow_url, json=inputs.model_dump())
    return response.json()
```

---

## 6. Lifespan Composition

Each FastMCP `http_app()` returns a Starlette app with its own lifespan. The top-level application must run all lifespans to ensure each MCP server initializes and cleans up properly.

```python
app = Starlette(
    routes=[...],
    lifespan=combine_lifespans(
        lifespan,                         # MCP Server's own lifespan
        product_researcher_mcp_app.lifespan,
        business_analyst_mcp_app.lifespan,
        # ... all 15 apps
    )
)
```

`combine_lifespans` uses an `AsyncExitStack` to enter all lifespans sequentially on startup and exit them in reverse order on shutdown.

---

## 7. Security Design

### 7.1 JWT Flow

The AI Engine validates JWTs before calling the MCP Server. The MCP Server trusts the token is valid since it comes from the AI Engine, but still requires it to extract user context and forward to external APIs.

The `AuthenticationMiddleware` does **not** cryptographically verify the JWT. If direct external access to the MCP Server is possible, add JWT signature verification in the middleware.

### 7.2 Credential Isolation

- Third-party credentials (Shopify, HubSpot, etc.) are never stored on the MCP Server.
- At invocation time, the tool calls the AI Engine to retrieve credentials for the authenticated user.
- Credentials travel only in memory during a single request and are never logged.

### 7.3 Input Sanitization

- FastMCP/Pydantic validates all tool inputs against generated JSON schemas.
- String inputs used in external API calls should be validated at the tool level to prevent injection (e.g., product names used in GraphQL queries).

---

## 8. Error Handling

### 8.1 Tool Errors

```
Tool raises Python exception
       │
       ▼
FastMCP catches exception
       │
       ▼
ExecutionLoggingMiddleware (post-hook) logs failure
       │
       ▼
FastMCP returns MCP error response to AI Engine
       │
       ▼
AI Engine emits SSE "error" event to client
```

### 8.2 Logging Errors

If the AI Engine is unreachable when the middleware tries to log, the error is caught and logged to stderr. The tool execution continues normally — observability failures never block the user-facing tool call.

### 8.3 External API Errors

Tools should propagate meaningful error messages from external APIs:

```python
try:
    result = await shopify_client.get_products(limit=limit)
except ShopifyAPIError as e:
    raise RuntimeError(f"Shopify API error: {e.message} (code: {e.status_code})")
```
