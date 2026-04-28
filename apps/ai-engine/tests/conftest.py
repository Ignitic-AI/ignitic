"""
Root conftest – shared fixtures for the ai-engine test-suite.

Key design decisions
--------------------
* Heavy startup I/O (MongoDB, RMQ, Graphiti, MCP) is mocked so tests
  never depend on running infrastructure.
* `async_client` provides an httpx AsyncClient wired to the ASGI app
  for integration tests of API routes.
* `mock_db_init` is a **synchronous** autouse fixture that patches all
  the async startup/shutdown coroutines with plain `AsyncMock`.  This
  avoids the pytest-asyncio "sync test depending on async fixture" error.
"""

import asyncio
from typing import AsyncGenerator
from unittest.mock import AsyncMock

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient


# ---------------------------------------------------------------------------
# Auto-mock all heavy I/O that fires during app startup / shutdown
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def mock_db_init(monkeypatch):
    """
    Patch the *module-level references* used by main.py's lifespan so that
    importing `main` never tries to connect to real services.
    Uses monkeypatch (synchronous) so it works for both sync and async tests.
    """
    import main  # noqa: E402 – triggers top-level imports

    monkeypatch.setattr(main, "init_db", AsyncMock())
    monkeypatch.setattr(main, "close_db", AsyncMock())
    monkeypatch.setattr(main, "init_mongo_checkpointer", AsyncMock())
    monkeypatch.setattr(main, "init_mongo_memory_store", AsyncMock())
    monkeypatch.setattr(main, "close_graphiti_client", AsyncMock())
    monkeypatch.setattr(
        main.WorkflowTemplateService,
        "sync_workflows_from_assets",
        AsyncMock(),
    )
    monkeypatch.setattr(main.rmq_task_manager, "start_all_services", AsyncMock())
    monkeypatch.setattr(main.rmq_task_manager, "stop_all_services", AsyncMock())


# ---------------------------------------------------------------------------
# Async HTTP client for route-level integration tests
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """
    Provide an httpx AsyncClient bound to the FastAPI ASGI app.
    The lifespan context manager will run with the mocked I/O above.
    """
    from main import app  # noqa: E402

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client
