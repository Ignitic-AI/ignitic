from typing import Optional
from services.n8n.n8n_workflow_service import sync_n8n_workflow_templates_from_assets
from core.auth import get_auth, AuthProvider
from models.automations.workflow_template import WorkflowTemplate
from bson import ObjectId


class WorkflowTemplateService:
    def __init__(self, auth: AuthProvider) -> None:
        self._auth = auth

    @staticmethod
    async def sync_workflows_from_assets():
        await sync_n8n_workflow_templates_from_assets()

    async def get_workflow_template(
        self, id: Optional[str], ignitic_identifier: Optional[str]
    ) -> WorkflowTemplate:
        """
        Retrieve a specific workflow template by its ID or ignitic_identifier.

        Args:
            id (Optional[str]): The ID of the workflow template.
            ignitic_identifier (Optional[str]): The ignitic_identifier of the workflow template.
        Returns:
            dict: The JSON representation of the workflow template if found.
        Raises:
            ValueError: If neither id nor ignitic_identifier is provided.
            LookupError: If the workflow template is not found.
        """
        if not id and not ignitic_identifier:
            raise ValueError("Either 'id' or 'ignitic_identifier' must be provided")

        if id and ObjectId.is_valid(id):
            o_id = ObjectId(id)
        else:
            o_id = id

        if id:
            template = await WorkflowTemplate.find_one(
                WorkflowTemplate.id == o_id, with_children=True
            )
        else:
            template = await WorkflowTemplate.find_one(
                WorkflowTemplate.ignitic_identifier == ignitic_identifier,
                with_children=True,
            )

        if template:
            return template
        else:
            raise LookupError(
                f"N8N workflow template with id = {id} or ignitic_identifier = {ignitic_identifier} not found"
            )
