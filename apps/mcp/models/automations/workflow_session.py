from pydantic import BaseModel, Field, HttpUrl
from typing import Optional, Literal
from datetime import datetime, timedelta
from enum import Enum


class SessionStatus(str, Enum):
    """Tool session status enumeration."""

    CREATING = "creating"
    ACTIVE = "active"
    EXECUTING = "executing"
    EXPIRED = "expired"
    CLEANING_UP = "cleaning_up"


class WorkflowSession(BaseModel):
    """
    Tool session document for ephemeral workflow deployments.

    Represents a temporary workflow deployment session similar to payment checkout sessions.
    """
    id: Optional[str] = Field(default=None, alias="_id", description="Unique session ID")
    template_id: str = Field(
        ..., description="Workflow template ID used for this session"
    )
    ignitic_identifier: str = Field(..., description="Template ignitic identifier")

    # Deployment details
    workflow_id: Optional[str] = Field(default=None, description="Deployed workflow ID")
    workflow_url: Optional[HttpUrl] = Field(default=None, description="Tool webhook URL")

    # Session management
    status: SessionStatus = Field(
        default=SessionStatus.CREATING, description="Current session status"
    )
    created_at: datetime = Field(
        default_factory=datetime.now, description="Session creation time"
    )
    expires_at: datetime = Field(
        default_factory=lambda: datetime.now() + timedelta(minutes=5),
        description="Session expiration time",
    )
    last_activity_at: datetime = Field(
        default_factory=datetime.now, description="Last activity timestamp"
    )

    # Execution tracking
    active_executions_count: int = Field(
        default=0, description="Number of executions currently in progress"
    )

    # User/Organization
    u_id: str = Field(..., description="User ID")
    org_id: Optional[str] = Field(default=None, description="Organization ID")
