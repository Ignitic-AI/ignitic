from datetime import datetime
from typing import Optional
import uuid
from utils.url import get_base_url
from fastapi import HTTPException
from pydantic import HttpUrl, parse_obj_as
from models.automations.n8n.n8n_workflow_template import (
    N8NWorkflowData,
    N8NWorkflowTemplate,
)
from models.automations.n8n.n8n_credential import N8NCredential, N8NNodeCredentialData
from models.automations.n8n.n8n_workflow import DeployedN8NWorkflow
from glob import glob
from models.user import User
from services.n8n.consts import N8N_REQUEST_HEADERS, N8N_SERVER_URL
from core.auth import AuthProvider
from services.credential_service import CredentialService
from services.n8n.n8n_credential_service import N8NCredentialService
from core.n8n_client import N8NClient
import json
import requests


class N8NWorkflowService:
    def __init__(self, auth: AuthProvider) -> None:
        self._auth = auth
        self._n8n_client = N8NClient()

    @staticmethod
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
                            await N8NWorkflowTemplate.insert_one(
                                N8NWorkflowTemplate(**wf)
                            )
            print("Successfully synced n8n workflows from assets")
        except Exception as e:
            print(f"Error while syncing n8n workflows from assets: {e}")

    @staticmethod
    def validate_webhook_trigger(workflow_data: N8NWorkflowData):
        if (
            len(workflow_data.nodes) != 0
            and workflow_data.nodes[0].type != "n8n-nodes-base.webhook"
        ):
            raise ValueError(
                "You can only import workflows starting with a webhook trigger"
            )

    async def create_deployed_workflow(
        self, template: N8NWorkflowTemplate
    ) -> DeployedN8NWorkflow:
        user = self._auth.get_user()
        existing = await DeployedN8NWorkflow.find_one(
            DeployedN8NWorkflow.template_id == template.id
            and DeployedN8NWorkflow.u_id == user.id
            and DeployedN8NWorkflow.org_id == user.org_id
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Workflow already deployed for this template and user/organization.",
            )

        webhook_id = str(uuid.uuid4())
        template.n8n_json.nodes[0].webhookId = webhook_id
        template.n8n_json.nodes[0].parameters["path"] = webhook_id

        n8n_id = await self._deploy_workflow_on_n8n(template)
        print(f"[N8N] Deployed workflow with ID: {n8n_id}")

        if not N8N_SERVER_URL:
            raise HTTPException(
                status_code=500, detail="N8N server URL is not configured"
            )

        deployed_worflow = DeployedN8NWorkflow(
            n8n_id=n8n_id,
            template_id=str(template.id),
            ignitic_identifier=template.ignitic_identifier,
            webhook_url=parse_obj_as(
                HttpUrl, f"{get_base_url(N8N_SERVER_URL)}/webhook/{webhook_id}"
            ),
            u_id=user.id,
            org_id=user.org_id,
            active=False,
        )
        insert_res = await deployed_worflow.insert()
        if not insert_res:
            await self.delete_deployed_workflow_from_n8n(n8n_id)
            raise HTTPException(
                status_code=500,
                detail="Workflow deployed but failed to insert deployed workflow into database",
            )

        activated = await self.activate_workflow(n8n_id)
        if not activated:
            raise HTTPException(
                status_code=500,
                detail="Workflow created but failed to activate. Try activating using /workflow/n8n/activate/{n8n_id} endpoint",
            )
        deployed_worflow.active = True
        await deployed_worflow.save()
        return deployed_worflow

    @staticmethod
    async def get_node_credential_types(node_type: str) -> list[str]:
        """
        Reads the nodes_data.json file and returns a list of all unique credential type names used by nodes.
        """
        import os
        import json

        file_path = os.path.join(
            "assets", "workflow_templates", "n8n", "nodes_data.json"
        )
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                nodes_data = json.load(f)
        except Exception as e:
            raise RuntimeError(f"Failed to read nodes_data.json: {e}")

        node_info = nodes_data.get(node_type)
        if not node_info:
            return []
        credentials = node_info.get("credentials", [])
        if not isinstance(credentials, list):
            return []
        return [cred.get("name") for cred in credentials if cred.get("name")]

    async def get_node_credential(self, node_type: str) -> Optional[N8NCredential]:
        user = self._auth.get_user()

        cred_types = await self.get_node_credential_types(node_type)

        for i, cred_type in enumerate(cred_types):
            try:
                existing_cred = await N8NCredential.find_one(
                    N8NCredential.type == cred_type
                    and (
                        N8NCredential.u_id == user.id
                        or N8NCredential.org_id == user.org_id
                    )
                )
                backend_cred = await CredentialService(self._auth).get_credential(
                    cred_type
                )

                if existing_cred and existing_cred.updated_at >= backend_cred.updatedAt:
                    return existing_cred

                return await N8NCredentialService(
                    self._auth
                ).register_credential_on_n8n(backend_cred)
            except Exception as e:
                if i == len(cred_types) - 1:
                    raise ValueError(
                        f"Error while preparing workflow for deployment. No credential out of types {cred_types} could be registered: {e}"
                    )

    async def _deploy_workflow_on_n8n(
        self,
        workflow_template: N8NWorkflowTemplate,
    ) -> str:
        try:
            user = self._auth.get_user()
            for node in workflow_template.n8n_json.nodes:
                cred = await self.get_node_credential(node.type)
                if cred:
                    if cred.n8n_id is None:
                        raise ValueError(
                            f"Credential {cred.name} of type {cred.type} is not registered on N8N"
                        )
                    node.credentials = {}
                    node.credentials[cred.type] = N8NNodeCredentialData(
                        id=cred.n8n_id,
                        name=cred.name,
                    )
            response = await self._n8n_client.post(
                "workflows",
                json=workflow_template.n8n_json.model_dump(),
            )

            return response.get("id")
        except Exception as e:
            raise ValueError(f"Error while preparing workflow for deployment: {e}")

    async def activate_workflow(self, n8n_id: str) -> bool:
        try:
            response = await self._n8n_client.post(
                f"workflows/{n8n_id}/activate",
            )

            return True if response.get("id") else False
        except Exception as e:
            raise ValueError(f"Error while activating workflow: {e}")

    async def delete_deployed_workflow(self, deployed_workflow: DeployedN8NWorkflow) -> bool:
        try:
            n8n_id = deployed_workflow.n8n_id
            deleted = await self.delete_deployed_workflow_from_n8n(n8n_id)
            if not deleted:
                raise ValueError(
                    f"Failed to delete workflow from N8N with id {n8n_id}"
                )

            await deployed_workflow.delete()
            return True
        except Exception as e:
            raise ValueError(f"Error while deleting deployed workflow: {e}")

    async def delete_deployed_workflow_from_n8n(self, n8n_id: str) -> bool:
        try:
            response = await self._n8n_client.delete(
                f"workflows/{n8n_id}",
            )

            return True if response.get("id") else False
        except Exception as e:
            raise ValueError(f"Error while deleting workflow: {e}")

    async def update_workflow_credential(
        self, workflow_id: str, credential_id: str, user: User
    ) -> bool:
        """
        Update a workflow's credential using the N8N API.

        Args:
            workflow_id (str): The N8N workflow ID
            credential_id (str): The credential ID to update in the workflow
            user (User): The user making the request (for credential access validation)

        Returns:
            bool: True if successful, False otherwise

        Raises:
            ValueError: If the workflow or credential is not found, or if update fails
            HTTPException: If N8N API returns an error
        """
        try:
            # First, get the current workflow from N8N
            get_response = requests.get(
                f"{N8N_SERVER_URL}/workflows/{workflow_id}",
                headers=N8N_REQUEST_HEADERS,
            )

            if get_response.status_code != 200:
                print(
                    f"[N8N] Failed to get workflow {workflow_id}: {get_response.status_code} - {get_response.text}"
                )
                raise ValueError(f"Failed to retrieve workflow {workflow_id} from N8N")

            workflow_data = get_response.json()
            print(f"[N8N] Retrieved workflow {workflow_id} successfully")

            # Find the credential in our database to get its details
            credential = await N8NCredential.find_one(
                N8NCredential.n8n_id == credential_id
                and (
                    N8NCredential.u_id == user.id or N8NCredential.org_id == user.org_id
                )
            )

            if not credential:
                raise ValueError(
                    f"Credential {credential_id} not found or access denied"
                )

            # Update the workflow's nodes that use credentials
            updated = False
            for node in workflow_data.get("nodes", []):
                if node.get("credentials"):
                    # Update credentials for nodes that have them
                    for cred_type in node["credentials"]:
                        if credential.type == cred_type:
                            node["credentials"][cred_type] = {
                                "id": credential.n8n_id,
                                "name": credential.name,
                            }
                            updated = True
                            print(
                                f"[N8N] Updated credential for node {node.get('name', 'Unknown')} with type {cred_type}"
                            )

            if not updated:
                print(
                    f"[N8N] No matching credential type found in workflow {workflow_id}"
                )
                return False

            # Update the workflow in N8N
            update_response = requests.put(
                f"{N8N_SERVER_URL}/workflows/{workflow_id}",
                json=workflow_data,
                headers=N8N_REQUEST_HEADERS,
            )

            print(
                f"[N8N] Updating workflow credential: {update_response.status_code} - {update_response.text}"
            )

            if update_response.status_code != 200:
                raise HTTPException(
                    status_code=update_response.status_code,
                    detail=f"Failed to update workflow credential: {update_response.text}",
                )

            print(f"[N8N] Successfully updated credential for workflow {workflow_id}")
            return True

        except HTTPException:
            raise
        except Exception as e:
            print(f"[N8N] Error updating workflow credential: {str(e)}")
            raise ValueError(f"Error while updating workflow credential: {e}")
