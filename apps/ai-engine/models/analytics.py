from datetime import datetime
from typing import List, Optional
from beanie import Document
from pydantic import Field


class AgentRun(Document):
    agent_identifier: str = Field(
        ..., description="the unique identifier for the agent"
    )
    agent_name: str = Field(..., description="the name of the agent")
    u_id: str = Field(..., description="Unique user identifier")
    org_id: Optional[str] = Field(
        default=None, description="Unique organization identifier"
    )
    chat_id: str = Field(..., description="the unique identifier for the chat session")
    thread_id: str = Field(..., description="the unique identifier for the thread")
    message_id: Optional[str] = Field(
        default=None,
        description="message id associated with the agent run",
    )
    tool_calls: List[str] = Field(
        default_factory=list,
        description="List of tool call ids made during the agent run",
    )
    input_tokens: int = Field(
        default=0, description="Number of input tokens used during the agent run"
    )
    output_tokens: int = Field(
        default=0, description="Number of output tokens generated during the agent run"
    )
    total_tokens: int = Field(
        default=0, description="Total number of tokens used during the agent run"
    )
    cost: float = Field(
        default=0.0, description="Total cost incurred during the agent run in USD"
    )
    model_used: str = Field(
        ..., description="The language model used during the agent run"
    )
    provider_used: str = Field(
        default="openrouter", description="The provider of the language model"
    )
    duration_ms: int = Field(
        default=0, description="Duration of the agent run in milliseconds"
    )
    started_at: datetime = Field(
        ..., description="Timestamp when the agent run was started"
    )
    ended_at: datetime = Field(
        ..., description="Timestamp when the agent run was ended"
    )
    created_at: datetime = Field(
        default_factory=datetime.now, description="Timestamp when the agent run was created"
    )

    class Settings:
        name = "agent_runs"
