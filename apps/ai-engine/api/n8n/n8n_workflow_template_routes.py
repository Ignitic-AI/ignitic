from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from models.automations.n8n.n8n_workflow import N8NWorkflowData
from models.automations.n8n.n8n_workflow_template import N8NWorkflowTemplate
from services.n8n.n8n_workflow_service import validate_webhook_trigger
from core.auth import get_auth, AuthProvider
from bson import ObjectId
from beanie.operators import Or, And

router = APIRouter(prefix="/workflow-template/n8n")


@router.post("/import")
async def import_from_json(
    workflow_data: N8NWorkflowData, auth: AuthProvider = Depends(get_auth)
):
    try:
        user = auth.get_user()
        validate_webhook_trigger(workflow_data)
        print(workflow_data.model_dump())
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/")
async def get_workflow_templates(
    limit: Optional[int] = 10,
    n8n_json: Optional[bool] = True,
    auth: AuthProvider = Depends(get_auth),
):
    """
    Retrieve a list of workflow templates.

    Args:
        limit (Optional[int], default=10): The maximum number of workflow templates to return.
            n8n_json (Optional[bool], default=True): Whether to include the n8n_json field in the response.
        user (User): The current authenticated user.

    Returns:
        List[dict]: A list of workflow templates in JSON format.

    Raises:
        HTTPException: If an error occurs during retrieval, returns a 400 status code with the error detail.
    """
    try:
        # Get user from auth provider
        user = auth.get_user()

        # Build query conditions based on user role
        if user.role == "admin":
            templates = await N8NWorkflowTemplate.find_all().limit(limit).to_list()
        else:
            # Create individual query conditions
            user_condition = N8NWorkflowTemplate.u_id == user.id
            org_condition = N8NWorkflowTemplate.org_id == user.org_id
            public_condition = And(
                N8NWorkflowTemplate.u_id == None,
                N8NWorkflowTemplate.org_id == None,  # noqa: E711
            )

            # Combine with Or operator
            query = Or(user_condition, org_condition, public_condition)
            templates = await N8NWorkflowTemplate.find(query).limit(limit).to_list()
        if n8n_json:
            return [template.to_json() for template in templates]
        else:
            return [
                {
                    **template.model_dump(exclude={"n8n_json"}),
                    "id": str(template.id),
                }
                for template in templates
            ]
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{id}")
async def get_workflow_template(id: str, auth: AuthProvider = Depends(get_auth)):
    """
    Retrieve a specific N8N workflow template by its ID.

    Args:
        id (str): The unique identifier of the N8N workflow template. Can be a valid ObjectId or a string.
        user (User): The current authenticated user.

    Returns:
        dict: The JSON representation of the workflow template if found.

    Raises:
        HTTPException:
            - 404 if the workflow template with the given ID is not found.
            - 400 for any other exceptions encountered during retrieval.
    """
    try:
        o_id = ObjectId(id) if ObjectId.is_valid(id) else id
        template = await N8NWorkflowTemplate.find_one(N8NWorkflowTemplate.id == o_id)
        if template:
            return template.to_json()
        else:
            raise HTTPException(
                status_code=404,
                detail=f"N8N workflow template with id = {id} not found",
            )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/")
async def create_workflow_template(
    workflow_template: N8NWorkflowTemplate, auth: AuthProvider = Depends(get_auth)
):
    """
    Create a new N8N workflow template.

    Args:
        workflow_template (N8NWorkflowTemplate): The workflow template data to be created.
        user (User): The current authenticated user.

    Raises:
        HTTPException: If validation or insertion fails.

    Returns:
        None
    """
    try:
        existing = await N8NWorkflowTemplate.find_one(
            N8NWorkflowTemplate.ignitic_identifier
            == workflow_template.ignitic_identifier
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"This workflow template with ignitic_identifier = {workflow_template.ignitic_identifier} already exists",
            )
        validate_webhook_trigger(workflow_template.n8n_json)
        await workflow_template.insert()
        return {
            "inserted_id": str(workflow_template.id),
            "n8n_workflow_template": workflow_template.model_dump(),
        }
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{id}")
async def delete_workflow_template(id: str, auth: AuthProvider = Depends(get_auth)):
    """
    Retrieve a specific N8N workflow template by its ID.

    Args:
        id (str): The unique identifier of the N8N workflow template. Can be a valid ObjectId or a string.
        user (User): The current authenticated user.

    Returns:
        dict: The JSON representation of the workflow template if found.

    Raises:
        HTTPException:
            - 404 if the workflow template with the given ID is not found.
            - 400 for any other exceptions encountered during retrieval.
    """
    try:
        o_id = ObjectId(id) if ObjectId.is_valid(id) else id
        template = await N8NWorkflowTemplate.find_one(N8NWorkflowTemplate.id == o_id)
        if template:
            result = await template.delete()
            if result:
                return {
                    "detail": f"N8N workflow template with id = {id} deleted successfully"
                }
            else:
                raise HTTPException(
                    status_code=500,
                    detail=f"Failed to delete N8N workflow template with id = {id}",
                )
        else:
            raise HTTPException(
                status_code=404,
                detail=f"N8N workflow template with id = {id} not found",
            )
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
