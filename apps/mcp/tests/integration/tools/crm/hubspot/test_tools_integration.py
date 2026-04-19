import inspect

import pytest

from servers.hubspot_mcp import app as hubspot_mcp

pytestmark = [pytest.mark.integration_live, pytest.mark.asyncio]

HUBSPOT_TOOL_CASES = [
    ("hubspot_crm_search", "tools.hubspot_agent.hubspot_crm_search"),
    ("hubspot_crm_get", "tools.hubspot_agent.hubspot_crm_get"),
    ("hubspot_crm_create", "tools.hubspot_agent.hubspot_crm_create"),
    ("hubspot_crm_update", "tools.hubspot_agent.hubspot_crm_update"),
    ("hubspot_crm_archive", "tools.hubspot_agent.hubspot_crm_archive"),
    ("hubspot_crm_batch_read", "tools.hubspot_agent.hubspot_crm_batch_read"),
    ("hubspot_crm_batch_create", "tools.hubspot_agent.hubspot_crm_batch_create"),
    ("hubspot_crm_batch_update", "tools.hubspot_agent.hubspot_crm_batch_update"),
    ("hubspot_crm_batch_archive", "tools.hubspot_agent.hubspot_crm_batch_archive"),
    ("hubspot_crm_batch_upsert", "tools.hubspot_agent.hubspot_crm_batch_upsert"),
    ("hubspot_contacts_merge", "tools.hubspot_agent.hubspot_contacts_merge"),
    (
        "hubspot_crm_properties_list",
        "tools.hubspot_agent.hubspot_crm_properties_list",
    ),
    ("hubspot_deal_pipelines", "tools.hubspot_agent.hubspot_deal_pipelines"),
    ("hubspot_ticket_pipelines", "tools.hubspot_agent.hubspot_ticket_pipelines"),
    ("hubspot_owners_list", "tools.hubspot_agent.hubspot_owners_list"),
    (
        "hubspot_custom_object_schemas",
        "tools.hubspot_agent.hubspot_custom_object_schemas",
    ),
    (
        "hubspot_association_labels_list",
        "tools.hubspot_agent.hubspot_association_labels_list",
    ),
    (
        "hubspot_associations_create_batch",
        "tools.hubspot_agent.hubspot_associations_create_batch",
    ),
    (
        "hubspot_associations_read_batch",
        "tools.hubspot_agent.hubspot_associations_read_batch",
    ),
    (
        "hubspot_associations_archive_batch",
        "tools.hubspot_agent.hubspot_associations_archive_batch",
    ),
    ("hubspot_companies_merge", "tools.hubspot_agent.hubspot_companies_merge"),
    ("hubspot_lists_search", "tools.hubspot_agent.hubspot_lists_search"),
    ("hubspot_list_get", "tools.hubspot_agent.hubspot_list_get"),
    (
        "hubspot_list_memberships_join_order",
        "tools.hubspot_agent.hubspot_list_memberships_join_order",
    ),
    (
        "hubspot_list_memberships_add_remove",
        "tools.hubspot_agent.hubspot_list_memberships_add_remove",
    ),
    (
        "hubspot_list_record_memberships",
        "tools.hubspot_agent.hubspot_list_record_memberships",
    ),
    ("hubspot_files_search", "tools.hubspot_agent.hubspot_files_search"),
    ("hubspot_file_get", "tools.hubspot_agent.hubspot_file_get"),
    ("hubspot_folder_get", "tools.hubspot_agent.hubspot_folder_get"),
    ("hubspot_forms_list", "tools.hubspot_agent.hubspot_forms_list"),
    (
        "hubspot_communication_preferences_definitions",
        "tools.hubspot_agent.hubspot_communication_preferences_definitions",
    ),
    (
        "hubspot_communication_preferences_statuses_get",
        "tools.hubspot_agent.hubspot_communication_preferences_statuses_get",
    ),
    (
        "hubspot_crm_pipelines_list",
        "tools.hubspot_agent.hubspot_crm_pipelines_list",
    ),
    (
        "hubspot_marketing_emails_list",
        "tools.hubspot_agent.hubspot_marketing_emails_list",
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


@pytest.mark.parametrize(("tool_name", "identifier"), HUBSPOT_TOOL_CASES)
async def test_hubspot_tool_live_integration(
    require_live_integration: None,
    live_jwt_bearer: str,
    live_chat_id: str,
    live_crm_payloads: dict,
    tool_name: str,
    identifier: str,
):
    tool = await hubspot_mcp._tool_manager.get_tool(tool_name)

    arguments = payload_for_tool(live_crm_payloads, identifier, tool_name)
    missing = required_params_missing(tool.fn, arguments)
    assert not missing, (
        f"Missing required payload args for {identifier}: {', '.join(missing)}. "
        "Update tests/integration/live_payloads/crm_tool_payloads.json"
    )

    inject_headers_into_tool(tool.fn, live_jwt_bearer, live_chat_id)

    result = await tool.run(arguments)
    assert result is not None
