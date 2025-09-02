from typing import Optional, Dict, Any
from pydantic import BaseModel, Field, validator
from datetime import datetime


class WorkflowInput(BaseModel):
    """
    Input parameter definition for a workflow.

    Attributes:
        type: Data type of the input
        description: Human-readable description
        default: Default value (optional)
        required: Whether the input is required
    """

    type: str = Field(..., description="Data type of the input")
    description: Optional[str] = Field(None, description="Human-readable description")
    default: Optional[Any] = Field(None, description="Default value")
    required: bool = Field(default=True, description="Whether the input is required")


class WorkflowOutput(BaseModel):
    """
    Output parameter definition for a workflow.

    Attributes:
        type: Data type of the output
        description: Human-readable description
    """

    type: str = Field(..., description="Data type of the output")
    description: Optional[str] = Field(None, description="Human-readable description")


class WorkflowTemplate(BaseModel):
    """
    Base workflow template document.

    Attributes:
        ignitic_identifier: Unique identifier for the template
        name: Human-readable name
        description: Detailed description
        inputs: Input parameter definitions
        outputs: Output parameter definitions
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    id: Optional[str] = Field(default=None, description="Document ID")
    ignitic_identifier: str = Field(
        ..., description="Unique identifier for the template"
    )
    name: str = Field(..., description="Human-readable name")
    description: str = Field(..., description="Detailed description")
    inputs: Optional[Dict[str, WorkflowInput]] = Field(
        default=None, description="Input parameter definitions"
    )
    outputs: Optional[Dict[str, WorkflowOutput]] = Field(
        default=None, description="Output parameter definitions"
    )
    u_id: Optional[str] = Field(
        default=None, description="User identifier, if custom template"
    )
    org_id: Optional[str] = Field(
        default=None, description="Organization identifier, if custom template"
    )
    created_at: datetime = Field(
        default_factory=datetime.now, description="Creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.now, description="Last update timestamp"
    )

    def to_json(self) -> dict:
        """
        Convert document to JSON representation.

        Returns:
            dict: JSON representation of the document
        """
        return {**self.model_dump(), "id": str(self.id) if self.id else None}

    @validator("ignitic_identifier")
    def validate_identifier(cls, v):
        """Validate ignitic identifier format."""
        if not v or len(v.strip()) == 0:
            raise ValueError("ignitic_identifier cannot be empty")
        return v.strip()

    @validator("name")
    def validate_name(cls, v):
        """Validate name format."""
        if not v or len(v.strip()) == 0:
            raise ValueError("name cannot be empty")
        return v.strip()
