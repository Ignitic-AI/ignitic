# Testing Guide
# Ignitic AI MCP Server

**Version:** 1.0  
**Status:** Active  
**Last Updated:** 2026-05-03

---

## Overview

The MCP Server test suite uses **pytest** with **pytest-asyncio** for async tests and **pytest-mock** for dependency mocking. Tests are organised into three layers:

| Layer | Location | Description |
|-------|----------|-------------|
| Unit tests | `tests/servers/` | Test individual components (middleware, server registrations, lifespan) in isolation using mocked dependencies |
| Integration tests | `tests/integration/` | Live end-to-end tests that call real external services (Shopify, HubSpot, etc.) via a running MCP Server |
| Live smoke tests | `scripts/run_live_mcp_smoke.py` | CLI smoke runner that exercises every tool against real credentials and records results to `live-reports/` |

---

## Running Tests

### Prerequisites

```bash
cd mcp/

# Install all dependencies (including test dependencies)
uv sync
```

### Run All Unit Tests

```bash
uv run pytest
```

### Run a Specific Test File

```bash
uv run pytest tests/servers/test_middlewares.py -v
```

### Run Tests Matching a Pattern

```bash
uv run pytest -k "test_authentication" -v
```

### Run with Verbose Output

```bash
uv run pytest -v
```

### Run with Coverage

```bash
uv run pytest --cov=. --cov-report=term-missing
```

---

## pytest Configuration

Defined in `pyproject.toml`:

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
python_files = ["test_*.py"]
asyncio_mode = "auto"
markers = [
    "integration_live: live integration tests that call real external services",
]
```

`asyncio_mode = "auto"` means all `async def test_*` functions are automatically treated as async tests — no `@pytest.mark.asyncio` decorator is needed.

---

## Unit Tests

### Test Files

| File | What It Tests |
|------|---------------|
| `tests/servers/test_main_mounts.py` | Verifies all 15 MCP server paths are mounted in `main.py`; tests lifespan behaviour |
| `tests/servers/test_mcp_server_registrations.py` | Contract test — asserts each server has the correct tool count, no duplicate names, and all tools have `ignitic_identifier` metadata |
| `tests/servers/test_middlewares.py` | Tests `AuthenticationMiddleware` and `ExecutionLoggingMiddleware` logic with mocked AI Engine client |
| `tests/servers/tools/test_workflow_tools.py` | Tests dynamic workflow tool registration |

### Key Test Cases

#### Middleware Tests

```python
# AuthenticationMiddleware raises if no Authorization header
async def test_authentication_middleware_requires_authorization_header(monkeypatch):
    middleware = AuthenticationMiddleware()
    monkeypatch.setattr("servers.middlewares.get_http_headers", lambda: {})
    with pytest.raises(NotFoundError, match="Authorization header is required"):
        await middleware.on_message(context, call_next)

# AuthenticationMiddleware stores headers in context
async def test_authentication_middleware_sets_context_state(monkeypatch):
    ...
    assert state["auth_header"] == "Bearer token"
    assert state["chat_id"] == "chat-123"

# ExecutionLoggingMiddleware updates execution log on success
async def test_execution_logging_middleware_success_updates_execution(monkeypatch):
    ...
    assert update_call["status"] == "succeeded"
    assert update_call["error"] is None

# ExecutionLoggingMiddleware marks execution as failed and re-raises exception
async def test_execution_logging_middleware_failure_updates_and_reraises(monkeypatch):
    ...
    assert update_call["status"] == "failed"
    assert update_call["error"] == "tool failed"
```

#### Server Registration Contract

The `test_mcp_server_registrations.py` file contains a parameterised test that runs against every server:

```python
SERVER_CASES = [
    ("servers.analytics_mcp", 10),
    ("servers.business_analyst_mcp", 7),
    ("servers.custom_mcp", 155),
    ("servers.customer_support_mcp", 15),
    ("servers.email_marketing_mcp", 42),
    ("servers.facebook_page_mcp", 8),
    ("servers.gdrive_mcp", 13),
    ("servers.google_ads_mcp", 14),
    ("servers.hubspot_mcp", 34),
    ("servers.instagram_mcp", 4),
    ("servers.marketer_mcp", 4),
    ("servers.meta_ads_mcp", 13),
    ("servers.product_researcher_mcp", 8),
    ("servers.seo_mcp", 3),
    ("servers.shopify_mcp", 6),
]

@pytest.mark.parametrize(("module_path", "expected_tool_count"), SERVER_CASES)
async def test_mcp_server_registration_contract(module_path, expected_tool_count):
    # Assert: correct tool count
    # Assert: no duplicate tool names
    # Assert: all tools have ignitic_identifier metadata
    # Assert: AuthenticationMiddleware and ExecutionLoggingMiddleware are registered
