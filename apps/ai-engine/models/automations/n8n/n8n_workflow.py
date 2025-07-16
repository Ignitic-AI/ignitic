from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from models.automations.n8n.n8n_credential import N8NNodeCredentialData, N8NCredentialType

class N8NNode(BaseModel):
    parameters: Dict[str, Any]
    type: str
    typeVersion: float
    position: List[int]
    id: str
    name: str
    webhookId: Optional[str] = None
    credentials: Optional[Dict[N8NCredentialType, N8NNodeCredentialData]] = None


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

