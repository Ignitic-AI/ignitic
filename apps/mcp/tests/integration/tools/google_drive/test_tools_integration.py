import inspect

import pytest

from servers.gdrive_mcp import app as gdrive_mcp

pytestmark = [pytest.mark.integration_live, pytest.mark.asyncio]

GOOGLE_DRIVE_TOOL_CASES = [
    ("search_files", "tools.gdrive_agent.search_files"),
    ("list_files", "tools.gdrive_agent.list_files"),
    ("get_file_metadata", "tools.gdrive_agent.get_file_metadata"),
    ("read_file_content", "tools.gdrive_agent.read_file_content"),
    ("delete_file", "tools.gdrive_agent.delete_file"),
    ("copy_file", "tools.gdrive_agent.copy_file"),
    ("move_file", "tools.gdrive_agent.move_file"),
    ("create_folder", "tools.gdrive_agent.create_folder"),
    ("create_text_file", "tools.gdrive_agent.create_text_file"),
    ("update_file_content", "tools.gdrive_agent.update_file_content"),
    ("share_file", "tools.gdrive_agent.share_file"),
    ("list_permissions", "tools.gdrive_agent.list_permissions"),
    ("remove_permission", "tools.gdrive_agent.remove_permission"),
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


@pytest.mark.parametrize(("tool_name", "identifier"), GOOGLE_DRIVE_TOOL_CASES)
async def test_google_drive_tool_live_integration(
    require_live_integration: None,
    live_jwt_bearer: str,
    live_chat_id: str,
    live_google_drive_payloads: dict,
    tool_name: str,
    identifier: str,
):
    tool = await gdrive_mcp._tool_manager.get_tool(tool_name)

    arguments = payload_for_tool(live_google_drive_payloads, identifier, tool_name)
    missing = required_params_missing(tool.fn, arguments)
    assert not missing, (
        f"Missing required payload args for {identifier}: {', '.join(missing)}. "
        "Update tests/integration/live_payloads/google_drive_tool_payloads.json"
    )

    inject_headers_into_tool(tool.fn, live_jwt_bearer, live_chat_id)

    result = await tool.run(arguments)
    assert result is not None
