import inspect

import pytest

from servers.email_marketing_mcp import app as email_marketing_mcp

pytestmark = [pytest.mark.integration_live, pytest.mark.asyncio]

MAILCHIMP_TOOL_CASES = [
    ("mailchimp_ping", "tools.email_marketing_agent.mailchimp_ping"),
    (
        "mailchimp_get_account_info",
        "tools.email_marketing_agent.mailchimp_get_account_info",
    ),
    (
        "mailchimp_list_audiences",
        "tools.email_marketing_agent.mailchimp_list_audiences",
    ),
    ("mailchimp_get_audience", "tools.email_marketing_agent.mailchimp_get_audience"),
    ("mailchimp_list_members", "tools.email_marketing_agent.mailchimp_list_members"),
    ("mailchimp_get_member", "tools.email_marketing_agent.mailchimp_get_member"),
    ("mailchimp_add_member", "tools.email_marketing_agent.mailchimp_add_member"),
    (
        "mailchimp_update_member",
        "tools.email_marketing_agent.mailchimp_update_member",
    ),
    (
        "mailchimp_archive_member",
        "tools.email_marketing_agent.mailchimp_archive_member",
    ),
    (
        "mailchimp_search_members",
        "tools.email_marketing_agent.mailchimp_search_members",
    ),
    (
        "mailchimp_list_campaigns",
        "tools.email_marketing_agent.mailchimp_list_campaigns",
    ),
    (
        "mailchimp_get_campaign",
        "tools.email_marketing_agent.mailchimp_get_campaign",
    ),
    (
        "mailchimp_create_campaign",
        "tools.email_marketing_agent.mailchimp_create_campaign",
    ),
    (
        "mailchimp_set_campaign_content",
        "tools.email_marketing_agent.mailchimp_set_campaign_content",
    ),
    (
        "mailchimp_send_campaign",
        "tools.email_marketing_agent.mailchimp_send_campaign",
    ),
    (
        "mailchimp_schedule_campaign",
        "tools.email_marketing_agent.mailchimp_schedule_campaign",
    ),
    (
        "mailchimp_unschedule_campaign",
        "tools.email_marketing_agent.mailchimp_unschedule_campaign",
    ),
    (
        "mailchimp_delete_campaign",
        "tools.email_marketing_agent.mailchimp_delete_campaign",
    ),
    (
        "mailchimp_get_campaign_report",
        "tools.email_marketing_agent.mailchimp_get_campaign_report",
    ),
    (
        "mailchimp_list_campaign_reports",
        "tools.email_marketing_agent.mailchimp_list_campaign_reports",
    ),
    (
        "mailchimp_add_tags_to_member",
        "tools.email_marketing_agent.mailchimp_add_tags_to_member",
    ),
    (
        "mailchimp_remove_tags_from_member",
        "tools.email_marketing_agent.mailchimp_remove_tags_from_member",
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


@pytest.mark.parametrize(("tool_name", "identifier"), MAILCHIMP_TOOL_CASES)
async def test_mailchimp_tool_live_integration(
    require_live_integration: None,
    live_jwt_bearer: str,
    live_chat_id: str,
    live_email_marketing_payloads: dict,
    tool_name: str,
    identifier: str,
):
    tool = await email_marketing_mcp._tool_manager.get_tool(tool_name)

    arguments = payload_for_tool(live_email_marketing_payloads, identifier, tool_name)
    missing = required_params_missing(tool.fn, arguments)
    assert not missing, (
        f"Missing required payload args for {identifier}: {', '.join(missing)}. "
        "Update tests/integration/live_payloads/email_marketing_tool_payloads.json"
    )

    inject_headers_into_tool(tool.fn, live_jwt_bearer, live_chat_id)

    result = await tool.run(arguments)
    assert result is not None
