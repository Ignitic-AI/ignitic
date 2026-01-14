# Ignitic AI Engine

A lightweight backend for building and running AI-powered workflows, agents, and document/vector-store integrations.

## Overview

Ignitic AI Engine provides services, API routes, and utilities used to manage assets, credentials, workflows (including n8n-style workflows), agents, and vector store operations. It's designed as an async Python service-layer with RabbitMQ and MongoDB integrations.

## Features

- REST API routes for assets, credentials, workflows, and agents
- Document processors for PDF, DOCX, and text
- Vector store utilities and example usage
- RabbitMQ-based message processors and services
- n8n workflow integration helpers

## Quickstart

Prerequisites: Python 3.10+, MongoDB, RabbitMQ (if using RMQ features)

1. Create and activate a virtual environment

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate
```

2. Install dependencies

```bash
# using `uv` (recommended in this repo)
uv add -r .\requirements.txt
```

3. Configure environment variables (copy and edit `.env` or use your environment)

4. Run the app (example)

```bash
python main.py
```

There are convenience scripts for stopping the server in the repo root: `stop-server.bat`, `stop-server.ps1`, and `stop-server.sh`.

## Project Structure (high level)

- `api/` — FastAPI/route handlers for assets, workflows, agents, n8n endpoints
- `core/` — central clients and auth (`backend_client.py`, `auth.py`, `n8n_client.py`)
- `models/` — Pydantic/Beanie models representing domain entities
- `services/` — business logic and service layer (asset, workflow, agent services)
- `document_processors/` — processors for PDF, DOCX, text
- `services/rmq/` and `rmq/` — RabbitMQ service classes and message processors
- `utils/` — helper utilities and extraction scripts

Refer to the source for more detailed module responsibilities.

## Development notes

- Follow async patterns used across services.
- Use `AuthProvider` / `BackendClient` when interacting with the backend in services.
- Prefer dependency-injected service patterns (`BaseRMQService`, `BaseRMQMessageProcessor`) for RMQ features.

## Examples

- See `examples/` and `vector_store_usage_example.py` for sample interactions with the vector store.

## Contributing

Contributions welcome. Please open an issue first for larger changes and follow the existing code patterns.

## License

Specify license here (e.g., MIT) or add a `LICENSE` file to the repository.
