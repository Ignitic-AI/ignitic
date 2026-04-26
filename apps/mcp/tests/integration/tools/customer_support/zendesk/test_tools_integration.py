import inspect

import pytest

from servers.customer_support_mcp import app as customer_support_mcp

pytestmark = [pytest.mark.integration_live, pytest.mark.asyncio]

ZENDESK_TOOL_CASES = [
    ("zendesk_list_tickets", "tools.customer_support_agent.zendesk_list_tickets"),
    ("zendesk_get_ticket", "tools.customer_support_agent.zendesk_get_ticket"),
    ("zendesk_create_ticket", "tools.customer_support_agent.zendesk_create_ticket"),
    ("zendesk_update_ticket", "tools.customer_support_agent.zendesk_update_ticket"),
    ("zendesk_close_ticket", "tools.customer_support_agent.zendesk_close_ticket"),
    ("zendesk_reopen_ticket", "tools.customer_support_agent.zendesk_reopen_ticket"),
    (
        "zendesk_get_ticket_comments",
        "tools.customer_support_agent.zendesk_get_ticket_comments",
    ),
    ("zendesk_add_comment", "tools.customer_support_agent.zendesk_add_comment"),
    ("zendesk_get_user", "tools.customer_support_agent.zendesk_get_user"),
    (
        "zendesk_get_user_by_email",
        "tools.customer_support_agent.zendesk_get_user_by_email",
    ),
    (
        "zendesk_get_user_tickets",
        "tools.customer_support_agent.zendesk_get_user_tickets",
    ),
    (
        "zendesk_search_tickets",
        "tools.customer_support_agent.zendesk_search_tickets",
    ),
    ("zendesk_list_views", "tools.customer_support_agent.zendesk_list_views"),
    (
        "zendesk_get_view_tickets",
        "tools.customer_support_agent.zendesk_get_view_tickets",
    ),
    (
        "zendesk_get_ticket_metrics",
        "tools.customer_support_agent.zendesk_get_ticket_metrics",
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


@pytest.mark.parametrize(("tool_name", "identifier"), ZENDESK_TOOL_CASES)
async def test_zendesk_tool_live_integration(
    require_live_integration: None,
    live_jwt_bearer: str,
    live_chat_id: str,
    live_customer_support_payloads: dict,
    tool_name: str,
    identifier: str,
):
    tool = await customer_support_mcp._tool_manager.get_tool(tool_name)

    arguments = payload_for_tool(live_customer_support_payloads, identifier, tool_name)
    missing = required_params_missing(tool.fn, arguments)
    assert not missing, (
        f"Missing required payload args for {identifier}: {', '.join(missing)}. "
        "Update tests/integration/live_payloads/customer_support_tool_payloads.json"
    )

    inject_headers_into_tool(tool.fn, live_jwt_bearer, live_chat_id)

    result = await tool.run(arguments)
    assert result is not None
