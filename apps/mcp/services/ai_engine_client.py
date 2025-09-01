import os
from typing import List, Optional, Dict, Any
from utils.http_client import BaseHTTPClient
from models.automations.workflow_template import WorkflowTemplate

class AIEngineClient:
    def __init__(self, base_url: Optional[str] = None, api_key: Optional[str] = None):
        self.base_url = base_url or os.getenv("AI_ENGINE_BASE_URL", "http://localhost:8010")
        self.api_key = api_key or os.getenv("AI_ENGINE_API_KEY")
        self.http_client = BaseHTTPClient(self.base_url)
    
    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers
    
    # Workflow operations
    async def get_workflow_templates(self) -> List[WorkflowTemplate]:
        data = await self.http_client.get("/api/v1/workflow-template/?limit=0", headers=self._get_headers())
        return [WorkflowTemplate(**item) for item in data]
    
    # async def get_workflow_template(self, workflow_id: str) -> N8NWorkflowTemplate:
    #     data = await self.http_client.get(f"/api/v1/workflows/{workflow_id}", headers=self._get_headers())
    #     return N8NWorkflowTemplate(**data)
    
    
    async def close(self):
        await self.http_client.close()