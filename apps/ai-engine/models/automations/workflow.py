from beanie import Document
from pydantic import Field, HttpUrl
from typing import Optional
from datetime import datetime


class DeployedWorkflow(Document):
    """
    Deployed workflow document.

    Represents a workflow that has been deployed to an automation instance.

    Attributes:
        ignitic_identifier: Ignitic workflow identifier
        webhook_url: Webhook URL for the workflow
        active: Whether the workflow is active
        template_id: Associated template identifier
        u_id: User identifier
        org_id: Organization identifier
        createdAt: Creation timestamp
        updatedAt: Last update timestamp
    """

    ignitic_identifier: Optional[str] = Field(
        default=None, description="Ignitic workflow identifier"
    )
    webhook_url: Optional[str] = Field(
        default=None, description="Webhook URL for the workflow"
    )
    active: bool = Field(default=False, description="Whether the workflow is active")
    template_id: Optional[str] = Field(
        default=None, description="Associated template identifier"
    )
    u_id: Optional[str] = Field(default=None, description="User identifier")
    org_id: Optional[str] = Field(default=None, description="Organization identifier")
    createdAt: datetime = Field(
        default_factory=datetime.now, description="Creation timestamp"
    )
    updatedAt: datetime = Field(
        default_factory=datetime.now, description="Last update timestamp"
    )

    class Settings:
        """Beanie document settings."""

        name = "deployed_workflows"
        use_state_management = True
        is_root = True
