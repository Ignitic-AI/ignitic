# Ignitic AI Engine — Project Introduction

## Overview

The **AI Engine** is the central intelligence layer of the Ignitic AI platform — a real-time SaaS application designed to streamline e-commerce operations through agentic AI automation. It is built with **FastAPI** and **LangGraph**, and provides an HTTP API that orchestrates a hierarchy of AI agents capable of performing end-to-end tasks across sales, marketing, customer support, product research, and more.

The AI Engine sits between the Ignitic frontend and the external world. It manages long-running agent conversations, maintains short- and long-term memory, connects to external tools via the [MCP Server](../../mcp/docs/introduction.md), and triggers n8n automation workflows on behalf of users.

---

## Context in the Ignitic Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        Ignitic AI Platform                               │
│                                                                          │
│  ┌──────────────┐     ┌──────────────────┐     ┌─────────────────────┐  │
│  │  Frontend    │────▶│  Backend API     │────▶│   AI Engine         │  │
│  │  (Next.js)   │◀────│  (Go + Gin)      │◀────│   (FastAPI +        │  │
│  │              │     │  Auth, Orgs,     │     │    LangGraph)       │  │
│  │  SPA         │     │  Assets, Logs    │     │                     │  │
│  └──────────────┘     └──────────────────┘     └────────┬────────────┘  │
│                                                          │               │
│                        ┌─────────────────────────────────▼────────────┐  │
│                        │          MCP Server (FastMCP)                │  │
│                        │  Shopify │ HubSpot │ Google │ Meta │ …       │  │
│                        └──────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

| Component       | Technology          | Role                                              |
|-----------------|---------------------|---------------------------------------------------|
| Frontend SPA    | Next.js             | Session management and user interface             |
| Backend API     | Go + Gin            | Auth, organizations, assets, secrets, audit logs  |
| **AI Engine**   | **FastAPI + LangGraph** | **Agent orchestration, memory, workflows**    |
| MCP Server      | FastMCP + Starlette | Tool exposure for LLM agents                      |
| Ignitic SDK     | Go / Python         | Developer SDK for programmatic access             |

---

## Purpose and Goals

The AI Engine was created to replace brittle sequential automations with a single, intelligent orchestration layer. Its goals are:

1. **Agent-driven automation** — A configurable hierarchy of specialist agents (Shopify, HubSpot, SEO, Marketer, …) can autonomously complete multi-step e-commerce tasks.
2. **Memory across sessions** — Short-term memory via MongoDB checkpoints and long-term memory via Graphiti (Neo4j knowledge graph) so agents learn about the business over time.
3. **Workflow integration** — Native support for deploying, managing, and invoking n8n automation workflows as agent tools.
4. **Multi-tenancy** — Full user and organization scoping throughout the data model.
5. **Observability** — Token usage, cost, and tool execution tracking so operators can monitor AI spend.

---

## Core Capabilities

### Agent Orchestration
A **Super Agent** acts as a root orchestrator that delegates tasks to a set of specialist worker agents. Each agent is backed by:
- A configurable system prompt
- A set of MCP tools (scoped to its domain)
- Shared graph state (messages, memory context)

The agent topology is a **directed acyclic graph** where orchestrators can have sub-orchestrators and workers. Cycle detection is enforced at runtime.

### Prebuilt Agents
| Agent | Type | Domain |
|-------|------|--------|
| Product Researcher | Worker | Market and product research |
| Business Analyst | Worker | Unit economics, feasibility, scenarios |
| Marketer | **Orchestrator** | Social marketing (parent of Facebook, Instagram, Email) |
| SEO Agent | Worker | Domain authority and SEO recommendations |
| Google Drive Agent | Worker | File read/write via Google Drive |
| Shopify Agent | Worker | Product, order, and customer management |
| HubSpot Agent | Worker | CRM — contacts, deals, tickets, pipelines |
| Facebook Page Agent | Worker | Page posts and insights |
| Instagram Agent | Worker | Posts and engagement |
| Email Marketing Agent | Worker | Brevo/Mailchimp campaigns |
| Customer Support Agent | Worker | Zendesk ticket management |
| Analytics Agent | Worker | Shopify + GA4 revenue and traffic insights |

Custom agents (user-defined name, description, system prompt, and tool selection) can be created and added to the hierarchy at runtime.

