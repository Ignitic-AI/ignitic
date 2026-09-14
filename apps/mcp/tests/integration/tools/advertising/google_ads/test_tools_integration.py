import inspect

import pytest

from servers.google_ads_mcp import app as google_ads_mcp

pytestmark = [pytest.mark.integration_live, pytest.mark.asyncio]

GOOGLE_ADS_TOOL_CASES = [
    ("list_accessible_customers", "tools.google_ads_agent.list_accessible_customers"),
    ("get_campaigns", "tools.google_ads_agent.get_campaigns"),
    ("get_ad_groups", "tools.google_ads_agent.get_ad_groups"),
    ("get_ads", "tools.google_ads_agent.get_ads"),
    ("get_creatives", "tools.google_ads_agent.get_creatives"),
    ("create_campaign", "tools.google_ads_agent.create_campaign"),
    ("update_campaign", "tools.google_ads_agent.update_campaign"),
    ("create_ad_group", "tools.google_ads_agent.create_ad_group"),
    ("update_ad_group", "tools.google_ads_agent.update_ad_group"),
    ("create_creative_asset", "tools.google_ads_agent.create_creative_asset"),
    ("update_creative_asset", "tools.google_ads_agent.update_creative_asset"),
    ("create_ad", "tools.google_ads_agent.create_ad"),
    ("update_ad", "tools.google_ads_agent.update_ad"),
    ("get_performance_metrics", "tools.google_ads_agent.get_performance_metrics"),
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


@pytest.mark.parametrize(("tool_name", "identifier"), GOOGLE_ADS_TOOL_CASES)
async def test_google_ads_tool_live_integration(
    require_live_integration: None,
    live_jwt_bearer: str,
    live_chat_id: str,
    live_ads_payloads: dict,
    tool_name: str,
    identifier: str,
):
    tool = await google_ads_mcp._tool_manager.get_tool(tool_name)

    arguments = payload_for_tool(live_ads_payloads, identifier, tool_name)
    missing = required_params_missing(tool.fn, arguments)
    assert not missing, (
        f"Missing required payload args for {identifier}: {', '.join(missing)}. "
        "Update tests/integration/live_payloads/ads_tool_payloads.json"
    )

    inject_headers_into_tool(tool.fn, live_jwt_bearer, live_chat_id)

    result = await tool.run(arguments)
    assert result is not None
