# Testing Guide
# Ignitic AI Engine

---

## Overview

The AI Engine test suite uses **pytest** with **pytest-asyncio** for async tests, **pytest-mock** for mocking, and **httpx** for in-process HTTP client testing with FastAPI's `TestClient` / `AsyncClient`.

Tests are organized into:
- **Unit tests** (`tests/unit/`) — test individual functions and classes in isolation with mocked dependencies
- **Integration tests** (`tests/integration/`) — test full request-response cycles against a live or in-memory environment

---

## Running Tests

### Prerequisites

```bash
# Install development dependencies
uv sync  # installs all deps including the [test] optional group
```

### Run All Tests

```bash
uv run pytest
```

### Run Only Unit Tests

```bash
uv run pytest tests/unit/
```

### Run Only Integration Tests

```bash
uv run pytest tests/integration/
```

### Run with Coverage

```bash
uv run pytest --cov=. --cov-report=term-missing
```

### Run a Specific Test File

```bash
uv run pytest tests/unit/test_models.py -v
```

### Run Tests Matching a Pattern

```bash
uv run pytest -k "test_agent" -v
```

---

## Configuration

Pytest configuration is defined in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
testpaths = ["tests"]
asyncio_mode = "strict"
asyncio_default_fixture_loop_scope = "function"
filterwarnings = [
    "ignore::DeprecationWarning:pydantic.*",
    "ignore::DeprecationWarning:langgraph.*",
    "ignore::DeprecationWarning:trustcall.*",
]
```

`asyncio_mode = "strict"` means every async test must be decorated with `@pytest.mark.asyncio`.

---

## Test Structure

```
tests/
├── conftest.py                          # Shared fixtures
├── unit/
│   ├── test_agent_route_helpers.py      # Agent route helper functions
│   ├── test_auth.py                     # JWT auth and AuthProvider
│   ├── test_backend_client.py           # Backend API client
│   ├── test_custom_messages.py          # Custom message types (Image, File, Task)
│   ├── test_document_processors.py      # PDF/DOCX/PPTX document processors
│   ├── test_models.py                   # Pydantic/Beanie model validation
│   ├── test_n8n_workflow_summary.py     # n8n workflow summary utilities
│   ├── test_services.py                 # Service layer unit tests
│   └── test_url_utils.py               # URL utility functions
├── integration/
│   └── test_chat_scope_and_access.py    # Chat isolation between users/orgs
└── test_chat_scope_and_access.py        # (root-level integration test)
```

---

## Key Test Patterns

### Mocking the Database (Unit Tests)

Unit tests use `pytest-mock` and `AsyncMock` to avoid real database calls:

```python
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_agent_creation(mocker):
    mock_save = mocker.patch(
        "models.agent.Agent.insert",
        new_callable=AsyncMock,
        return_value=None
    )
    # ... test business logic
    mock_save.assert_called_once()
```

### Testing Auth

```python
from core.auth import AuthProvider, get_auth
import pytest

@pytest.fixture
def mock_auth():
    return AuthProvider(u_id="user_123", org_id=None, token="test-token")

@pytest.mark.asyncio
async def test_protected_route(client, mock_auth):
    # Override the get_auth dependency
    app.dependency_overrides[get_auth] = lambda: mock_auth
    response = await client.get("/api/v1/agents")
    assert response.status_code == 200
```

### Testing Streaming Endpoints

SSE endpoints return `text/event-stream`. Parse events line by line:

```python
async def collect_sse_events(response) -> list[dict]:
    events = []
    async for line in response.aiter_lines():
        if line.startswith("data: "):
            events.append(json.loads(line[6:]))
    return events
```

### Testing Agent Models

```python
from models.agent import Agent, PrebuiltAgents

def test_prebuilt_agent_creation():
    agent = Agent.prebuilt(PrebuiltAgents.SHOPIFY)
    assert agent.identifier == "shopify_agent"
    assert agent.type.value == "worker"
    assert "shopify" in agent.system_prompt.lower()
```

### Testing Cycle Detection

```python
from services.agents.agent_nodes import detect_hierarchy_cycles
from models.agent import Agent, AgentType

def test_cycle_detection_raises():
    agents = [
        Agent(identifier="a", parent="b", ...),
        Agent(identifier="b", parent="a", ...),
    ]
    with pytest.raises(ValueError, match="Cycle detected"):
        detect_hierarchy_cycles(agents)
```

---

## Fixtures (`conftest.py`)

Common fixtures defined in `tests/conftest.py`:

| Fixture | Scope | Description |
|---------|-------|-------------|
| `event_loop` | session | Single asyncio event loop for the test session |
| `mock_db` | function | Mocked Beanie/Motor database |
| `auth_provider` | function | Default `AuthProvider(u_id="test_user")` |
| `test_client` | function | FastAPI `AsyncClient` with dependency overrides |

---

## Writing New Tests

### Unit Test Template

```python
# tests/unit/test_my_service.py
import pytest
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_my_service_does_something(mocker):
    # Arrange
    mock_dep = mocker.patch("services.my_service.SomeDependency")

    # Act
    result = await my_service.do_something(input_data)

    # Assert
    assert result == expected_value
```

### Integration Test Template

```python
# tests/integration/test_my_endpoint.py
import pytest
from httpx import AsyncClient
from main import app

@pytest.mark.asyncio
async def test_create_agent_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post(
            "/api/v1/agents",
            json={"name": "Test", "description": "...", "system_prompt": "..."},
            headers={"Authorization": "Bearer <test-token>"}
        )
    assert response.status_code == 201
    assert response.json()["name"] == "Test"
```

---

## Code Coverage

Target: **70% line coverage** minimum.

Coverage reports are generated by `pytest-cov`:

```bash
# Generate HTML report
uv run pytest --cov=. --cov-report=html
open htmlcov/index.html
```

Focus coverage on:
- `services/agents/` — highest business complexity
- `models/` — Pydantic validators
- `core/auth.py` — security-critical

---

## CI Test Execution

Tests run automatically on pull requests via GitHub Actions. See [deployment.md](deployment.md#cicd-pipeline) for the pipeline configuration. The CI pipeline:
1. Installs dependencies with `uv sync`
2. Runs `uv run pytest --cov=. --cov-report=xml`
3. Fails the build if any test fails

> **Note:** Integration tests that require live external services (MongoDB, n8n) are skipped in CI unless the corresponding secrets are provided.