```

This test serves as a **regression guard** — if a tool is accidentally removed or its metadata is missing, this test fails.

#### Mount Tests

```python
def test_main_mounts_all_expected_paths():
    # Verifies all 15 paths are mounted in the Starlette app
    assert not missing, f"Missing mount paths: {sorted(missing)}"

async def test_lifespan_calls_register_workflow_tools(monkeypatch):
    # Verifies workflow tools are registered on startup

async def test_lifespan_logs_and_continues_on_registration_error(monkeypatch, caplog):
    # Verifies startup continues even if workflow registration fails
```

---

## Integration Tests

Live integration tests run against real third-party APIs. They are marked with `@pytest.mark.integration_live` to prevent accidental execution in CI.

### Location

```
tests/integration/
├── conftest.py
├── live_payloads/
│   ├── ads_tool_payloads.example.json
│   ├── analytics_tool_payloads.example.json
│   ├── business_analyst_tool_payloads.example.json
│   ├── crm_tool_payloads.example.json
│   ├── customer_support_tool_payloads.example.json
│   ├── email_marketing_tool_payloads.example.json
│   └── google_drive_tool_payloads.example.json
└── tools/
    └── (domain-specific integration test files)
```

### Running Integration Tests

Integration tests require real API credentials stored in `.env`. To run them:

```bash
# Run only integration tests
uv run pytest -m integration_live -v

# Run a specific domain's integration tests
uv run pytest tests/integration/tools/ -k "shopify" -v
```

### Live Payload Files

Each `*.example.json` file in `live_payloads/` documents the required input payload structure for live tools. Copy and fill these to create your local `*.json` payload files:

```bash
cd tests/integration/live_payloads/
cp ads_tool_payloads.example.json ads_tool_payloads.json
# Edit ads_tool_payloads.json with your real account IDs, etc.
```

---

## Live Smoke Tests

The `scripts/run_live_mcp_smoke.py` script provides a comprehensive CLI smoke runner that exercises every tool function against a live MCP Server using real credentials.

### Setup

1. Set required environment variables:
   ```bash
   export JWT_BEARER="Bearer eyJ..."    # Full JWT bearer token
   export JWT_SECRET="your_secret"
   export JWT_ALGORITHM="HS256"
   ```

2. Create your payload config file:
   ```bash
   cp scripts/live_tool_payloads.example.json scripts/live_tool_payloads.json
   # Edit to fill required fields for tools you want to test
   ```

### Running the Smoke Tests

```bash
# Run all tools
uv run python scripts/run_live_mcp_smoke.py \
  --payload-file scripts/live_tool_payloads.json

# Run tools for a specific server
uv run python scripts/run_live_mcp_smoke.py \
  --server analytics \
  --payload-file scripts/live_tool_payloads.json

# Filter tools by name regex
uv run python scripts/run_live_mcp_smoke.py \
  --server analytics \
  --tool-regex "shopify|google" \
  --payload-file scripts/live_tool_payloads.json
```

### Output

Results are written to `live-reports/` as JSON files with:
- Tool name and server
- Input payload used
- Success/failure status
- Response or error message
- Execution time

---

## Writing New Tests

### Unit Test Pattern

```python
import pytest
from unittest.mock import AsyncMock
from types import SimpleNamespace

@pytest.mark.asyncio  # Optional — asyncio_mode="auto" handles this
async def test_my_tool_logic(monkeypatch):
    # Arrange: mock external dependencies
    mock_client = SimpleNamespace(
        get_products=AsyncMock(return_value=[{"id": 1, "title": "Test"}])
    )
    monkeypatch.setattr("servers.tools.crm.shopify.products.create_client", lambda: mock_client)

    # Act
    result = await get_products(limit=10)

    # Assert
    assert len(result) == 1
    assert result[0]["title"] == "Test"
```

### Adding a New Server to Registration Tests

When adding a new MCP server, add an entry to `SERVER_CASES` in `tests/servers/test_mcp_server_registrations.py`:

```python
SERVER_CASES = [
    # ... existing entries ...
    ("servers.my_new_mcp", <expected_tool_count>),
]
```

### Integration Test Pattern

```python
import pytest

@pytest.mark.integration_live
async def test_shopify_get_products_live():
    """Live test — requires real Shopify credentials in .env."""
    from servers.tools.crm.shopify.products import get_products
    result = await get_products(limit=5)
    assert isinstance(result, list)
```

---

## CI Considerations

- Unit tests (`uv run pytest`) run without any external dependencies.
- Integration tests (`-m integration_live`) are excluded from automated CI to avoid requiring live credentials in the pipeline.
- The server registration contract test (`test_mcp_server_registrations.py`) provides strong regression coverage without hitting external APIs.
