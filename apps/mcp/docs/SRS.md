# Software Requirements Specification (SRS)
# Ignitic AI MCP Server

**Version:** 1.0  
**Status:** Active  
**Last Updated:** 2026-05-03

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [Functional Requirements](#3-functional-requirements)
4. [Non-Functional Requirements](#4-non-functional-requirements)
5. [External Interface Requirements](#5-external-interface-requirements)
6. [System Constraints](#6-system-constraints)
7. [Assumptions and Dependencies](#7-assumptions-and-dependencies)

---

## 1. Introduction

### 1.1 Purpose

This document specifies the software requirements for the **Ignitic AI MCP Server** — the tool-exposure service in the Ignitic AI platform. It is intended for engineers, architects, and stakeholders who design, build, or maintain the service.

### 1.2 Scope

The MCP Server:
- Implements the Model Context Protocol (MCP) using FastMCP to expose tools to AI agents
- Provides domain-specific tool sets for e-commerce operations (Shopify, HubSpot, SEO, social media, analytics, etc.)
- Enforces authentication on every tool call
- Logs every tool invocation to the AI Engine for observability
- Dynamically registers n8n workflow tools at startup

The MCP Server does **not** handle: user registration, database management, agent orchestration, or LLM inference.

### 1.3 Definitions

| Term | Definition |
|------|-----------|
| MCP | Model Context Protocol — standard for exposing tools to LLM agents |
| FastMCP | Python framework for building MCP servers |
| Tool | A Python function exposed via MCP that an agent can invoke |
| MCP Server | A FastMCP app instance serving a set of related tools |
| Ignitic Identifier | Dot-separated string uniquely identifying a tool (e.g. `tools.shopify_agent.get_products`) |
| Middleware | FastMCP layer that wraps all message handling (auth, logging) |
| Streamable HTTP | MCP transport using HTTP + SSE |

### 1.4 References

- [MCP Server SDS](SDS.md)
- [MCP API Reference](api-reference.md)
- [MCP Testing Guide](testing.md)
- [MCP Deployment Guide](deployment.md)
- [AI Engine SRS](../../ai-engine/docs/SRS.md)

---

## 2. Overall Description

### 2.1 Product Perspective

The MCP Server is called exclusively by the AI Engine's `MCPClientService` during agent tool execution. No user-facing application calls the MCP Server directly.

```
AI Engine ──(HTTP Streamable)──▶ MCP Server ──▶ External APIs
                                  (FastMCP)      (Shopify, HubSpot, …)
```

### 2.2 Product Functions (Summary)

- Serve 15 domain-specific MCP tool sets
- Authenticate every request via JWT
- Log tool invocations (start, success, failure) to the AI Engine
- Dynamically expose n8n workflow tools as MCP tools
- Health check endpoint for container orchestration

### 2.3 Operating Environment

- Python 3.12 runtime in Docker (linux/amd64)
- AWS ECS (same cluster as the AI Engine)
- Accessible by AI Engine over the internal VPC network
- Port 8011 (internal)

---

## 3. Functional Requirements

### 3.1 MCP Server Serving

| ID | Requirement |
|----|-------------|
| FR-SRV-01 | The system shall mount 15 named MCP servers at distinct URL paths under the root Starlette app. |
| FR-SRV-02 | The system shall expose a `/health` endpoint returning `{ "status": "ok" }` without authentication. |
| FR-SRV-03 | Each MCP server shall use the Streamable HTTP transport (SSE-based). |
| FR-SRV-04 | All server lifespans shall be composed into a single application lifespan via `combine_lifespans`. |

### 3.2 Authentication

| ID | Requirement |
|----|-------------|
| FR-AUTH-01 | Every tool call shall require an `Authorization: Bearer <jwt>` HTTP header. |
| FR-AUTH-02 | The `AuthenticationMiddleware` shall extract and store the auth header in the FastMCP request context. |
| FR-AUTH-03 | Requests missing the `Authorization` header shall receive a `NotFoundError` (MCP error response). |
| FR-AUTH-04 | The MCP Server shall not validate JWT signatures itself — token validation is handled by the AI Engine, which only calls the MCP Server with valid tokens forwarded from its own authenticated context. |

### 3.3 Tool Execution Logging

| ID | Requirement |
|----|-------------|
| FR-LOG-01 | The `ExecutionLoggingMiddleware` shall call the AI Engine's tool execution logging API before every tool invocation, recording status `running`. |
| FR-LOG-02 | On successful tool completion, the middleware shall update the execution record to `succeeded` with the response payload. |
| FR-LOG-03 | On tool failure, the middleware shall update the execution record to `failed` with the error message. |
| FR-LOG-04 | Logging failures shall not block tool execution — errors in the logging path shall be caught and logged but not re-raised. |
| FR-LOG-05 | Each tool shall declare an `ignitic_identifier` in its registration metadata. The middleware shall resolve this identifier and include it in the execution log. |

### 3.4 Shopify Tools

| ID | Requirement |
|----|-------------|
| FR-SHOP-01 | The Shopify MCP server shall provide tools to create, read, update, and delete Shopify products. |
| FR-SHOP-02 | The Shopify MCP server shall provide tools to publish and unpublish products. |
| FR-SHOP-03 | Shopify API credentials shall be sourced from the authenticated user's stored credentials, retrieved via the AI Engine. |

### 3.5 HubSpot Tools

| ID | Requirement |
|----|-------------|
| FR-HUB-01 | The HubSpot MCP server shall provide tools for contacts, companies, deals, tickets, and notes. |
| FR-HUB-02 | Tools shall support batch operations, search, and association management. |
| FR-HUB-03 | The server shall support pipeline, properties, and owner management endpoints. |

### 3.6 Product Research Tools

| ID | Requirement |
|----|-------------|
| FR-PRD-01 | The product researcher server shall support Amazon product search via Apify. |
| FR-PRD-02 | The server shall support eBay product scraping via Apify. |
| FR-PRD-03 | The server shall support Google Dorks advanced search. |
| FR-PRD-04 | The server shall provide Google Trends analysis via PyTrends. |

### 3.7 Marketing and Social Media Tools

| ID | Requirement |
|----|-------------|
| FR-MKT-01 | The Facebook Page server shall support creating posts and reading page insights. |
| FR-MKT-02 | The Instagram server shall support posting content and reading account insights. |
| FR-MKT-03 | The email marketing server shall support Brevo and Mailchimp contact and campaign management. |
| FR-MKT-04 | The Meta Ads server shall support campaign and ad set management. |
| FR-MKT-05 | The Google Ads server shall support campaign management and keyword planning. |

### 3.8 Analytics Tools

| ID | Requirement |
|----|-------------|
| FR-ANL-01 | The analytics server shall provide Shopify revenue and customer metrics. |
| FR-ANL-02 | The analytics server shall provide Google Analytics 4 traffic and conversion data. |

### 3.9 Custom Workflow Tools

| ID | Requirement |
|----|-------------|
| FR-CUS-01 | On startup, the custom MCP server shall call the AI Engine to retrieve all active workflow templates. |
| FR-CUS-02 | For each workflow template, the server shall dynamically generate a Pydantic model matching the template's input schema. |
| FR-CUS-03 | Each workflow tool shall invoke the corresponding n8n webhook URL with the provided inputs. |
| FR-CUS-04 | The tool list shall be refreshable without restarting the server. |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-PERF-01 | Tool invocations should complete within 30 seconds for tools making external API calls. |
| NFR-PERF-02 | The server startup (all 15 MCP apps + lifespan) shall complete within 15 seconds. |

### 4.2 Scalability

| ID | Requirement |
|----|-------------|
| NFR-SCAL-01 | The application shall be stateless; multiple instances shall be deployable behind a load balancer. |
| NFR-SCAL-02 | All tool functions shall use async/await to avoid blocking the event loop on I/O. |

### 4.3 Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-01 | Third-party API credentials (Shopify tokens, HubSpot keys, etc.) shall never be stored in the MCP Server — they shall be retrieved at tool invocation time from the AI Engine on behalf of the authenticated user. |
| NFR-SEC-02 | The `Authorization` header shall be forwarded to external APIs only when the destination API requires it. |
| NFR-SEC-03 | No secrets shall be committed to source control. |

### 4.4 Reliability

| ID | Requirement |
|----|-------------|
| NFR-REL-01 | Tool failures shall be caught and returned as structured MCP error responses, not unhandled exceptions. |
| NFR-REL-02 | The server shall handle graceful shutdown with a 5-second drain period. |

### 4.5 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-MNT-01 | Each tool domain shall be isolated in its own `servers/tools/<domain>/` subdirectory. |
| NFR-MNT-02 | Adding a new tool shall require only: creating the tool function, registering it on the appropriate MCP app, and running tests. |
| NFR-MNT-03 | All tool registrations shall include an `ignitic_identifier` metadata field. |

---

## 5. External Interface Requirements

### 5.1 AI Engine

- **Protocol:** HTTP
- **Direction:** AI Engine → MCP Server (tool calls); MCP Server → AI Engine (logging)
- **Purpose:** Tool invocation and execution logging

### 5.2 Shopify

- **Protocol:** Shopify REST Admin API
- **Authentication:** Private app token
- **Library:** `shopifyapi` (Python Shopify SDK)

### 5.3 HubSpot

- **Protocol:** HubSpot REST API v3
- **Authentication:** Private app token

### 5.4 Google APIs

- **Protocol:** Google REST APIs
- **Authentication:** OAuth2 service account or user credentials
- **Libraries:** `google-api-python-client`, `google-auth`

### 5.5 Meta / Facebook

- **Protocol:** Facebook Graph API
- **Authentication:** Page access token

### 5.6 Apify

- **Protocol:** Apify REST API
- **Authentication:** Apify API token
- **Library:** `apify-client`

### 5.7 Email Marketing Platforms

- **Brevo:** REST API, authentication via API key
- **Mailchimp:** REST API, authentication via API key

### 5.8 Zendesk

- **Protocol:** Zendesk REST API
- **Authentication:** Email + API token (Basic auth)

---

## 6. System Constraints

- Python 3.12 or later is required.
- FastMCP 2.x API must be maintained; version upgrades require testing all middleware.
- The MCP Server shares models with the AI Engine; the `ai-engine/` directory is copied into the MCP container at build time.
- Tool functions must be `async` to prevent blocking the Starlette/uvicorn event loop.

---

## 7. Assumptions and Dependencies

| # | Assumption / Dependency |
|---|------------------------|
| A1 | The AI Engine is reachable at `AI_ENGINE_URL` from the MCP Server. |
| A2 | Each user's third-party credentials (Shopify, HubSpot, etc.) are stored in the AI Engine/Backend and returned when queried with a valid JWT. |
| A3 | Apify API tokens are provisioned and stored as user credentials for product research tools. |
| A4 | Google service account credentials are provided as environment variables or mounted secrets for Google Drive and Ads tools. |
| A5 | The custom workflow tool list is populated before any agent calls `/custom` tools. |
