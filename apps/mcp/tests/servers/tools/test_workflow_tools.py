from datetime import datetime
import inspect
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastmcp.exceptions import ToolError

from models.automations.workflow_template import WorkflowTemplate
from servers.tools import workflow_tools


@pytest.fixture
def workflow_template_factory():
    def _make(identifier: str, name: str = "Workflow", description: str = "desc"):
        return WorkflowTemplate(
            ignitic_identifier=identifier,
            name=name,
            description=description,
            inputs=None,
            outputs=None,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

    return _make


async def _remove_tool_if_exists(app, tool_name: str):
    if await app._tool_manager.has_tool(tool_name):
        app._tool_manager.remove_tool(tool_name)


def _build_input_instance(tool):
    parameter = next(iter(inspect.signature(tool.fn).parameters.values()))
    input_model = parameter.annotation
    return input_model()


@pytest.mark.asyncio
async def test_register_workflow_tools_registers_all_templates(
    monkeypatch, workflow_template_factory
):
    first_name = f"wf_{uuid4().hex}"
    second_name = f"wf_{uuid4().hex}"

    templates = [
        workflow_template_factory(f"tools.marketer.{first_name}"),
        workflow_template_factory(f"tools.product_researcher.{second_name}"),
    ]

    ai_client = SimpleNamespace(
        get_workflow_templates=AsyncMock(return_value=templates),
        close=AsyncMock(),
    )

    monkeypatch.setattr(workflow_tools, "AIEngineClient", lambda: ai_client)

    try:
        await workflow_tools.register_workflow_tools()

        assert await workflow_tools.marketer_mcp._tool_manager.has_tool(first_name)
        assert await workflow_tools.product_researcher_mcp._tool_manager.has_tool(
            second_name
        )
        assert await workflow_tools.custom_mcp._tool_manager.has_tool(first_name)
        assert await workflow_tools.custom_mcp._tool_manager.has_tool(second_name)
    finally:
        await _remove_tool_if_exists(workflow_tools.marketer_mcp, first_name)
        await _remove_tool_if_exists(workflow_tools.product_researcher_mcp, second_name)
        await _remove_tool_if_exists(workflow_tools.custom_mcp, first_name)
        await _remove_tool_if_exists(workflow_tools.custom_mcp, second_name)


@pytest.mark.asyncio
async def test_register_workflow_tool_skips_unknown_agent(
    capsys, workflow_template_factory
):
    tool_name = f"wf_{uuid4().hex}"
    template = workflow_template_factory(f"tools.unknown_agent.{tool_name}")

    await workflow_tools.register_workflow_tool(template)

    out = capsys.readouterr().out
    assert "No MCP found for workflow" in out


@pytest.mark.asyncio
async def test_dynamic_workflow_tool_calls_workflow_url(
    monkeypatch, workflow_template_factory
):
    tool_name = f"wf_{uuid4().hex}"
    template = workflow_template_factory(f"tools.marketer.{tool_name}")

    class _AIClient:
        def __init__(self, auth=None):
            self.auth = auth
            self.close = AsyncMock()

        async def get_workflow_session(self, ignitic_identifier):
            assert ignitic_identifier == template.ignitic_identifier
            return SimpleNamespace(workflow_url="https://workflow.test/run")

    posted = {}

    class _Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {}

    def _post(url, json):
        posted["url"] = url
        posted["json"] = json
        return _Response()

    monkeypatch.setattr(workflow_tools, "AIEngineClient", _AIClient)
    monkeypatch.setattr(
        workflow_tools, "get_http_headers", lambda: {"Authorization": "Bearer token"}
    )
    monkeypatch.setattr(workflow_tools.requests, "post", _post)

    try:
        await workflow_tools.register_workflow_tool(template)
        tool = await workflow_tools.marketer_mcp._tool_manager.get_tool(tool_name)

        result = await tool.fn(_build_input_instance(tool))

        assert result.model_dump() == {}
        assert posted["url"] == "https://workflow.test/run"
        assert posted["json"] == {}
    finally:
        await _remove_tool_if_exists(workflow_tools.marketer_mcp, tool_name)
        await _remove_tool_if_exists(workflow_tools.custom_mcp, tool_name)


@pytest.mark.asyncio
async def test_dynamic_workflow_tool_requires_auth_header(
    monkeypatch, workflow_template_factory
):
    tool_name = f"wf_{uuid4().hex}"
    template = workflow_template_factory(f"tools.marketer.{tool_name}")

    monkeypatch.setattr(workflow_tools, "get_http_headers", lambda: {})

    class _AIClient:
        def __init__(self, auth=None):
            self.close = AsyncMock()

        async def get_workflow_session(self, ignitic_identifier):
            return SimpleNamespace(workflow_url="https://workflow.test/run")

    monkeypatch.setattr(workflow_tools, "AIEngineClient", _AIClient)

    try:
        await workflow_tools.register_workflow_tool(template)
        tool = await workflow_tools.marketer_mcp._tool_manager.get_tool(tool_name)

        with pytest.raises(Exception, match="Authorization header is required"):
            await tool.fn(_build_input_instance(tool))
    finally:
        await _remove_tool_if_exists(workflow_tools.marketer_mcp, tool_name)
        await _remove_tool_if_exists(workflow_tools.custom_mcp, tool_name)


@pytest.mark.asyncio
async def test_dynamic_workflow_tool_wraps_session_error(
    monkeypatch, workflow_template_factory
):
    tool_name = f"wf_{uuid4().hex}"
    template = workflow_template_factory(f"tools.marketer.{tool_name}")

    class _AIClient:
        def __init__(self, auth=None):
            self.close = AsyncMock()

        async def get_workflow_session(self, ignitic_identifier):
            raise RuntimeError("session failed")

    monkeypatch.setattr(workflow_tools, "AIEngineClient", _AIClient)
    monkeypatch.setattr(
        workflow_tools, "get_http_headers", lambda: {"Authorization": "Bearer token"}
    )

    try:
        await workflow_tools.register_workflow_tool(template)
        tool = await workflow_tools.marketer_mcp._tool_manager.get_tool(tool_name)

        with pytest.raises(ToolError, match="Failed to get tool session"):
            await tool.fn(_build_input_instance(tool))
    finally:
        await _remove_tool_if_exists(workflow_tools.marketer_mcp, tool_name)
        await _remove_tool_if_exists(workflow_tools.custom_mcp, tool_name)
