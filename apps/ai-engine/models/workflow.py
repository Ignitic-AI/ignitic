from typing import List, Literal, Optional, Union, Dict
from pydantic import BaseModel, Field
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

class WorkflowTemplate(Document):
    ignitic_identifier: str
    name: str
    description: str
    inputs: Optional[Dict[str, WorkflowInput]] = None
    outputs: Optional[Dict[str, WorkflowOutput]] = None
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
