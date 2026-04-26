import importlib

import pytest
from fastmcp import FastMCP


def middleware_class_names(middlewares):
    return {middleware.__class__.__name__ for middleware in middlewares}


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
async def test_mcp_server_registration_contract(
    module_path: str, expected_tool_count: int
):
    module = importlib.import_module(module_path)
    app = module.app

    assert isinstance(app, FastMCP)

    tools = await app._tool_manager.list_tools()
    assert len(tools) == expected_tool_count, (
        f"{module_path} expected {expected_tool_count} tools, found {len(tools)}"
    )

    tool_names = [tool.name for tool in tools]
    assert len(tool_names) == len(set(tool_names)), (
        f"{module_path} has duplicate tool names"
    )

    for tool in tools:
        assert tool.meta is not None, f"{module_path}:{tool.name} missing metadata"
        assert tool.meta.get("ignitic_identifier"), (
            f"{module_path}:{tool.name} missing ignitic_identifier metadata"
        )

    middleware_names = middleware_class_names(app.middleware)
    assert "AuthenticationMiddleware" in middleware_names
    assert "ExecutionLoggingMiddleware" in middleware_names
