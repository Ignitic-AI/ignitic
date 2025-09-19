from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from models.automations.n8n.n8n_workflow import DeployedN8NWorkflow
from models.automations.n8n.n8n_workflow_template import N8NWorkflowTemplate
from services.n8n.n8n_workflow_service import (
    create_deployed_workflow,
    activate_workflow,
    delete_deployed_workflow_from_n8n,
)
from core.auth import get_auth, AuthProvider
from bson import ObjectId
from beanie.operators import Or, And

router = APIRouter(prefix="/workflow/n8n")


@router.get("/")
async def get_workflows(
    limit: Optional[int] = 100, auth: AuthProvider = Depends(get_auth)
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
        user = await auth.get_user()
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
async def get_workflow(id: str, auth: AuthProvider = Depends(get_auth)):
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
        user = await auth.get_user()
        o_id = ObjectId(id) if ObjectId.is_valid(id) else id
        workflow = await DeployedN8NWorkflow.find_one(
            And(
                Or(
                    DeployedN8NWorkflow.u_id == user.id,
                    DeployedN8NWorkflow.org_id == user.org_id,
                ),
                Or(
                    DeployedN8NWorkflow.id == o_id,
                    DeployedN8NWorkflow.ignitic_identifier == id,
                ),
            )
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
    workflow_template_id: str, auth: AuthProvider = Depends(get_auth)
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
        user = await auth.get_user()
        template = await N8NWorkflowTemplate.find_one(
            (
                N8NWorkflowTemplate.id == ObjectId(workflow_template_id)
                if ObjectId.is_valid(workflow_template_id)
                else False
            )
            or N8NWorkflowTemplate.ignitic_identifier == workflow_template_id
        )

        if template:
            deployed_workflow = await create_deployed_workflow(template, user)

            return {
                "message": "Workflow deployed successfully.",
                "deployed_workflow": {
                    **deployed_workflow.model_dump(),
                    "id": str(deployed_workflow.id),
                },
            }
        else:
            raise HTTPException(status_code=404, detail="Workflow template not found")
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/activate/{workflow_id}")
async def activate_workflow_endpoint(
    workflow_id: str, auth: AuthProvider = Depends(get_auth)
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
async def delete_workflow(workflow_id: str, auth: AuthProvider = Depends(get_auth)):
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
