# Software Requirements Specification (SRS)
# Ignitic AI Engine

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

This document specifies the software requirements for the **Ignitic AI Engine** — the AI orchestration service in the Ignitic AI platform. It is intended for engineers, architects, and stakeholders who design, build, or maintain the service.

### 1.2 Scope

The AI Engine provides:
- A multi-agent AI orchestration runtime (LangGraph)
- A REST API consumed by the Ignitic Backend and Frontend
- Integration with the MCP Server for tool execution
- n8n workflow lifecycle management
- Multi-layered memory (short-term checkpoints, summarization, long-term knowledge graph, vector search)
- Analytics capture for agent runs and tool executions
- RabbitMQ consumers for asynchronous processing

The AI Engine does **not** handle: user authentication issuance (delegated to the Backend API), UI rendering, or billing.

### 1.3 Definitions

| Term | Definition |
|------|-----------|
| Agent | A LangGraph ReAct node backed by an LLM and a set of tools |
| Super Agent | The implicit root orchestrator that receives all user messages |
| Worker Agent | A specialist agent called by a parent orchestrator |
| Thread | A single conversation session identified by `thread_id` |
| Chat | A MongoDB document grouping a thread with its user and agents |
| Workflow Template | A reusable n8n workflow definition stored in the system |
| Deployed Workflow | An instance of a workflow template running in n8n |
| Workflow Session | An ephemeral (5-minute TTL) deployment for a single tool invocation |
| MCP | Model Context Protocol — the standard for exposing tools to LLMs |
| Checkpointer | MongoDB-backed LangGraph state persistence layer |
| Graphiti | A Neo4j-based knowledge graph for long-term agent memory |

### 1.4 References

- [Software Design Specification](SDS.md)
- [Database Schema](database-schema.md)
- [API Reference](api-reference.md)
- [Deployment Guide](deployment.md)
- [MCP Server SRS](../../mcp/docs/SRS.md)

---

## 2. Overall Description

### 2.1 Product Perspective

The AI Engine is one of four backend services in the Ignitic platform:

```
Frontend (Next.js) ──▶ Backend API (Go+Gin) ──▶ AI Engine (FastAPI)
                                                        │
                                                 MCP Server (FastMCP)
                                                        │
                                          External APIs (Shopify, HubSpot, …)
```

The AI Engine exposes a REST API. All endpoints require a valid JWT token issued by the Backend API; the AI Engine validates these tokens locally using the shared `JWT_SECRET`.

### 2.2 Product Functions (Summary)

- Create and manage AI agents (prebuilt and custom)
- Run conversational AI threads with streaming responses
- Manage n8n workflow templates, deployments, and sessions
- Store and retrieve credentials for automation integrations
- Track agent run analytics (tokens, cost, duration)
- Track tool execution results
- Process background tasks via RabbitMQ

### 2.3 User Classes and Characteristics

| User Class | Description |
|-----------|-------------|
| E-commerce Operator | Uses the Frontend to chat with agents and manage automations |
| SaaS Admin | Manages workflow templates and system health |
| Developer | Integrates via the SDK or direct API calls |
| Agent (automated) | The AI agents themselves call sub-agents and tools |

### 2.4 Operating Environment

- Python 3.12 runtime in Docker (linux/amd64)
- AWS ECS (Fargate or EC2 launch type)
- MongoDB Atlas or self-hosted MongoDB 6+
- Neo4j 5+ (optional, for Graphiti long-term memory)
- RabbitMQ 3.12+
- n8n instance accessible over HTTP

---

## 3. Functional Requirements

### 3.1 Agent Management

| ID | Requirement |
|----|-------------|
| FR-AGT-01 | The system shall expose CRUD endpoints for AI agents scoped to a user (`u_id`) or organization (`org_id`). |
| FR-AGT-02 | The system shall support prebuilt agents with immutable base configurations (name, description, system prompt) that may be overridden per user. |
| FR-AGT-03 | The system shall support custom agents with user-supplied name, description, system prompt, type (`orchestrator`/`worker`), parent agent, and tool allowlist. |
| FR-AGT-04 | The system shall detect and reject any agent hierarchy containing a cycle before building a graph. |
| FR-AGT-05 | The system shall allow resetting a prebuilt agent to its factory defaults. |
| FR-AGT-06 | The system shall allow adding, removing, and updating tags on agents. |
| FR-AGT-07 | The system shall list available MCP tools for use when configuring custom agents. |

### 3.2 Chat and Streaming

