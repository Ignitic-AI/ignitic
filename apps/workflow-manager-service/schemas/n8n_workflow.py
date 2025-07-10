from pydantic import BaseModel, field_validator
from typing import Any, Dict, List, Optional
from schemas.workflow import Workflow

class N8NNode(BaseModel):
    parameters: Dict[str, Any]
    type: str
    typeVersion: int
    position: List[int]
    id: str
    name: str
    webhookId: Optional[str] = None


class N8NWorkflowData(BaseModel):
    name: str
    nodes: List[N8NNode]
    connections: Dict[str, Any]
    active: bool
    settings: Optional[Dict[str, Any]] = None
    pinData: Optional[Dict[str, Any]] = None
    versionId: Optional[str] = None
    meta: Optional[Dict[str, Any]] = None
    id: Optional[str] = None
    tags: Optional[List[Any]] = None

class N8NWorkflow(Workflow):
    n8n_json: N8NWorkflowData

    class Settings:
        name = "n8n_workflows"