from beanie import Document
from pydantic import BaseModel, Field, HttpUrl, validator
from typing import Any, Dict, List, Optional
from models.automations.n8n.n8n_credential import (
    N8NNodeCredentialData,
    N8NCredentialType,
)
from datetime import datetime
from uuid import uuid4
from models.automations.workflow import DeployedWorkflow


class N8NNode(BaseModel):
    """
    N8N workflow node configuration.

    Attributes:
        parameters: Node-specific parameters
        type: Node type identifier
        typeVersion: Node type version
        position: Node position in the workflow
        id: Unique node identifier
        name: Human-readable node name
        webhookId: Webhook identifier (for webhook nodes)
        credentials: Node credentials configuration
        disabled: Whether the node is disabled
        notesInFlow: Whether notes are shown in flow
        notes: Node notes/description
        executeOnce: Whether to execute only once
        alwaysOutputData: Whether to always output data
        retryOnFail: Whether to retry on failure
        maxTries: Maximum number of retry attempts
        waitBetweenTries: Wait time between retries
        onError: Error handling behavior
    """

    parameters: Dict[str, Any] = Field(..., description="Node-specific parameters")
    type: str = Field(..., description="Node type identifier")
    typeVersion: float = Field(..., description="Node type version")
    position: List[int] = Field(..., description="Node position in the workflow")
    id: str = Field(..., description="Unique node identifier")
    name: str = Field(..., description="Human-readable node name")
    webhookId: Optional[str] = Field(
        default_factory=lambda: str(uuid4()), description="Webhook identifier"
    )
    credentials: Optional[Dict[str, N8NNodeCredentialData]] = Field(
        default_factory=dict, description="Node credentials"
    )
    disabled: bool = Field(default=False, description="Whether the node is disabled")
    notesInFlow: bool = Field(
        default=False, description="Whether notes are shown in flow"
    )
    notes: str = Field(
        default="No notes provided", description="Node notes/description"
    )
    executeOnce: bool = Field(default=False, description="Whether to execute only once")
    alwaysOutputData: bool = Field(
        default=False, description="Whether to always output data"
    )
    retryOnFail: bool = Field(default=False, description="Whether to retry on failure")
    maxTries: int = Field(default=0, description="Maximum number of retry attempts")
    waitBetweenTries: int = Field(default=0, description="Wait time between retries")
    onError: str = Field(default="stopWorkflow", description="Error handling behavior")

    @validator("type")
    def validate_type(cls, v):
        """Validate node type."""
        if not v or len(v.strip()) == 0:
            raise ValueError("Node type cannot be empty")
        return v.strip()

    @validator("name")
    def validate_name(cls, v):
        """Validate node name."""
        if not v or len(v.strip()) == 0:
            raise ValueError("Node name cannot be empty")
        return v


class N8NWorkflowData(BaseModel):
    """
    N8N workflow configuration data.

    Attributes:
        name: Workflow name
        nodes: List of workflow nodes
        connections: Node connections configuration
        settings: Workflow settings (optional)
        staticData: Static data configuration (optional)
    """

    name: str = Field(..., description="Workflow name")
    nodes: List[N8NNode] = Field(..., description="List of workflow nodes")
    connections: Dict[str, Any] = Field(
        ..., description="Node connections configuration"
    )
    settings: Optional[Dict[str, Any]] = Field(
        default=None, description="Workflow settings"
    )
    staticData: Optional[Dict[str, Any]] = Field(
        default=None, description="Static data configuration"
    )

    @validator("name")
    def validate_name(cls, v):
        """Validate workflow name."""
        if not v or len(v.strip()) == 0:
            raise ValueError("Workflow name cannot be empty")
        return v.strip()

    @validator("nodes")
    def validate_nodes(cls, v):
        """Validate nodes list."""
        if not v or len(v) == 0:
            raise ValueError("Workflow must have at least one node")
        return v


class DeployedN8NWorkflow(DeployedWorkflow):
    """
    Deployed N8N workflow document.

    Represents a workflow that has been deployed to an N8N instance.

    Attributes:
        n8n_id: N8N workflow identifier
    """

    n8n_id: str = Field(..., description="N8N workflow identifier")

    @validator("n8n_id")
    def validate_n8n_id(cls, v):
        """Validate N8N ID."""
        if not v or len(v.strip()) == 0:
            raise ValueError("n8n_id cannot be empty")
        return v.strip()
