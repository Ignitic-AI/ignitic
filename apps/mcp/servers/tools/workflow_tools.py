import requests
from services.ai_engine_client import AIEngineClient
from models.automations.workflow_template import WorkflowTemplate
from servers.marketer_mcp import app as marketer_mcp
from servers.product_researcher_mcp import app as product_researcher_mcp
from utils.dynamic_models import register_dynamic_model
from fastmcp.server.dependencies import get_http_headers
from core.auth import get_user_auth
from utils.exception_handling import NotFoundError
from fastmcp.exceptions import ToolError

AGENT_MCPS = {
    "marketer": marketer_mcp,
    "product_researcher": product_researcher_mcp,
}


async def register_workflow_tools():
    ai_engine_client = AIEngineClient()
    workflow_templates = await ai_engine_client.get_workflow_templates()
    for template in workflow_templates:
        await register_workflow_tool(template)


async def register_workflow_tool(workflow_template: WorkflowTemplate):
    ignitic_identifier = workflow_template.ignitic_identifier
    tool_name = ignitic_identifier.split(".")[-1]
    agent = ignitic_identifier.split(".")[-2]

    if agent not in AGENT_MCPS.keys():
        print("No MCP found for workflow:", ignitic_identifier)

    mcp_app = AGENT_MCPS[agent]

    InputModel = register_dynamic_model(
        {k: v for k, v in (workflow_template.inputs or {}).items()},
        f"{tool_name}_input",
    )
    OutputModel = register_dynamic_model(
        {k: v for k, v in (workflow_template.outputs or {}).items()},
        f"{tool_name}_output",
    )

    async def dynamic_func(input_obj: InputModel) -> OutputModel:  # type: ignore
        headers = get_http_headers()
        auth_header = headers.get("Authorization", "")

        engine_client = AIEngineClient(api_key=auth_header)

        try:
            workflow = await engine_client.get_workflow(
                workflow_template.ignitic_identifier
            )
        except NotFoundError:
            workflow = await engine_client.deploy_workflow(
                workflow_template.ignitic_identifier
            )

        if not workflow.active:
            raise ToolError(
                f"{tool_name} is not active. Ask the user to activate it for usage or try another tool"
            )

        resp = requests.post(str(workflow.webhook_url), json=input_obj.dict())
        resp.raise_for_status()
        return OutputModel(**resp.json())

    dynamic_func.__name__ = tool_name
    dynamic_func.__doc__ = workflow_template.description

    globals()[tool_name] = dynamic_func

    mcp_app.add_tool(
        globals()[tool_name],
    )
