from typing import List, Literal, Optional, Union
from pydantic import BaseModel
from datetime import datetime
from beanie import Document

class WorkflowInput(BaseModel):
    type: str
    description: Optional[str] = None
    default: Optional[str] = None
    required: Optional[bool] = True

class WorkflowOutput(BaseModel):
    type: str
    description: Optional[str] = None

class Workflow(Document):
    n8n_id: Optional[str] = None
    name: str
    description: str
    inputs: Optional[List[WorkflowInput]] = None
    outputs: Optional[List[WorkflowOutput]] = None
    status: Literal['deployed', 'undeployed'] = 'undeployed'
    created_at: datetime
    updated_at: datetime
