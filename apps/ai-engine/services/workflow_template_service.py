from services.n8n.n8n_workflow_service import sync_n8n_workflow_templates_from_assets

async def sync_workflows_from_assets():
    await sync_n8n_workflow_templates_from_assets()