| ID | Requirement |
|----|-------------|
| FR-CHT-01 | The system shall create a new chat session associating a `thread_id`, `u_id`, and one or more agent identifiers. |
| FR-CHT-02 | The system shall stream agent responses as Server-Sent Events (SSE) with structured event types (token, thinking, agent_transfer, tool_call, error, done). |
| FR-CHT-03 | The system shall persist all messages (human and AI) to the `chat_messages` collection, deduplicated by `message_id`. |
| FR-CHT-04 | The system shall support multi-modal input: text, images (base64 or URL), and file attachments (PDF, DOCX, PPTX, XLSX). |
| FR-CHT-05 | The system shall support sharing a chat via an opaque, revocable token (`ChatShare`). |
| FR-CHT-06 | The system shall return paginated message history for a given chat. |
| FR-CHT-07 | The system shall apply a `SummarizationNode` to compress conversation history when the context approaches the model's token limit. |

### 3.3 Memory

| ID | Requirement |
|----|-------------|
| FR-MEM-01 | The system shall persist LangGraph state (messages, agent stack) in MongoDB using `AsyncMongoDBSaver` under the `chat_checkpoints` collection. |
| FR-MEM-02 | The system shall maintain a running summary of conversation history to limit context growth. |
| FR-MEM-03 | The system shall optionally connect to a Graphiti (Neo4j) knowledge graph for long-term entity memory. |
| FR-MEM-04 | The system shall store asset document embeddings in a MongoDB Atlas vector store for semantic retrieval. |

### 3.4 n8n Workflow Templates

| ID | Requirement |
|----|-------------|
| FR-WFT-01 | On startup, the system shall sync all JSON files from `assets/workflow_templates/n8n/` into the `n8n_workflow_templates` collection. |
| FR-WFT-02 | The system shall expose CRUD endpoints for workflow templates. |
| FR-WFT-03 | The system shall reject any n8n workflow whose trigger node is not `n8n-nodes-base.webhook`. |
| FR-WFT-04 | The system shall support importing a raw n8n workflow JSON and wrapping it as a template. |

### 3.5 n8n Workflow Deployment

| ID | Requirement |
|----|-------------|
| FR-WFD-01 | The system shall deploy a workflow template to an n8n instance and record a `DeployedWorkflow` document with user/org scope. |
| FR-WFD-02 | The system shall activate and deactivate deployed workflows via the n8n API. |
| FR-WFD-03 | The system shall delete a deployed workflow from both n8n and the database. |
| FR-WFD-04 | The system shall list deployed workflows scoped to the authenticated user or org. |

### 3.6 Workflow Sessions

| ID | Requirement |
|----|-------------|
| FR-WFS-01 | The system shall create ephemeral workflow sessions with a 5-minute TTL for tool invocations. |
| FR-WFS-02 | The system shall extend a session's TTL on activity. |
| FR-WFS-03 | The system shall track in-progress execution counts per session. |
| FR-WFS-04 | The system shall clean up expired sessions and their n8n workflow deployments. |

### 3.7 Credential Management

| ID | Requirement |
|----|-------------|
| FR-CRD-01 | The system shall store SMTP credentials encrypted with Fernet symmetric encryption. |
| FR-CRD-02 | The system shall register credentials with n8n and store the resulting n8n credential ID. |
| FR-CRD-03 | The system shall provide CRUD endpoints for credentials scoped to user or org. |

### 3.8 Analytics

| ID | Requirement |
|----|-------------|
| FR-ANL-01 | The system shall record an `AgentRun` document for every agent invocation, capturing agent identifier, model, token counts, cost, and duration. |
| FR-ANL-02 | The system shall record a `ToolExecution` document for every MCP tool call, capturing tool name, input payload, response payload, and status. |
| FR-ANL-03 | The system shall expose paginated query endpoints for agent runs and tool executions. |

### 3.9 Asset Handling

| ID | Requirement |
|----|-------------|
| FR-AST-01 | The system shall receive asset upload notifications via RabbitMQ and process documents asynchronously. |
| FR-AST-02 | The system shall chunk and embed documents (PDF, DOCX, PPTX, XLSX, TXT) into the MongoDB vector store. |
| FR-AST-03 | The system shall support vector similarity search within a user's or organization's asset namespace. |

### 3.10 Health and Observability

| ID | Requirement |
|----|-------------|
| FR-OBS-01 | The system shall expose `/health` returning service name, version, and RMQ service status. |
| FR-OBS-02 | The system shall expose `/health/rmq` returning per-service RabbitMQ consumer status. |
| FR-OBS-03 | The system shall log all agent runs and tool calls to Langfuse/LangSmith when configured. |
| FR-OBS-04 | The system shall report errors to Sentry when `SENTRY_DSN` is configured. |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID | Requirement |
|----|-------------|
| NFR-PERF-01 | Streaming first-token latency should be under 3 seconds under normal load. |
| NFR-PERF-02 | API endpoints (non-streaming) should respond within 500 ms at the 95th percentile under typical load. |
| NFR-PERF-03 | The system shall use async/await throughout to avoid blocking the event loop. |

