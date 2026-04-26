import inspect

import pytest

from servers.analytics_mcp import app as analytics_mcp

pytestmark = [pytest.mark.integration_live, pytest.mark.asyncio]

GOOGLE_ANALYTICS_TOOL_CASES = [
    (
        "google_analytics_get_traffic",
        "tools.analytics_agent.google_analytics_get_traffic",
    ),
    (
        "google_analytics_get_conversions",
        "tools.analytics_agent.google_analytics_get_conversions",
    ),
    (
        "google_analytics_get_traffic_by_source",
        "tools.analytics_agent.google_analytics_get_traffic_by_source",
    ),
    (
        "google_analytics_get_top_pages",
        "tools.analytics_agent.google_analytics_get_top_pages",
    ),
    (
        "google_analytics_get_traffic_by_device",
        "tools.analytics_agent.google_analytics_get_traffic_by_device",
    ),
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


@pytest.mark.parametrize(("tool_name", "identifier"), GOOGLE_ANALYTICS_TOOL_CASES)
async def test_google_analytics_tool_live_integration(
    require_live_integration: None,
    live_jwt_bearer: str,
    live_chat_id: str,
    live_analytics_payloads: dict,
    tool_name: str,
    identifier: str,
):
    tool = await analytics_mcp._tool_manager.get_tool(tool_name)

    arguments = payload_for_tool(live_analytics_payloads, identifier, tool_name)
    missing = required_params_missing(tool.fn, arguments)
    assert not missing, (
        f"Missing required payload args for {identifier}: {', '.join(missing)}. "
        "Update tests/integration/live_payloads/analytics_tool_payloads.json"
    )

    inject_headers_into_tool(tool.fn, live_jwt_bearer, live_chat_id)

    result = await tool.run(arguments)
    assert result is not None
