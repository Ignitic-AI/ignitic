import inspect

import pytest

from servers.shopify_mcp import app as shopify_mcp

pytestmark = [pytest.mark.integration_live, pytest.mark.asyncio]

SHOPIFY_CRM_TOOL_CASES = [
    ("create_product", "tools.shopify_agent.create_product"),
    ("get_product_by_id", "tools.shopify_agent.get_product_by_id"),
    ("get_products", "tools.shopify_agent.get_products"),
    ("delete_product", "tools.shopify_agent.delete_product"),
    ("publish_product", "tools.shopify_agent.publish_product"),
    ("unpublish_product", "tools.shopify_agent.unpublish_product"),
]


def inject_headers_into_tool(tool_fn, auth_header: str, chat_id: str) -> None:
    def _headers(_include_all: bool = False) -> dict[str, str]:
        return {
            "Authorization": auth_header,
            "X-Chat-ID": chat_id,
        }

    tool_fn.__globals__["get_http_headers"] = _headers


def required_params_missing(fn, arguments: dict) -> list[str]:
    signature = inspect.signature(fn)
    missing: list[str] = []

    for param in signature.parameters.values():
        if param.kind not in (
            inspect.Parameter.POSITIONAL_OR_KEYWORD,
            inspect.Parameter.KEYWORD_ONLY,
        ):
            continue
        if param.default is inspect.Parameter.empty and param.name not in arguments:
            missing.append(param.name)

    return missing


def payload_for_tool(payloads: dict, identifier: str, tool_name: str) -> dict:
    by_identifier = payloads.get("by_identifier", {})
    by_name = payloads.get("by_name", {})

    if identifier in by_identifier:
        return by_identifier[identifier]

    return by_name.get(tool_name, {})


@pytest.mark.parametrize(("tool_name", "identifier"), SHOPIFY_CRM_TOOL_CASES)
async def test_shopify_crm_tool_live_integration(
    require_live_integration: None,
    live_jwt_bearer: str,
    live_chat_id: str,
    live_crm_payloads: dict,
    tool_name: str,
    identifier: str,
):
    tool = await shopify_mcp._tool_manager.get_tool(tool_name)

    arguments = payload_for_tool(live_crm_payloads, identifier, tool_name)
    missing = required_params_missing(tool.fn, arguments)
    assert not missing, (
        f"Missing required payload args for {identifier}: {', '.join(missing)}. "
        "Update tests/integration/live_payloads/crm_tool_payloads.json"
    )

    inject_headers_into_tool(tool.fn, live_jwt_bearer, live_chat_id)

    result = await tool.run(arguments)
    assert result is not None