### 4.2 Scalability

| ID | Requirement |
|----|-------------|
| NFR-SCAL-01 | The application shall be stateless (state stored in MongoDB); multiple instances shall be deployable behind a load balancer. |
| NFR-SCAL-02 | The RabbitMQ consumer model shall allow horizontal scaling by increasing ECS task count. |

### 4.3 Security

| ID | Requirement |
|----|-------------|
| NFR-SEC-01 | All API endpoints (except `/`, `/health`, `/docs`) shall require a valid HS256 JWT token in the `Authorization: Bearer` header. |
| NFR-SEC-02 | All credential secrets shall be encrypted at rest using Fernet before database storage. |
| NFR-SEC-03 | CORS shall be configured to restrict origins in production (currently allows all — must be tightened). |
| NFR-SEC-04 | Database connection strings and API keys shall never be committed to source control. |
| NFR-SEC-05 | JWT secrets and Fernet keys shall be at least 32 bytes and rotated according to the organization's key management policy. |

### 4.4 Reliability

| ID | Requirement |
|----|-------------|
| NFR-REL-01 | The service shall start a graceful shutdown on SIGTERM with a 5-second drain period. |
| NFR-REL-02 | Failed RabbitMQ connections shall be retried with exponential backoff. |
| NFR-REL-03 | The ECS health check (`/health`) shall be queried every 15 seconds; 3 consecutive failures shall trigger a replacement task. |

### 4.5 Maintainability

| ID | Requirement |
|----|-------------|
| NFR-MNT-01 | Business logic shall live in `services/`; HTTP concern shall be confined to `api/`. |
| NFR-MNT-02 | All document models shall use Beanie and Pydantic v2 schemas with field descriptions. |
| NFR-MNT-03 | All routes shall be versioned under `/api/v1`. |

### 4.6 Portability

| ID | Requirement |
|----|-------------|
| NFR-PRT-01 | The application shall run on any platform that supports Docker (linux/amd64 primary target). |
| NFR-PRT-02 | All platform-specific dependencies (`pywin32`) shall be conditionally installed by OS. |

---

## 5. External Interface Requirements

### 5.1 Backend API

- **Protocol:** HTTP/HTTPS REST
- **Authentication:** Service-to-service calls use the user's JWT forwarded by the Frontend
- **Purpose:** Validate users and organizations; retrieve org membership; fetch asset metadata

### 5.2 MCP Server

- **Protocol:** HTTP (Streamable HTTP Transport)
- **Authentication:** JWT bearer token passed via the `Authorization` header
- **Purpose:** Provide tools (Shopify, HubSpot, Google, Meta, etc.) to agent nodes

### 5.3 n8n

- **Protocol:** HTTP REST (n8n API v1)
- **Authentication:** n8n API key (`N8N_API_KEY`)
- **Purpose:** Create, activate, execute, and delete automation workflows

### 5.4 MongoDB

- **Protocol:** MongoDB Wire Protocol (via Motor async driver)
- **Purpose:** Persistent storage for all application data

### 5.5 RabbitMQ

- **Protocol:** AMQP 0-9-1 (via aio-pika)
- **Purpose:** Async message passing for agent processing and asset notifications

### 5.6 Neo4j / Graphiti

- **Protocol:** Bolt (via neo4j Python driver, wrapped by Graphiti)
- **Purpose:** Long-term knowledge-graph memory for agents

### 5.7 OpenRouter

- **Protocol:** OpenAI-compatible HTTP API
- **Purpose:** LLM inference routing to multiple model providers

---

## 6. System Constraints

- The system requires Python 3.12 or later.
- The `uv` package manager is used for dependency management; `pip` is used only for installing `uv` in Docker.
- LangGraph version must remain compatible with `langgraph-checkpoint-mongodb` and `langgraph-store-mongodb`.
- The n8n integration requires workflows to begin with a webhook trigger node.
- Graphiti long-term memory is optional; the system degrades gracefully when Neo4j is unavailable.

---

## 7. Assumptions and Dependencies

| # | Assumption / Dependency |
|---|------------------------|
| A1 | A valid JWT issued by the Backend API is always available to the caller before contacting the AI Engine. |
| A2 | The MCP Server is deployed and accessible at the URL specified by `MCP_SERVER_URL`. |
| A3 | The n8n instance has the API enabled and an API key is provisioned. |
| A4 | MongoDB Atlas or a compatible MongoDB 6+ instance is available and accessible. |
| A5 | RabbitMQ is available for the asset and agent message queues; the application may start without it but background processing will be unavailable. |
| A6 | OpenRouter API key is valid and has sufficient credits for the configured LLM models. |
| A7 | The Backend API exposes endpoints for user validation and org membership that the AI Engine can call. |
