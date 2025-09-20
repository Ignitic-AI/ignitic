import os
from typing import List, Optional, Dict, Any

import httpx
from utils.http_client import BaseHTTPClient, handle_http_status_error
from models.automations.workflow_template import WorkflowTemplate
from models.automations.workflow import DeployedWorkflow



class AIEngineClient:
    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = base_url or os.getenv(
            "AI_ENGINE_BASE_URL"
        )
        self.api_key = api_key or os.getenv("AI_ENGINE_API_KEY")
        self.http_client = BaseHTTPClient(self.base_url)

    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

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

    async def get_workflow(self, workflow_id: str) -> DeployedWorkflow:
        try:
            data = await self.http_client.get(
                f"/api/v1/workflow/{workflow_id}", headers=self._get_headers()
            )
            return DeployedWorkflow(**data)
        except httpx.HTTPStatusError as e:
            handle_http_status_error(e)
            raise
    
    async def deploy_workflow(self, workflow_id: str) -> DeployedWorkflow:
        try:
            data = await self.http_client.post(
                f"/api/v1/workflow/deploy/{workflow_id}", headers=self._get_headers()
            )
            return DeployedWorkflow(**data)
        except httpx.HTTPStatusError as e:
            handle_http_status_error(e)
            raise

    async def close(self):
        await self.http_client.close()
