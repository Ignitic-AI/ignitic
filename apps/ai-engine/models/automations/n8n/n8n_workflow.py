from beanie import Document
from pydantic import BaseModel, Field, HttpUrl
from typing import Any, Dict, List, Optional
from models.automations.n8n.n8n_credential import N8NNodeCredentialData, N8NCredentialType
from datetime import datetime
from uuid import uuid4

class N8NNode(BaseModel):
    parameters: Dict[str, Any]
    type: str
    typeVersion: float
    position: List[int]
    id: str
    name: str
    webhookId: Optional[str] = Field(default=str(uuid4()))
    credentials: Optional[Dict[N8NCredentialType, N8NNodeCredentialData]] = Field(default={})
    disabled: Optional[bool] = Field(default=False)
    notesInFlow: Optional[bool] = Field(default=False)
    notes: Optional[str] = Field(default='No notes provided')
    executeOnce: Optional[bool] = Field(default=False)
    alwaysOutputData: Optional[bool] = Field(default=False)
    retryOnFail: Optional[bool] = Field(default=False)
    maxTries: Optional[int] = Field(default=0)
    waitBetweenTries: Optional[int] = Field(default=0)
    onError: Optional[str] = Field(default='stopWorkflow')


class N8NWorkflowData(BaseModel):
    name: str
    nodes: List[N8NNode]
    connections: Dict[str, Any]
    settings: Optional[Dict[str, Any]] = None
    staticData: Optional[Dict[str, Any]] = None


class DeployedN8NWorkflow(Document):
    n8n_id: str
    ignitic_identifier: Optional[str] = None
    webhook_url: Optional[HttpUrl] = None
    active: bool = Field(default=False)
    template_id: Optional[str] = None
    u_id: Optional[str] = None
    org_id: Optional[str] = None

    createdAt: datetime = Field(default_factory=datetime.now)
    updatedAt: datetime = Field(default_factory=datetime.now)

    class Settings:
        name = "deployed_n8n_workflows"
