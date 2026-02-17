from datetime import datetime
from typing import Any, Dict, Optional, Literal

from pydantic import BaseModel, Field


class ToolExecution(BaseModel):
    id: Optional[str] = Field(default=None, alias="_id", description="Execution ID")
    tool_name: str = Field(..., description="The name of the tool executed")
    ignitic_identifier: str = Field(
        ..., description="Ignitic identifier for tracing tool execution"
    )
    chat_id: Optional[str] = Field(
        default=None, description="The unique identifier for the chat session"
    )
    u_id: str = Field(..., description="Unique user identifier")
    org_id: Optional[str] = Field(
        default=None, description="Unique organization identifier"
    )
    status: Literal["running", "succeeded", "failed"] = Field(
        default="running", description="Current execution status"
    )
    input_payload: Dict[str, Any] = Field(
        default_factory=dict, description="Input payload for the tool call"
    )
    response_payload: Optional[Dict[str, Any]] = Field(
        default=None, description="Tool response payload, if available"
    )
    error: Optional[str] = Field(
        default=None, description="Error message if execution failed"
    )
    is_workflow: bool = Field(
        default=False, description="Whether this execution is part of a workflow"
    )
    workflow_provider: Optional[str] = Field(
        default=None, description="Workflow provider name (e.g., n8n, make.com)"
    )
    created_at: datetime = Field(
        default_factory=datetime.now,
        description="Timestamp when the tool execution was created",
    )
    updated_at: datetime = Field(
        default_factory=datetime.now,
        description="Timestamp when the tool execution was last updated",
    )
