# Ignitic AI Engine

A comprehensive backend system for orchestrating agents, tools, memory, workflows (including n8n-style integrations), and document/vector-store operations. This lightweight yet scalable engine acts as the core of Ignitic AI applications.

## Overview

Ignitic AI Engine provides services, API routes, and utilities used to manage:
- Complex multi-agent systems and conversational workflows
- External system tool integration (via MCP & explicit tool definitions)
- Automated long-term memory graph stores (using Graphiti)
- Async RabbitMQ-based task queues and messaging
- Assets, credentials, and data storage operations (MongoDB)

It is designed as an asynchronous Python service layer, built on top of FastAPI for rapid deployment, high performance, and ease of use.

## Core Features

- **Multi-Agent Orchestration**: Native integration with LangChain and LangGraph to manage complex stateful agent workflows. Includes memory handlers, summarization nodes, and tool routing logic.
- **REST APIs**: FastAPI-powered routes for interacting with agents, managing assets, configuring workflows, handling users, and more.
- **Document Processing**: Integrated parsing for PDF, DOCX, and Text files using processors like MarkItDown and specific extraction libraries.
- **Vector & Graph Memory Stores**: Support for vector-based retrievers and graph-based memory (via Graphiti) to provide robust conversational AI recall.
- **Task Queues & Workers**: RabbitMQ integration for reliable, decoupled message processing. 
- **Extensible Workflows**: Helpers designed for interacting with internal logic and n8n automations smoothly.

## Tech Stack

- **Framework**: FastAPI (async ASGI framework)
- **Agent/LLM**: LangChain, LangGraph, OpenAI, Groq, Ollama
- **Database**: MongoDB (via Beanie ODM & Motor)
- **Message Broker**: RabbitMQ (via aio-pika / aiormq)
- **Memory/Vector Store**: LangGraph Checkpointers, Graphiti, LangMem
- **Tool Protocols**: Model Context Protocol (MCP) clients

## Project Structure

- `api/`: FastAPI route definitions and request/response models.
- `core/`: System-wide configurations, clients, and authentication middleware.
- `models/`: Database models, Pydantic schemas, and Beanie document definitions.
- `services/`: Business logic. Contains submodules like:
  - `agents/`: Core LLM, LangChain, tool, and conversational logic.
  - `rmq/`: RabbitMQ service classes.
- `document_processors/`: Specialized logic for file parsing.
- `utils/`: Miscellaneous helpers for data extraction, strings, etc.
- `cli/`: Command-line tools to bootstrap and manage the engine.
- `tests/`: Automated unit and integration tests (Pytest).

## Quickstart

### Prerequisites
- Python 3.12+ and [uv](https://docs.astral.sh/uv/)
- MongoDB (Atlas or Atlas Local, for vector search), RabbitMQ and Neo4j. From the repo root:
  ```bash
  docker compose up -d mongo rabbitmq neo4j
  ```
- An [OpenRouter](https://openrouter.ai/keys) API key

### Installation

1. **Navigate** to `apps/ai-engine`.

2. **Install dependencies** (creates `.venv`):
```bash
uv sync --extra test
```

3. **Environment Setup**:
Copy the example environment file and fill in the necessary keys.
```bash
cp .env.example .env
```

4. **Run the Server** (port `8010`):
```bash
uv run python main.py
```

## Development Guidelines

1. **Async Patterns**: Most backend functions perform I/O. Use `async/await` comprehensively to avoid blocking the ASGI event loop.
2. **Dependency Injection**: Utilize FastAPI's `Depends` and class-based service injections (e.g., passing `AuthProvider` or DB clients to services).
3. **Adding Tools**: When extending agent functionality, define new tools in `services/agents/tools/` and update the respective loader configurations.

## Testing

Run the automated test suite using Pytest. The suite is configured to run asynchronously and bypasses external I/O using mock fixtures defined in `conftest.py`.

```bash
uv run pytest tests/unit
```
