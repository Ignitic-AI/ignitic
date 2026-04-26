import inspect

import pytest

from servers.email_marketing_mcp import app as email_marketing_mcp

pytestmark = [pytest.mark.integration_live, pytest.mark.asyncio]

BREVO_TOOL_CASES = [
    ("brevo_get_account_info", "tools.email_marketing_agent.brevo_get_account_info"),
    ("brevo_get_contacts", "tools.email_marketing_agent.brevo_get_contacts"),
    ("brevo_create_contact", "tools.email_marketing_agent.brevo_create_contact"),
    ("brevo_update_contact", "tools.email_marketing_agent.brevo_update_contact"),
    ("brevo_delete_contact", "tools.email_marketing_agent.brevo_delete_contact"),
    (
        "brevo_list_contact_lists",
        "tools.email_marketing_agent.brevo_list_contact_lists",
    ),
    (
        "brevo_create_contact_list",
        "tools.email_marketing_agent.brevo_create_contact_list",
    ),
    (
        "brevo_add_contacts_to_list",
        "tools.email_marketing_agent.brevo_add_contacts_to_list",
    ),
    (
        "brevo_remove_contacts_from_list",
        "tools.email_marketing_agent.brevo_remove_contacts_from_list",
    ),
    ("brevo_list_campaigns", "tools.email_marketing_agent.brevo_list_campaigns"),
    ("brevo_get_campaign", "tools.email_marketing_agent.brevo_get_campaign"),
    (
        "brevo_create_campaign",
        "tools.email_marketing_agent.brevo_create_campaign",
    ),
    (
        "brevo_send_campaign_now",
        "tools.email_marketing_agent.brevo_send_campaign_now",
    ),
    (
        "brevo_schedule_campaign",
        "tools.email_marketing_agent.brevo_schedule_campaign",
    ),
    (
        "brevo_get_campaign_stats",
        "tools.email_marketing_agent.brevo_get_campaign_stats",
    ),
    (
        "brevo_delete_campaign",
        "tools.email_marketing_agent.brevo_delete_campaign",
    ),
    (
        "brevo_send_transactional_email",
        "tools.email_marketing_agent.brevo_send_transactional_email",
    ),
    ("brevo_list_templates", "tools.email_marketing_agent.brevo_list_templates"),
    ("brevo_get_template", "tools.email_marketing_agent.brevo_get_template"),
    ("brevo_get_smtp_events", "tools.email_marketing_agent.brevo_get_smtp_events"),
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


@pytest.mark.parametrize(("tool_name", "identifier"), BREVO_TOOL_CASES)
async def test_brevo_tool_live_integration(
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
