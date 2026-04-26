from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastmcp.exceptions import NotFoundError
from fastmcp.tools.tool import ToolResult

from servers.analytics_mcp import app as analytics_mcp
from servers.middlewares import (
    AuthenticationMiddleware,
    ExecutionLoggingMiddleware,
    get_tool_info,
)


@pytest.mark.asyncio
async def test_authentication_middleware_requires_authorization_header(monkeypatch):
    middleware = AuthenticationMiddleware()

    monkeypatch.setattr("servers.middlewares.get_http_headers", lambda: {})

    context = SimpleNamespace(fastmcp_context=SimpleNamespace())
    call_next = AsyncMock()

    with pytest.raises(NotFoundError, match="Authorization header is required"):
        await middleware.on_message(context, call_next)


@pytest.mark.asyncio
async def test_authentication_middleware_sets_context_state(monkeypatch):
    middleware = AuthenticationMiddleware()

    monkeypatch.setattr(
        "servers.middlewares.get_http_headers",
        lambda: {
            "Authorization": "Bearer token",
            "X-Chat-ID": "chat-123",
        },
    )

    state = {}

    fastmcp_context = SimpleNamespace(
        set_state=lambda key, value: state.__setitem__(key, value)
    )
    context = SimpleNamespace(fastmcp_context=fastmcp_context)

    async def call_next(ctx):
        return "ok"

    result = await middleware.on_message(context, call_next)

    assert result == "ok"
    assert state["auth_header"] == "Bearer token"
    assert state["chat_id"] == "chat-123"


@pytest.mark.asyncio
async def test_execution_logging_middleware_success_updates_execution(monkeypatch):
    middleware = ExecutionLoggingMiddleware()

    tool_execution_log = SimpleNamespace(id="exec-1")

    engine_client = SimpleNamespace(
        log_tool_execution=AsyncMock(return_value=tool_execution_log),
        update_tool_execution=AsyncMock(),
    )

    monkeypatch.setattr(
        "servers.middlewares.AIEngineClient", lambda auth: engine_client
    )

    fastmcp_context = SimpleNamespace(
        get_state=lambda key: {"auth_header": "Bearer token", "chat_id": "chat-1"}[key],
        fastmcp=analytics_mcp,
    )
    message = SimpleNamespace(name="shopify_get_orders_summary", arguments={"days": 7})
    context = SimpleNamespace(fastmcp_context=fastmcp_context, message=message)

    async def call_next(_):
        return ToolResult(structured_content={"status": "ok"})

    result = await middleware.on_call_tool(context, call_next)

    assert result.structured_content == {"status": "ok"}
    engine_client.log_tool_execution.assert_awaited_once()
    engine_client.update_tool_execution.assert_awaited_once()
    update_call = engine_client.update_tool_execution.await_args.kwargs
    assert update_call["execution_id"] == "exec-1"
    assert update_call["status"] == "succeeded"
    assert update_call["error"] is None


@pytest.mark.asyncio
async def test_execution_logging_middleware_failure_updates_and_reraises(monkeypatch):
    middleware = ExecutionLoggingMiddleware()

    tool_execution_log = SimpleNamespace(id="exec-2")

    engine_client = SimpleNamespace(
        log_tool_execution=AsyncMock(return_value=tool_execution_log),
        update_tool_execution=AsyncMock(),
    )

    monkeypatch.setattr(
        "servers.middlewares.AIEngineClient", lambda auth: engine_client
    )

    fastmcp_context = SimpleNamespace(
        get_state=lambda key: {"auth_header": "Bearer token", "chat_id": "chat-2"}[key],
        fastmcp=analytics_mcp,
    )
    message = SimpleNamespace(name="shopify_get_orders_summary", arguments={})
    context = SimpleNamespace(fastmcp_context=fastmcp_context, message=message)

    async def call_next(_):
        raise ValueError("tool failed")

    with pytest.raises(ValueError, match="tool failed"):
        await middleware.on_call_tool(context, call_next)

    engine_client.update_tool_execution.assert_awaited_once()
    update_call = engine_client.update_tool_execution.await_args.kwargs
    assert update_call["execution_id"] == "exec-2"
    assert update_call["status"] == "failed"
    assert update_call["error"] == "tool failed"


@pytest.mark.asyncio
async def test_get_tool_info_returns_metadata_for_valid_tool():
    info = await get_tool_info(analytics_mcp, "shopify_get_orders_summary")

    assert info["name"] == "shopify_get_orders_summary"
    assert (
        info["ignitic_identifier"] == "tools.analytics_agent.shopify_get_orders_summary"
    )
    assert info["is_workflow"] is False
    assert info["workflow_provider"] == "n8n"


@pytest.mark.asyncio
async def test_get_tool_info_raises_when_tool_missing():
    with pytest.raises(NotFoundError, match="Unknown tool: missing_tool"):
        await get_tool_info(analytics_mcp, "missing_tool")


@pytest.mark.asyncio
async def test_get_tool_info_raises_when_identifier_missing():
    async def _fake_get_tool(_):
        return SimpleNamespace(meta={})

    server = SimpleNamespace(get_tool=_fake_get_tool)

    with pytest.raises(NotFoundError, match="Ignitic identifier not found"):
        await get_tool_info(server, "tool_without_identifier")
