from fastapi import APIRouter, HTTPException
from models.n8n_workflow import N8NWorkflowTemplate, N8NWorkflowData

router = APIRouter(prefix="/workflow/n8n")

@router.post("/import")
async def import_from_json(workflow_data: N8NWorkflowData):
    try:
        if len(workflow_data.nodes) != 0 and workflow_data.nodes[0].type != "n8n-nodes-base.webhook":
            raise ValueError("You can only import workflows starting with a webhook trigger")
        print(workflow_data.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))