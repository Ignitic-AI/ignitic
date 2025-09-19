from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from models.automations.workflow_template import WorkflowTemplate
from core.auth import get_auth, AuthProvider
from models.user import User
from beanie.operators import Or, And

router = APIRouter(prefix="/workflow-template")


@router.get("/")
async def get_workflow_templates(
    limit: Optional[int] = 10,
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
        templates: List[WorkflowTemplate] = []

        if user.role == "admin":
            templates = await WorkflowTemplate.find_all(with_children=True).limit(limit).to_list()
        else:
            # Create individual query conditions
            user_condition = WorkflowTemplate.u_id == user.id
            org_condition = WorkflowTemplate.org_id == user.org_id
            public_condition = And(
                WorkflowTemplate.u_id == None, WorkflowTemplate.org_id == None  # noqa: E711
            )

            # Combine with Or operator
            query = Or(user_condition, org_condition, public_condition)
            templates = await WorkflowTemplate.find(query).limit(limit).to_list()
        
        return [template.to_json() for template in templates]
        
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
