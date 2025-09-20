from datetime import datetime
from typing import Annotated, Any, Dict, Optional
from pydantic import BaseModel, Field, model_validator
from beanie import Document, PydanticObjectId
from enum import Enum


class WorkflowCredential(Document):
    type: str
    u_id: Optional[str] = None
    org_id: Optional[str] = None
    name: str
    created_at: datetime = Field(
        default_factory=datetime.now, description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.now, description="Last update timestamp"
    )

    class Settings:
        name = "workflow_credentials"
        is_root=True

