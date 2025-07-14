
from datetime import datetime
from models.n8n_workflow import N8NWorkflowData, N8NWorkflowTemplate
from glob import glob
import json


async def sync_n8n_workflow_templates_from_assets():
    folder = "assets/workflow_templates/n8n"
    try:
        for file_path in glob(f"{folder}/*.json"):
            with open(file_path, 'r', encoding='utf-8') as f:
                workflow_templates = json.load(f)
                for wf in workflow_templates:
                    existing = await N8NWorkflowTemplate.find_one(N8NWorkflowTemplate.ignitic_identifier == wf['ignitic_identifier'])
                    if existing:
                        existing.updated_at = datetime.now()
                        await existing.set(wf)
                    else:
                        await N8NWorkflowTemplate.insert_one(N8NWorkflowTemplate(**wf))
        print("Successfully synced n8n workflows from assets")
    except Exception as e:
        print(f"Error while syncing n8n workflows from assets: {e}")

def validate_webhook_trigger(workflow_data: N8NWorkflowData):
    if len(workflow_data.nodes) != 0 and workflow_data.nodes[0].type != "n8n-nodes-base.webhook":
            raise ValueError("You can only import workflows starting with a webhook trigger")