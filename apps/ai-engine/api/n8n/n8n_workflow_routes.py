from typing import Optional
from unittest import result
from fastapi import APIRouter, Depends, HTTPException
from pydantic import HttpUrl, parse_obj_as
from models.automations.n8n.n8n_workflow import DeployedN8NWorkflow
from models.automations.n8n.n8n_workflow_template import N8NWorkflowTemplate
from services.n8n.n8n_workflow_service import (
    deploy_workflow_on_n8n,
    activate_workflow,
    N8N_SERVER_URL,
    delete_deployed_workflow_from_n8n,
)
from core.auth import get_user_auth
from models.user import User
from bson import ObjectId
import uuid

router = APIRouter(prefix="/workflow/n8n")


@router.get("/")
async def get_workflows(
    limit: Optional[int] = 100, user: User = Depends(get_user_auth)
):
    """
    Retrieve a list of deployed workflows for the authenticated user or organization.

    Args:
        limit (Optional[int], default=100): The maximum number of workflows to return.
        user (User): The current authenticated user.

    Returns:
        List[dict]: A list of deployed workflows in JSON format.

    Raises:
        HTTPException: If an error occurs during retrieval, returns a 400 status code with the error detail.
    """
    try:
        workflows = (
            await DeployedN8NWorkflow.find(
                (DeployedN8NWorkflow.u_id == user.id)
                or (DeployedN8NWorkflow.org_id == user.org_id)
            )
            .limit(limit)
            .to_list()
        )
        return [
            {
                **workflow.model_dump(),
                "id": str(workflow.id),
            }
            for workflow in workflows
        ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{id}")
async def get_workflow(id: str, user: User = Depends(get_user_auth)):
    """
    Retrieve a specific deployed workflow by its ID or ignitic_identifier.

    Args:
        id (str): The ID or ignitic_identifier of the deployed workflow to retrieve.
        user (User): The current authenticated user.

    Returns:
        dict: The JSON representation of the deployed workflow if found.

    Raises:
        HTTPException:
            - 404 if the workflow with the given ID is not found.
            - 400 for any other exceptions encountered during retrieval.
    """
    try:
        o_id = ObjectId(id) if ObjectId.is_valid(id) else id
        workflow = await DeployedN8NWorkflow.find_one(
            DeployedN8NWorkflow.id == o_id
            or DeployedN8NWorkflow.ignitic_identifier == id
        )
        if workflow:
            return {
                **workflow.model_dump(),
                "id": str(workflow.id),
            }
        else:
            raise HTTPException(status_code=404, detail="Deployed workflow not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/deploy/template-{workflow_template_id}")
async def deploy_from_teemplate(
    workflow_template_id: str, user: User = Depends(get_user_auth)
):
    """
    Deploys a workflow from a specified template.
    This endpoint creates a new workflow instance based on the provided workflow template ID.
    It generates a unique webhook ID, updates the template's webhook node, deploys the workflow to n8n,
    and stores the deployed workflow information in the database. If deployment or database insertion fails,
    appropriate errors are raised. The workflow is also activated upon successful deployment.
    Args:
        workflow_template_id (str): The ID or ignitic identifier of the workflow template to deploy.
        user (User): The current authenticated user (injected via dependency).
    Raises:
        HTTPException:
            - 404 if the workflow template is not found.
            - 500 if deployment succeeds but database insertion fails.
            - 500 if workflow activation fails.
            - 400 for any other exceptions.
    Returns:
        None
    """
    try:
        template = await N8NWorkflowTemplate.find_one(
            (
                N8NWorkflowTemplate.id == ObjectId(workflow_template_id)
                if ObjectId.is_valid(workflow_template_id)
                else False
            )
            or N8NWorkflowTemplate.ignitic_identifier == workflow_template_id
        )

        if template:
            existing = await DeployedN8NWorkflow.find_one(
                DeployedN8NWorkflow.template_id == template.id
                and (
                    DeployedN8NWorkflow.u_id == user.id
                    or DeployedN8NWorkflow.org_id == user.org_id
                )
            )
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail="Workflow already deployed for this template and user/organization.",
                )

            webhook_id = str(uuid.uuid4())
            template.n8n_json.nodes[0].webhookId = webhook_id
            template.n8n_json.nodes[0].parameters["path"] = webhook_id

            n8n_id = await deploy_workflow_on_n8n(template, user)
            print(f"[N8N] Deployed workflow with ID: {n8n_id}")

            deployed_worflow = DeployedN8NWorkflow(
                n8n_id=n8n_id,
                template_id=str(template.id),
                ignitic_identifier=template.ignitic_identifier,
                webhook_url=parse_obj_as(
                    HttpUrl, f"{N8N_SERVER_URL}/webhook/{webhook_id}"
                ),
                u_id=user.id,
                org_id=user.org_id,
                active=False,
            )
            insert_res = await deployed_worflow.insert()
            if not insert_res:
                await delete_deployed_workflow_from_n8n(n8n_id)
                raise HTTPException(
                    status_code=500,
                    detail="Workflow deployed but failed to insert deployed workflow into database",
                )

            activated = await activate_workflow(n8n_id)
            if not activated:
                raise HTTPException(
                    status_code=500,
                    detail="Workflow created but failed to activate. Try activating using /workflow/n8n/activate/{n8n_id} endpoint",
                )
            deployed_worflow.active = True
            await deployed_worflow.save()

            return {
                "message": "Workflow deployed successfully.",
                "deployed_workflow": {
                    **deployed_worflow.model_dump(),
                    "id": str(deployed_worflow.id),
                },
            }
        else:
            raise HTTPException(status_code=404, detail="Workflow template not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/activate/{workflow_id}")
