from beanie import PydanticObjectId
from core.auth import AuthProvider
from models.automations.workflow import DeployedWorkflow
from models.automations.n8n.n8n_workflow import DeployedN8NWorkflow
from models.automations.workflow_template import WorkflowTemplate
from services.n8n.n8n_workflow_service import N8NWorkflowService
from models.automations.n8n.n8n_workflow_template import N8NWorkflowTemplate


class WorkflowService:
    def __init__(self, auth: AuthProvider):
        self._auth = auth

    async def create_deployed_workflow(
        self, template: WorkflowTemplate
    ) -> DeployedWorkflow:
        if isinstance(template, N8NWorkflowTemplate):
            n8n_service = N8NWorkflowService(self._auth)
            return await n8n_service.create_deployed_workflow(template)
        else:
            raise NotImplementedError("Unsupported workflow template type")

    async def delete_deployed_workflow(self, id: str) -> bool:
        deployed_workflow = await DeployedWorkflow.find_one(
            DeployedWorkflow.id == PydanticObjectId(id), with_children=True
        )
        if isinstance(deployed_workflow, DeployedN8NWorkflow):
            n8n_service = N8NWorkflowService(self._auth)
            return await n8n_service.delete_deployed_workflow(deployed_workflow)
        else:
            raise NotImplementedError("Unsupported deployed workflow type")
