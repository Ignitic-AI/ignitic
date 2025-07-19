# mcp_plexus/services/models.py
from pydantic import BaseModel, Field, HttpUrl, SecretStr
from typing import Dict, List, Literal, Optional
from datetime import datetime, timezone


class UserApiKeySubmissionRequest(BaseModel):
    """Request model for user API key submission to external services."""
    
    provider_name: str = Field(
        description="Identifier for the external service (e.g., 'openai', 'google_maps')."
    )
    api_key_value: SecretStr = Field(
        description="The API key value provided by the user."
    )


class StoredUserExternalApiKey(BaseModel):
    """Model representing a user's encrypted API key stored in the system."""
    
    entity_id: str
    persistent_user_id: str
    provider_name: str
    encrypted_api_key_value: str  # The Fernet-encrypted API key
    registered_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    last_updated_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc)
    )

    class Config:
        # Enable compatibility with ORM objects like SQLAlchemy
        orm_mode = True
        from_attributes = True  # Pydantic V2 compatibility


class WebhookToolInput(BaseModel):
    type: str
    description: Optional[str] = None
    default: Optional[str] = None
    required: Optional[bool] = True

class WebhookToolOutput(BaseModel):
    type: str
    description: Optional[str] = None

class WebhookTool(BaseModel):
    name: str
    description: str
    webhook_url: HttpUrl
    inputs: Optional[Dict[str, WebhookToolInput]] = None
    outputs: Optional[Dict[str, WebhookToolOutput]] = None
    tool_sets: Optional[List[Literal['marketing']]] = None
    u_id: Optional[str] = None
    org_id: Optional[str] = None