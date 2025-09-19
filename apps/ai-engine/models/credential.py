from datetime import datetime
from typing import Any, Optional, Dict
from pydantic import BaseModel, Field


class Credential(BaseModel):
    name: str
    u_id: str = Field(..., description="User ID")
    org_id: Optional[str] = Field(default=None, description="Organization ID")
    data: Dict[str, Any] = Field(..., description="Credential data")
    updatedAt: datetime = Field(
        default_factory=datetime.now, description="Last updated timestamp"
    )

    
