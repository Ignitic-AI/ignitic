import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

logger = logging.getLogger(__name__)
from models.automations.workflow import DeployedWorkflow
from models.automations.n8n.n8n_workflow import DeployedN8NWorkflow
from models.automations.workflow_template import WorkflowTemplate
from models.automations.n8n.n8n_workflow_template import N8NWorkflowTemplate
from services.n8n.n8n_workflow_service import N8NWorkflowService
from core.auth import get_auth, AuthProvider
from models.user import User
from bson import ObjectId
from beanie.operators import Or, And

router = APIRouter(prefix="/workflow")


@router.get("/")
async def get_workflows(
    limit: Optional[int] = 100, auth: AuthProvider = Depends(get_auth)
):
    """
    Retrieve a list of deployed workflows for the authenticated user or organization.

    This endpoint returns all workflow types (N8N, Zapier, Make, etc.) with their
    specific fields preserved. Uses Beanie's inheritance feature to automatically
    return the correct subtype instances.

    Args:
        limit (Optional[int], default=100): The maximum number of workflows to return.
        user (User): The current authenticated user.

    Returns:
        List[dict]: A list of deployed workflows in JSON format with subtype-specific fields.

    Raises:
        HTTPException: If an error occurs during retrieval, returns a 400 status code with the error detail.
    """
    try:
        # Get user from auth provider
        user = auth.get_user()

        # Query using the base class - Beanie will automatically return subtype instances
        # due to the inheritance discriminator setup
        workflows = (
            await DeployedWorkflow.find(
                Or(
                    DeployedWorkflow.u_id == user.id,
                    DeployedWorkflow.org_id == user.org_id,
                ),
                with_children=True,
            )
            .limit(limit)
            .to_list()
        )

        # The workflows list will contain actual subtype instances (DeployedN8NWorkflow, etc.)
        # with all their specific fields preserved
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
        # Get user from auth provider
        user = auth.get_user()

        o_id = ObjectId(id) if ObjectId.is_valid(id) else id
        workflow = await DeployedWorkflow.find_one(
            And(
                Or(
                    DeployedWorkflow.u_id == user.id,
                    DeployedWorkflow.org_id == user.org_id,
                ),
                Or(
                    DeployedWorkflow.id == o_id,
                    DeployedWorkflow.ignitic_identifier == id,
                ),
            ),
            with_children=True,
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
async def deploy_from_template(
    workflow_template_id: str, auth: AuthProvider = Depends(get_auth)
):
    """
    Deploys a workflow from a specified template.

    This universal endpoint handles deployment for any workflow template type.
    It automatically detects the template type and uses the appropriate deployment logic.

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
        dict: Deployment result with deployed workflow information
    """
    try:
        # Get user from auth provider
        user = auth.get_user()

        # Find template by ID or ignitic_identifier (works with discriminator)
        o_id = (
            ObjectId(workflow_template_id)
            if ObjectId.is_valid(workflow_template_id)
            else None
        )
        conditions = [WorkflowTemplate.ignitic_identifier == workflow_template_id]
        if o_id:
            conditions.append(WorkflowTemplate.id == o_id)

        template = await WorkflowTemplate.find_one(
            Or(*conditions),
            with_children=True,
        )

        if not template:
            raise HTTPException(status_code=404, detail="Workflow template not found")

        # Check if workflow already deployed for this user/org
        existing = await DeployedWorkflow.find_one(
            And(
                DeployedWorkflow.template_id == str(template.id),
                Or(
                    DeployedWorkflow.u_id == user.id,
                    DeployedWorkflow.org_id == user.org_id,
                ),
            )
        )

        if existing:
            n8n_service = N8NWorkflowService(auth=auth)
            if isinstance(existing, DeployedN8NWorkflow) and not await n8n_service.workflow_exists_on_n8n(existing.n8n_id):
                logger.warning(
                    "Stale deployed workflow record found (not on n8n). "
                    "Deleting DB record and redeploying. n8n_id=%s",
                    existing.n8n_id,
                )
                await existing.delete()
            else:
                logger.warning(
                    "Workflow already deployed for this user/organization; returning existing record."
                )
                return existing

        if isinstance(template, N8NWorkflowTemplate):
            return await N8NWorkflowService(auth=auth).create_deployed_workflow(template, user)
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported workflow type: {template}",
            )

    except HTTPException:
        raise
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
        dict: Success message and workflow status
    """
    try:
        # Get user from auth provider
        user = auth.get_user()

        # Find the deployed workflow by ID or ignitic_identifier
        o_id = ObjectId(workflow_id) if ObjectId.is_valid(workflow_id) else workflow_id
        workflow = await DeployedWorkflow.find_one(
            And(
                Or(
                    DeployedWorkflow.u_id == user.id,
                    DeployedWorkflow.org_id == user.org_id,
                ),
                Or(
                    DeployedWorkflow.id == o_id,
                    DeployedWorkflow.ignitic_identifier == workflow_id,
                ),
            ),
            with_children=True,
        )

        if not workflow:
            raise HTTPException(status_code=404, detail="Deployed workflow not found")

        # Check if already active
        if workflow.active:
            return {
                "message": "Workflow is already active",
                "workflow": {
                    **workflow.model_dump(),
                    "id": str(workflow.id),
                },
            }

        if isinstance(workflow, DeployedN8NWorkflow):
            # Cast to N8N workflow to access n8n_id
            if isinstance(workflow, DeployedN8NWorkflow):
                activated = await activate_workflow(workflow.n8n_id)
                if not activated:
                    raise HTTPException(
                        status_code=500, detail="Failed to activate workflow"
                    )
            else:
                raise HTTPException(
                    status_code=400, detail="Invalid workflow type for activation"
                )
        else:
            # Future: Add other workflow type activation handlers here
            raise HTTPException(
                status_code=400,
                detail=f"Activation not supported for workflow type: {workflow}",
            )

        # Update workflow status
        workflow.active = True
        await workflow.save()

        return {
            "message": "Workflow activated successfully",
            "workflow": {
                **workflow.model_dump(),
                "id": str(workflow.id),
            },
        }

    except HTTPException:
        raise
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
        dict: Success message
    """
    try:
        # Get user from auth provider
        user = auth.get_user()

        # Find the deployed workflow by ID or ignitic_identifier
        o_id = ObjectId(workflow_id) if ObjectId.is_valid(workflow_id) else workflow_id
        workflow = await DeployedWorkflow.find_one(
            And(
                Or(
                    DeployedWorkflow.u_id == user.id,
                    DeployedWorkflow.org_id == user.org_id,
                ),
                Or(
                    DeployedWorkflow.id == o_id,
                    DeployedWorkflow.ignitic_identifier == workflow_id,
                ),
            ),
            with_children=True,
        )

        if not workflow:
            raise HTTPException(status_code=404, detail="Deployed workflow not found")

        if isinstance(workflow, DeployedN8NWorkflow):
            # Cast to N8N workflow to access n8n_id
            if isinstance(workflow, DeployedN8NWorkflow):
                # Delete from N8N instance
                deleted = await delete_deployed_workflow_from_n8n(workflow.n8n_id)
                if not deleted:
                    raise HTTPException(
                        status_code=500,
                        detail="Failed to delete workflow from N8N instance",
                    )
            else:
                raise HTTPException(
                    status_code=400, detail="Invalid workflow type for deletion"
                )
        else:
            # Future: Add other workflow type deletion handlers here
            raise HTTPException(
                status_code=400,
                detail=f"Deletion not supported for workflow type: {workflow}",
            )

        # Delete from database
        await workflow.delete()

        return {"message": "Workflow deleted successfully."}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
