from datetime import datetime

from fastapi import HTTPException
from models.automations.n8n.n8n_workflow_template import (
    N8NWorkflowData,
    N8NWorkflowTemplate,
)
from models.automations.n8n.n8n_credential import N8NCredential, N8NNodeCredentialData
from glob import glob
from models.user import User
from services.n8n.consts import N8N_REQUEST_HEADERS, N8N_SERVER_URL
import json
import requests


async def sync_n8n_workflow_templates_from_assets():
    folder = "assets/workflow_templates/n8n"
    try:
        for file_path in glob(f"{folder}/*.json"):
            with open(file_path, "r", encoding="utf-8") as f:
                workflow_templates = json.load(f)
                for wf in workflow_templates:
                    existing = await N8NWorkflowTemplate.find_one(
                        N8NWorkflowTemplate.ignitic_identifier
                        == wf["ignitic_identifier"]
                    )
                    if existing:
                        existing.updated_at = datetime.now()
                        await existing.set(wf)
                    else:
                        await N8NWorkflowTemplate.insert_one(N8NWorkflowTemplate(**wf))
        print("Successfully synced n8n workflows from assets")
    except Exception as e:
        print(f"Error while syncing n8n workflows from assets: {e}")


def validate_webhook_trigger(workflow_data: N8NWorkflowData):
    if (
        len(workflow_data.nodes) != 0
        and workflow_data.nodes[0].type != "n8n-nodes-base.webhook"
    ):
        raise ValueError(
            "You can only import workflows starting with a webhook trigger"
        )


async def deploy_workflow_on_n8n(
    workflow_template: N8NWorkflowTemplate, user: User
) -> str:
    try:
        for node in workflow_template.n8n_json.nodes:
            if node.credentials:
                for cred_type, cred_data in node.credentials.items():
                    cred = await N8NCredential.find_one(
                        N8NCredential.type == cred_type
                        and (
                            N8NCredential.u_id == user.id
                            or N8NCredential.org_id == user.org_id
                        )
                    )
                    if not cred:
                        raise ValueError(f"Missing credentials for {cred_type}")
                    node.credentials[cred_type] = N8NNodeCredentialData(
                        id=cred.n8n_id is not None and cred.n8n_id or "",
                        name=cred.name,
                    )
        response = requests.post(
            f"{N8N_SERVER_URL}/workflows",
            json=workflow_template.n8n_json.model_dump(),
            headers=N8N_REQUEST_HEADERS,
        )
        print(f"[N8N] Registering credential: {response.status_code} - {response.text}")
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=response.text)
        return response.json().get("id")
    except Exception as e:
        raise ValueError(f"Error while preparing workflow for deployment: {e}")


async def activate_workflow(n8n_id: str) -> bool:
    try:
        response = requests.post(
            f"{N8N_SERVER_URL}/workflows/{n8n_id}/activate",
            headers=N8N_REQUEST_HEADERS,
        )
        print(f"[N8N] Activating workflow: {response.status_code} - {response.text}")
        return True if response.status_code == 200 else False
    except Exception as e:
        raise ValueError(f"Error while activating workflow: {e}")


async def delete_deployed_workflow_from_n8n(n8n_id: str) -> bool:
    try:
        response = requests.delete(
            f"{N8N_SERVER_URL}/workflows/{n8n_id}",
            headers=N8N_REQUEST_HEADERS,
        )
        print(f"[N8N] Deleting workflow: {response.status_code} - {response.text}")
        return True if response.status_code == 200 else False
    except Exception as e:
        raise ValueError(f"Error while deleting workflow: {e}")