### Memory System
| Layer | Technology | Purpose |
|-------|-----------|---------|
| Checkpoint (short-term) | MongoDB `chat_checkpoints` | Full message history per thread |
| Running summary | LangMem `SummarizationNode` | Compressed context to prevent token bloat |
| Long-term knowledge graph | Graphiti + Neo4j | Persistent business facts across sessions |
| Asset vector store | MongoDB Atlas Vector Search | Semantic search over uploaded documents |

### n8n Workflow Engine
Users can browse workflow templates, deploy them to an n8n instance, and invoke them as agent tools. The lifecycle:
1. **Templates** are pre-seeded from `assets/workflow_templates/n8n/` on startup.
2. **Deploy** — a template is instantiated in n8n and a `DeployedWorkflow` record is created.
3. **Session** — an ephemeral `WorkflowSession` (TTL 5 min) is created for each tool invocation.
4. **Activate / Deactivate** — workflows can be toggled on/off via API.

### RabbitMQ Messaging
Background services consume from RabbitMQ queues to handle:
- **Agent message processing** — async continuation of agent runs
- **Asset notifications** — trigger document ingestion and vectorization when assets are uploaded

---

## Technology Stack

| Category | Technology |
|----------|-----------|
| Runtime | Python 3.12 |
| Package manager | `uv` |
| Web framework | FastAPI 0.116 |
| Agent framework | LangGraph 0.6 + LangChain 0.3 |
| LLM provider | OpenRouter (via `langchain-openai`) |
| Database | MongoDB (Motor async driver, Beanie ODM) |
| Message queue | RabbitMQ (aio-pika) |
| Long-term memory | Graphiti + Neo4j |
| Observability | Langfuse / LangSmith, Sentry, OpenTelemetry |
| Containerization | Docker |
| Deployment | Docker / Docker Compose |

---

## Repository Structure

```
ai-engine/
├── main.py                   # FastAPI application entry point
├── core/
│   ├── auth.py               # JWT verification and AuthProvider
│   ├── backend_client.py     # HTTP client for Backend API
│   ├── db.py                 # MongoDB + Beanie initialization
│   └── n8n_client.py         # n8n REST API client
├── models/
│   ├── agent.py              # Agent document + AgentState + enums
│   ├── analytics.py          # AgentRun and ToolExecution documents
│   ├── asset.py              # Asset model
│   ├── chat.py               # Chat, ChatMessage, ChatShare documents
│   ├── credential.py         # Generic credential model
│   ├── custom_messages.py    # ImageMessage, FileMessage, TaskMessage
│   ├── organization.py       # Organization model
│   ├── user.py               # User model
│   └── automations/
│       ├── workflow.py       # DeployedWorkflow document
│       ├── workflow_credential.py
│       ├── workflow_session.py
│       ├── workflow_template.py
│       └── n8n/              # n8n-specific workflow, credential, template models
├── api/
│   ├── agents/               # Agent and chat HTTP routes
│   ├── analytics/            # AgentRun and ToolExecution routes
│   ├── n8n/                  # n8n workflow, template, credential routes
│   ├── asset_routes.py
│   ├── credential_routes.py
│   ├── workflow_routes.py
│   ├── workflow_session_routes.py
│   └── workflow_template_routes.py
├── services/
│   ├── agents/               # Agent orchestration, LLM, checkpointers, memory
│   ├── n8n/                  # n8n workflow and credential services
│   ├── rmq/                  # RabbitMQ services
│   ├── asset_service.py
│   ├── credential_service.py
│   ├── organization_service.py
│   ├── workflow_service.py
│   ├── workflow_session_service.py
│   └── workflow_template_service.py
├── assets/
│   └── workflow_templates/n8n/  # JSON workflow template files
├── tests/
│   ├── unit/                 # Unit tests
│   └── integration/          # Integration tests
├── docs/                     # ← This documentation
├── Dockerfile
├── pyproject.toml
└── .env.example
```

---

## Quick Start

To run the whole platform, use `docker compose up` from the [repository root](../../../README.md#quickstart). For local development:

```bash
# 1. Install dependencies
pip install uv
uv sync

# 2. Copy and configure environment
cp .env.example .env
# Edit .env — set MONGO_URI, OPENROUTER_API_KEY, JWT_SECRET, etc.

# 3. Start the server
uv run python main.py
# or
uvicorn main:app --host 0.0.0.0 --port 8010 --reload
```

Interactive API docs are available at `http://localhost:8010/docs`.
