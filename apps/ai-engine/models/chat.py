

from datetime import datetime
from typing import List, Literal, Optional
from beanie import Document
from pydantic import Field


class Chat(Document):
    """
    Represents a chat session in the system.
    
    Attributes:
        
    """
    u_id: str = Field(..., description="Unique user identifier")
    org_id: Optional[str] = Field(None, description="Unique organization identifier")
    thread_id: str = Field(..., description="Unique thread identifier")
    agents: List[Literal["product_researcher_agent", "marketer_agent"]] = Field(
        default=[],
        description="The agent handling the chat"
    )
    name: Optional[str] = Field(
        None, description="Human-readable name for the chat"
    )
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update timestamp")
    
    class Settings:
        name = "chats"