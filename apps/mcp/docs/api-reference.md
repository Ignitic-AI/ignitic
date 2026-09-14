# API Reference
# Ignitic AI MCP Server

**Version:** 1.0  
**Status:** Active  
**Last Updated:** 2026-05-03

---

## Overview

The MCP Server is not a traditional REST API. It implements the **Model Context Protocol (MCP)** over the **Streamable HTTP transport** using FastMCP 2.x. Clients interact with it using the MCP protocol framing (JSON-RPC 2.0 messages) transported over HTTP + Server-Sent Events (SSE).

The primary consumer is the **Ignitic AI Engine**, which calls the MCP Server on behalf of authenticated users during LangGraph agent tool execution.

---

## Table of Contents

1. [Base URL and Ports](#1-base-url-and-ports)
2. [Authentication](#2-authentication)
3. [Transport](#3-transport)
4. [Server Endpoints](#4-server-endpoints)
5. [Health Endpoint](#5-health-endpoint)
6. [MCP Protocol Methods](#6-mcp-protocol-methods)
7. [Tool Invocation](#7-tool-invocation)
8. [Tool Response Format](#8-tool-response-format)
9. [Error Handling](#9-error-handling)
10. [Headers Reference](#10-headers-reference)

---

## 1. Base URL and Ports

| Environment | URL |
|-------------|-----|
| Local development | `http://localhost:8011` |
| Docker Compose internal | `http://mcp:8011` |

The server binds to `0.0.0.0` by default. The port is configured via the `PORT` environment variable.

---

## 2. Authentication

All MCP tool calls require a JWT Bearer token.

**Header:**

```
Authorization: Bearer <jwt>
```

**Token format:**

The JWT is issued by the Backend API (Go + Gin) and shares the same signing secret (`JWT_SECRET`) as the AI Engine. The MCP Server's `AuthenticationMiddleware` extracts the token from the HTTP header and stores it in the FastMCP request context so tool functions can forward it to the AI Engine for credential retrieval.

**Token claims used by the MCP Server:**

| Claim | Description |
|-------|-------------|
| `user_id` | Unique user identifier |
| `email` | User's email address |
| `role` | `admin` or `user` |
| `org_id` | Organisation identifier (optional) |

The MCP Server **does not independently validate JWT signatures** — it relies on the AI Engine having already authenticated the user before forwarding calls.

**Optional correlation header:**

```
X-Chat-ID: <chat_session_id>
```

When present, this header is attached to tool execution log records so that all tool calls within a chat session can be correlated.

---

## 3. Transport

The MCP Server uses the **Streamable HTTP transport** (FastMCP's `streamable_http_path`).

- **Protocol:** HTTP/1.1
- **Method:** `POST` for tool calls and JSON-RPC requests
- **Streaming:** Server-Sent Events (SSE) are used to stream tool results back to the caller when the result is large or streamed
- **Content-Type:** `application/json` (request); `text/event-stream` (SSE response)

The transport is compatible with the MCP specification's HTTP transport layer and supports the MCP 1.x JSON-RPC framing.

---

## 4. Server Endpoints

Each domain-specific MCP server is mounted at a dedicated path. The path values come from the `Agent` enum in `models/agent.py`.

| MCP Server | Mount Path | Tool Count |
|-----------|------------|-----------|
| Product Researcher | `/product_researcher` | 8 |
| Business Analyst | `/business_analyst` | 7 |
| Marketer | `/marketer` | 4 |
| SEO Agent | `/seo_agent` | 3 |
| Shopify Agent | `/shopify_agent` | 6 |
| HubSpot Agent | `/hubspot_agent` | 34 |
| Google Drive Agent | `/gdrive_agent` | 13 |
| Facebook Page Agent | `/facebook_page_agent` | 8 |
| Instagram Agent | `/instagram_agent` | 4 |
| Email Marketing Agent | `/email_marketing_agent` | 42 |
| Customer Support Agent | `/customer_support_agent` | 15 |
| Analytics Agent | `/analytics_agent` | 10 |
| Meta Ads Agent | `/meta_ads_agent` | 13 |
| Google Ads Agent | `/google_ads_agent` | 14 |
| Custom | `/custom` | 155+ (static) + dynamic n8n tools |

---

## 5. Health Endpoint

The health endpoint is available without authentication and is used by container health checks and load balancers.

### `GET /health`

**Request:**

```http
GET /health HTTP/1.1
Host: localhost:8011
```

**Response:**

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "ok",
  "service": "mcp",
  "version": "1.0.0"
}
```

---

## 6. MCP Protocol Methods

The MCP Server handles the standard MCP JSON-RPC 2.0 methods. These are called by the FastMCP client in the AI Engine.

### `tools/list`

List all tools registered on a specific MCP server.

**Request:**

```http
POST /shopify_agent
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response:**

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "get_products",
        "description": "Retrieve products from the Shopify store.",
        "inputSchema": {
          "type": "object",
          "properties": {
            "limit": {
              "type": "integer",
              "description": "Maximum number of products to return (1-250).",
              "default": 50
            },
            "page_info": {
              "type": "string",
              "description": "Cursor for pagination.",
              "default": null
            }
          }
        },
        "meta": {
          "ignitic_identifier": "tools.shopify_agent.get_products",
          "is_workflow": false,
          "workflow_provider": "n8n"
        }
      }
    ]
  }
}
```

### `tools/call`

Invoke a specific tool.

**Request:**

```http
POST /shopify_agent
Authorization: Bearer <jwt>
X-Chat-ID: chat_abc123
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_products",
    "arguments": {
      "limit": 10
    }
  }
}
```

**Response (success):**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "[{\"id\": 1234, \"title\": \"Sample Product\", ...}]"
      }
    ],
    "isError": false
  }
}
```

**Response (tool error):**

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Shopify API error: Invalid API key (code: 401)"
      }
    ],
    "isError": true
  }
}
```

### `initialize`

Sent by the MCP client on connection to negotiate protocol version and capabilities.

```json
{
  "jsonrpc": "2.0",
  "id": 0,
  "method": "initialize",
  "params": {
    "protocolVersion": "2024-11-05",
    "capabilities": {},
    "clientInfo": { "name": "ai-engine", "version": "1.0.0" }
  }
}
```

---

## 7. Tool Invocation

### Request Structure

Every tool call is a `tools/call` JSON-RPC request with:

```json
{
  "method": "tools/call",
  "params": {
    "name": "<tool_name>",
    "arguments": { ...tool_parameters... }
  }
}
```

Tool parameters are validated against the JSON Schema defined by the tool's function signature (via FastMCP + Pydantic). Invalid inputs are rejected before the tool function runs.

### Middleware Execution Order

Before the tool function runs, the following middleware executes in order:

1. **`AuthenticationMiddleware.on_message()`**
   - Extracts `Authorization` header → stores as `auth_header` in context
   - Extracts `X-Chat-ID` header → stores as `chat_id` in context
   - Raises `NotFoundError` if `Authorization` header is missing

2. **`ExecutionLoggingMiddleware.on_call_tool()`** (pre-execution)
   - Resolves `ignitic_identifier` from the tool's registered metadata
   - Calls `POST /api/v1/analytics/tool/executions` on the AI Engine
   - Records status: `running`

3. **Tool function executes**

4. **`ExecutionLoggingMiddleware.on_call_tool()`** (post-execution)
   - On success: calls `PATCH /api/v1/analytics/tool/executions/{id}` with status: `succeeded`
   - On failure: calls `PATCH /api/v1/analytics/tool/executions/{id}` with status: `failed`
   - Logging failures never block the tool result from being returned

---

## 8. Tool Response Format

FastMCP wraps all tool return values in a `ToolResult` object with the following structure:

### Text Response

```json
{
  "content": [
    {
      "type": "text",
      "text": "...tool output as string..."
    }
  ],
  "isError": false
}
```

### Structured Response

When a tool returns a dict or Pydantic model:

```json
{
  "structured_content": { ...tool output as JSON object... },
  "content": [
    {
      "type": "text",
      "text": "...text representation..."
    }
  ],
  "isError": false
}
```

### Error Response

When a tool raises an unhandled exception:

```json
{
  "content": [
    {
      "type": "text",
      "text": "...error message..."
    }
  ],
  "isError": true
}
```

---

## 9. Error Handling

### MCP-Level Errors

| Error Type | When Raised | HTTP Effect |
|-----------|-------------|------------|
| `NotFoundError` | Missing `Authorization` header | MCP error response |
| `NotFoundError` | Tool not found | MCP error response |
| `ToolError` | Explicit tool business logic error | MCP `isError: true` result |
| Unhandled exception | Unexpected tool failure | MCP `isError: true` result |

### HTTP-Level Errors

The Starlette routing layer returns standard HTTP errors for:

| Code | Condition |
|------|-----------|
| `404` | Path not mounted (e.g., `/nonexistent`) |
| `405` | Wrong HTTP method (e.g., `GET` on a tool endpoint) |
| `500` | Unhandled Starlette-level exception |

### External API Errors

Tool functions catch errors from external APIs and re-raise them as descriptive `RuntimeError` or `ToolError` exceptions with the provider's error message and status code included.

---

## 10. Headers Reference

### Request Headers

| Header | Type | Required | Description |
|--------|------|----------|-------------|
| `Authorization` | `string` | Yes | `Bearer <jwt>` — user JWT from Backend API |
| `X-Chat-ID` | `string` | No | Chat session ID for execution log correlation |
| `Content-Type` | `string` | Yes | Must be `application/json` |

### Response Headers

| Header | Value | Description |
|--------|-------|-------------|
| `Content-Type` | `application/json` or `text/event-stream` | Standard response or SSE stream |

### Case Insensitivity

Headers are matched case-insensitively. Both `Authorization` and `authorization` are accepted. Both `X-Chat-ID` and `x-chat-id` are accepted.

---

## AI Engine Internal API (called by MCP Server)

The MCP Server makes outbound HTTP calls to the AI Engine. These are internal service-to-service calls authenticated with a machine-generated JWT (`mcp@igniticai.com`).

### Tool Execution Logging

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/analytics/tool/executions` | Create a tool execution record |
| `PATCH` | `/api/v1/analytics/tool/executions/{id}` | Update execution status and result |

### Workflow Templates

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/workflow-template/?limit=0` | Fetch all workflow templates at startup |
| `POST` | `/api/v1/workflow-session/` | Create a workflow session (get webhook URL) |

### Credentials

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/credential/{credential_name}` | Retrieve user credential by type |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/chat/{chat_id}/messages` | Retrieve chat messages |
