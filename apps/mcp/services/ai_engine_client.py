import os
from typing import List, Optional, Dict, Any
from datetime import datetime

import httpx
from models.credential import Credential
from models.tool_execution import ToolExecution
from utils.http_client import BaseHTTPClient, handle_http_status_error
from models.automations.workflow_template import WorkflowTemplate
from models.automations.workflow_session import WorkflowSession
from fastmcp.exceptions import ToolError
import jwt


def get_mcp_auth_header() -> str:
    jwt_secret = os.getenv("JWT_SECRET")
    jwt_algorithm = os.getenv("JWT_ALGORITHM", "HS256")

    if not jwt_secret:
        raise ValueError("JWT_SECRET environment variable is required")

    payload = {
        "email": "mcp@igniticai.com",
        "exp": 9999999999,
        "role": "admin",
        "user_id": "mcp_server",
    }

    token = jwt.encode(payload, jwt_secret, algorithm=jwt_algorithm)
    return f"Bearer {token}"


class AIEngineClient:
    def __init__(self, base_url: Optional[str] = None, auth: Optional[str] = None):
        self.base_url = base_url or os.getenv(
            "AI_ENGINE_BASE_URL", "http://localhost:8010"
        )
        self.auth = auth or get_mcp_auth_header()
        self.http_client = BaseHTTPClient(self.base_url)

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.auth:
            headers["Authorization"] = self.auth
        return headers

    @staticmethod
    def _parse_datetime_fields(
        data: Dict[str, Any], fields: List[str]
    ) -> Dict[str, Any]:
        for field in fields:
            if field in data and isinstance(data[field], str):
                try:
                    data[field] = datetime.fromisoformat(
                        data[field].replace("Z", "+00:00")
                    )
                except ValueError:
                    pass
        return data

    # Workflow operations
    async def get_workflow_templates(self) -> List[WorkflowTemplate]:
        try:
            data = await self.http_client.get(
                "/api/v1/workflow-template/?limit=0", headers=self._get_headers()
            )
            return [WorkflowTemplate(**item) for item in data]
        except httpx.HTTPStatusError as e:
            handle_http_status_error(e)
            raise

    async def get_workflow_session(self, ignitic_identifier: str) -> WorkflowSession:
        try:
            data = await self.http_client.post(
                "/api/v1/workflow-session/",
                data={"ignitic_identifier": ignitic_identifier},
                headers=self._get_headers(),
            )

            # Parse datetime strings to datetime objects
            datetime_fields = ["created_at", "expires_at", "last_activity_at"]
            data = self._parse_datetime_fields(data, datetime_fields)

            return WorkflowSession(**data)
        except httpx.HTTPStatusError as e:
            print("HTTP Status Error:", e)
            handle_http_status_error(e)
            raise

    async def get_credential(self, credential_name: str) -> Credential:
        try:
            data = await self.http_client.get(
                f"/api/v1/credential/{credential_name}",
                headers=self._get_headers(),
            )

            return Credential(**data)
        except httpx.HTTPStatusError as e:
            print("HTTP Status Error:", e)
            handle_http_status_error(e)
            raise

    async def log_tool_execution(
        self,
        tool_name: str,
        ignitic_identifier: str,
        chat_id: str,
        status: Optional[str] = None,
        input_payload: Optional[Dict[str, Any]] = None,
        response_payload: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        is_workflow: bool = False,
        workflow_provider: Optional[str] = None,
    ) -> ToolExecution:
        try:
            payload = {
                "tool_name": tool_name,
                "ignitic_identifier": ignitic_identifier,
                "chat_id": chat_id,
                "status": status,
                "input_payload": input_payload or {},
                "response_payload": response_payload,
                "error": error,
                "is_workflow": is_workflow,
                "workflow_provider": workflow_provider,
            }
            data = await self.http_client.post(
                "/api/v1/analytics/tool/executions",
                data=payload,
                headers=self._get_headers(),
            )

            datetime_fields = ["created_at", "updated_at"]
            data = self._parse_datetime_fields(data, datetime_fields)

            return ToolExecution(**data)
        except httpx.HTTPStatusError as e:
            print("HTTP Status Error:", e)
            handle_http_status_error(e)
            raise

    async def update_tool_execution(
        self,
        execution_id: str,
        tool_name: Optional[str] = None,
        ignitic_identifier: Optional[str] = None,
        chat_id: Optional[str] = None,
        status: Optional[str] = None,
        input_payload: Optional[Dict[str, Any]] = None,
        response_payload: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
        is_workflow: Optional[bool] = None,
        workflow_provider: Optional[str] = None,
    ) -> ToolExecution:
        update_data = {
            "tool_name": tool_name,
            "ignitic_identifier": ignitic_identifier,
            "chat_id": chat_id,
            "status": status,
            "input_payload": input_payload,
            "response_payload": response_payload,
            "error": error,
            "is_workflow": is_workflow,
            "workflow_provider": workflow_provider,
        }
        update_data = {
            key: value for key, value in update_data.items() if value is not None
        }
        if not update_data:
            raise ToolError("No fields provided for update")

        try:
            data = await self.http_client.patch(
                f"/api/v1/analytics/tool/executions/{execution_id}",
                data=update_data,
                headers=self._get_headers(),
            )

            datetime_fields = ["created_at", "updated_at"]
            data = self._parse_datetime_fields(data, datetime_fields)

            return ToolExecution(**data)
        except httpx.HTTPStatusError as e:
            print("HTTP Status Error:", e)
            handle_http_status_error(e)
            raise

    async def close(self):
        await self.http_client.close()
