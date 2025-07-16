from beanie import PydanticObjectId
from models.automations.n8n.n8n_workflow import N8NWorkflowData
from models.automations.workflow_template import WorkflowTemplate


class N8NWorkflowTemplate(WorkflowTemplate):
    n8n_json: N8NWorkflowData

    class Settings:
        name = "n8n_workflow_templates"
    
    def to_json(self):
        return {
                **self.model_dump(),
                "id": str(self.id) if self.id else None
            }

class N8NCustomWorkflowTemplate(WorkflowTemplate):
    n8n_json: N8NWorkflowData
    org_id: PydanticObjectId

    class Settings:
        name = 'n8n_custom_workflow_templates'