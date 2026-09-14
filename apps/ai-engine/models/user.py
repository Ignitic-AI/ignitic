

from typing import Literal, Optional
from pydantic import BaseModel, EmailStr, Field


class User(BaseModel):
    """
    User model representing an authenticated user.
    
    Attributes:
        id: Unique user identifier
        email: User's email address
        name: User's display name (optional)
        role: User's role in the system
        org_id: Organization identifier (optional)
    """
    id: str = Field(..., description="Unique user identifier")
    email: EmailStr = Field(..., description="User's email address")
    name: Optional[str] = Field(None, description="User's display name")
    role: Literal["admin", "user"] = Field(default="user", description="User's role")
    org_id: Optional[str] = Field(None, description="Organization identifier")
    
    class Config:
        """Pydantic configuration."""
        json_schema_extra = {
            "example": {
                "id": "123",
                "email": "user@example.com",
                "name": "John Doe",
                "role": "user",
                "org_id": "org_456"
            }
        }