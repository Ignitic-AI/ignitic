from beanie import PydanticObjectId
from models.automations.n8n.n8n_workflow import N8NWorkflowData
from models.automations.workflow_template import WorkflowTemplate
from pydantic import Field, validator
from typing import Optional


class N8NWorkflowTemplate(WorkflowTemplate):
    """
    N8N workflow template document.
    
    Extends the base WorkflowTemplate with N8N-specific workflow data.
    
    Attributes:
        n8n_json: N8N workflow configuration data
    """
    n8n_json: N8NWorkflowData = Field(..., description="N8N workflow configuration data")
    
    def to_json(self) -> dict:
        """
        Convert document to JSON representation.
        
        Returns:
            dict: JSON representation of the document
        """
        return {
            **self.model_dump(),
            "id": str(self.id) if self.id else None
        }
    
    @validator('n8n_json')
    def validate_n8n_json(cls, v):
        """Validate N8N workflow data."""
        if not v:
            raise ValueError('n8n_json cannot be empty')
        return v
