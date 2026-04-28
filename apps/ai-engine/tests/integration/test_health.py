"""
Integration tests for the health-check endpoints (/, /health, /health/rmq).

These use the async_client fixture from conftest.py which binds to the
FastAPI ASGI app with all heavy I/O mocked out.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_read_root(async_client: AsyncClient):
    """GET / should return API info."""
    response = await async_client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "AI Engine" in data["message"]
    assert data["status"] == "healthy"
    assert "version" in data


@pytest.mark.asyncio
async def test_health_check(async_client: AsyncClient, monkeypatch):
    """GET /health should return service status + RMQ summary."""
    import main

    monkeypatch.setattr(
        main.rmq_task_manager,
        "get_service_status",
        lambda: {"test_queue": "running"},
    )

    response = await async_client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["service"] == "AI Engine"
    assert "rmq_services" in data
    assert data["rmq_services"]["test_queue"] == "running"


@pytest.mark.asyncio
async def test_rmq_health_running(async_client: AsyncClient, monkeypatch):
    """GET /health/rmq when RMQ is running."""
    import main

    monkeypatch.setattr(main.rmq_task_manager, "is_running", True)
    monkeypatch.setattr(
        main.rmq_task_manager,
        "get_service_status",
        lambda: {"q1": "ok"},
    )

    response = await async_client.get("/health/rmq")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["services"] == {"q1": "ok"}


@pytest.mark.asyncio
async def test_rmq_health_stopped(async_client: AsyncClient, monkeypatch):
    """GET /health/rmq when RMQ is stopped."""
    import main

    monkeypatch.setattr(main.rmq_task_manager, "is_running", False)
    monkeypatch.setattr(
        main.rmq_task_manager,
        "get_service_status",
        lambda: {},
    )

    response = await async_client.get("/health/rmq")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "stopped"
