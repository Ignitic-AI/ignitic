import logging
from typing import Any, TypedDict
from fastmcp import FastMCP
from fastmcp.exceptions import NotFoundError
from fastmcp.server.dependencies import get_http_headers
from fastmcp.server.middleware import Middleware, MiddlewareContext
from fastmcp.server.middleware.middleware import CallNext
from fastmcp.tools.tool import ToolResult
from mcp.types import CallToolRequestParams
from services.ai_engine_client import AIEngineClient


class AuthenticationMiddleware(Middleware):
    async def on_message(
        self, context: MiddlewareContext[Any], call_next: CallNext[Any, Any]
    ) -> Any:
        headers = get_http_headers()
        auth_header = headers.get("Authorization") or headers.get("authorization")
        chat_id = headers.get("X-Chat-ID") or headers.get("x-chat-id")

        if not auth_header:
            raise NotFoundError("Authorization header is required")

        fastmcp_context = context.fastmcp_context

        if not fastmcp_context:
            raise NotFoundError("FastMCP context is not available")

        fastmcp_context.set_state("auth_header", auth_header)
        fastmcp_context.set_state("chat_id", chat_id)

        return await call_next(context)


class ExecutionLoggingMiddleware(Middleware):
    def __init__(self) -> None:
        self.logger = logging.getLogger("fastmcp.requests")

    async def on_call_tool(
        self,
        context: MiddlewareContext[CallToolRequestParams],
        call_next: CallNext[CallToolRequestParams, ToolResult],
    ) -> ToolResult:

        fastmcp_context = context.fastmcp_context

        if not fastmcp_context:
            raise NotFoundError("FastMCP context is not available")

        auth = fastmcp_context.get_state("auth_header")
        chat_id = fastmcp_context.get_state("chat_id")
        engine_client = AIEngineClient(auth=auth)

        tool_info = await get_tool_info(fastmcp_context.fastmcp, context.message.name)

        self.logger.info(
            f"Starting tool execution: {context.message.name} "
            f"(ignitic_id: {tool_info['ignitic_identifier']}, chat_id: {chat_id})"
        )

        tool_execution_log = None

        try:
            tool_execution_log = await engine_client.log_tool_execution(
                tool_name=context.message.name,
                ignitic_identifier=tool_info["ignitic_identifier"],
                chat_id=chat_id,
                input_payload=context.message.arguments,
                is_workflow=tool_info["is_workflow"],
                workflow_provider=tool_info["workflow_provider"],
            )
            self.logger.info(
                f"Tool execution logged with ID: {tool_execution_log.id if tool_execution_log else 'N/A'}"
            )
        except Exception as e:
            self.logger.error(f"Failed to log tool execution: {e}")

        # Execute the tool and capture success/failure
        status = "succeeded"

        try:
            result = await call_next(context)

            self.logger.info(
                f"Tool execution succeeded: {context.message.name} "
                f"(execution_id: {tool_execution_log.id if tool_execution_log else 'N/A'})"
            )

            # Update tool execution log on success
            if tool_execution_log and tool_execution_log.id:
                try:
                    # Extract response payload from ToolResult
                    response_payload = None
                    if result.structured_content:
                        response_payload = result.structured_content
                    elif result.content:
                        # Convert content blocks to a serializable format
                        response_payload = {
                            "content": [
                                {
                                    "type": block.type,
                                    "text": getattr(block, "text", str(block)),
                                }
                                for block in result.content
                            ]
                        }

                    await engine_client.update_tool_execution(
                        execution_id=tool_execution_log.id,
                        status=status,
                        response_payload=response_payload,
                        error=None,
                    )
                    self.logger.info(
                        f"✓ Tool execution log updated successfully (execution_id: {tool_execution_log.id})"
                    )
                except Exception as e:
                    self.logger.error(
                        f"✗ Failed to update tool execution log on success (execution_id: {tool_execution_log.id}): {e}",
                        exc_info=True,
                    )

            return result

        except Exception as e:
            self.logger.error(
                f"Tool execution failed: {context.message.name} "
                f"(execution_id: {tool_execution_log.id if tool_execution_log else 'N/A'}), "
                f"error: {str(e)}",
                exc_info=True,
            )

            # Update tool execution log on failure
            if tool_execution_log and tool_execution_log.id:
                try:
                    self.logger.info(
                        f"Attempting to update execution log with failure status "
                        f"(execution_id: {tool_execution_log.id})"
                    )
                    await engine_client.update_tool_execution(
                        execution_id=tool_execution_log.id,
                        status="failed",
                        response_payload=None,
                        error=str(e),
                    )
                    self.logger.info(
                        f"✓ Tool execution log updated with failure status (execution_id: {tool_execution_log.id})"
                    )
                except Exception as log_error:
                    self.logger.error(
                        f"✗ Failed to update tool execution log (execution_id: {tool_execution_log.id}): {log_error}",
                        exc_info=True,
                    )
            else:
                self.logger.warning(
                    f"Cannot update execution log - no execution_log or id present "
                    f"(has_log: {tool_execution_log is not None}, "
                    f"has_id: {tool_execution_log.id if tool_execution_log else 'N/A'})"
                )

            # Re-raise the original exception
            raise


class ToolInfo(TypedDict):
    name: str
    ignitic_identifier: str
    is_workflow: bool
    workflow_provider: str


async def get_tool_info(server: FastMCP, tool_name: str):
    tool = await server.get_tool(tool_name)

    if tool:
        meta = tool.meta or {}
        ignitic_identifier = meta.get("ignitic_identifier")

        if not ignitic_identifier:
            raise NotFoundError(f"Ignitic identifier not found for tool '{tool_name}'")

        return {
            "name": tool_name,
            "ignitic_identifier": ignitic_identifier,
            "is_workflow": meta.get("is_workflow", False),
            "workflow_provider": meta.get("workflow_provider", "n8n"),
        }
    else:
        raise NotFoundError(f"Tool '{tool_name}' not found")