async def activate_workflow_endpoint(
    workflow_id: str, user: User = Depends(get_user_auth)
):
    """
    Activates a deployed workflow by its ID or ignitic_identifier.
    This endpoint activates a workflow that has been previously deployed.
    Args:
        workflow_id (str): The ID or ignitic_identifier of the deployed workflow to activate.
        user (User): The current authenticated user (injected via dependency).
    Raises:
        HTTPException:
            - 404 if the workflow is not found.
            - 500 if activation fails.
            - 400 for any other exceptions.
    Returns:
        None
    """
    try:
        deployed_workflow = await DeployedN8NWorkflow.find_one(
            DeployedN8NWorkflow.id == ObjectId(workflow_id)
            or DeployedN8NWorkflow.ignitic_identifier == workflow_id
        )
        if not deployed_workflow:
            raise HTTPException(status_code=404, detail="Deployed workflow not found")

        activated = await activate_workflow(deployed_workflow.n8n_id)
        if not activated:
            raise HTTPException(status_code=500, detail="Failed to activate workflow")

        deployed_workflow.active = True
        await deployed_workflow.save()

        return {
            "message": "Workflow activated successfully.",
            "deployed_workflow": {
                **deployed_workflow.model_dump(),
                "id": str(deployed_workflow.id),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str, user: User = Depends(get_user_auth)):
    """
    Deletes a deployed workflow by its ID or ignitic_identifier.
    This endpoint deletes a workflow that has been previously deployed.
    Args:
        workflow_id (str): The ID or ignitic_identifier of the deployed workflow to delete.
        user (User): The current authenticated user (injected via dependency).
    Raises:
        HTTPException:
            - 404 if the workflow is not found.
            - 500 if deletion fails.
            - 400 for any other exceptions.
    Returns:
        None
    """
    try:
        deployed_workflow = await DeployedN8NWorkflow.find_one(
            DeployedN8NWorkflow.id == ObjectId(workflow_id)
            or DeployedN8NWorkflow.ignitic_identifier == workflow_id
        )
        if not deployed_workflow:
            raise HTTPException(status_code=404, detail="Deployed workflow not found")

        deleted = await delete_deployed_workflow_from_n8n(deployed_workflow.n8n_id)
        if not deleted:
            raise HTTPException(status_code=500, detail="Failed to delete workflow")
        result = await deployed_workflow.delete()
        if not result:
            raise HTTPException(
                status_code=500, detail="Failed to delete workflow from database"
            )
        return {"message": "Workflow deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
