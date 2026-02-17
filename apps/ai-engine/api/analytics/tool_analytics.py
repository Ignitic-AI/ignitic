from typing import Any, Dict, List, Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from core.auth import get_auth, AuthProvider
from datetime import datetime
from loguru import logger
from beanie import PydanticObjectId

from models.analytics import ToolExecution

router = APIRouter(prefix="/analytics/tool")


class ToolExecutionCreateRequest(BaseModel):
    tool_name: str = Field(..., description="The name of the tool executed")
    ignitic_identifier: str = Field(
        ..., description="Ignitic identifier for tracing tool execution"
    )
    chat_id: Optional[str] = Field(
        default=None, description="The unique identifier for the chat session"
    )
    status: Optional[Literal["running", "succeeded", "failed"]] = Field(
        default=None, description="Current execution status"
    )
    input_payload: Dict[str, Any] = Field(
        default_factory=dict, description="Input payload for the tool call"
    )
    response_payload: Optional[Dict[str, Any]] = Field(
        default=None, description="Tool response payload, if available"
    )
    error: Optional[str] = Field(
        default=None, description="Error message if execution failed"
    )
    is_workflow: bool = Field(
        default=False, description="Whether this execution is part of a workflow"
    )
    workflow_provider: Optional[str] = Field(
        default=None, description="Workflow provider name (e.g., n8n, make.com)"
    )


class ToolExecutionUpdateRequest(BaseModel):
    tool_name: Optional[str] = Field(
        default=None, description="The name of the tool executed"
    )
    ignitic_identifier: Optional[str] = Field(
        default=None, description="Ignitic identifier for tracing tool execution"
    )
    chat_id: Optional[str] = Field(
        default=None, description="The unique identifier for the chat session"
    )
    status: Optional[Literal["running", "succeeded", "failed"]] = Field(
        default=None, description="Current execution status"
    )
    input_payload: Optional[Dict[str, Any]] = Field(
        default=None, description="Input payload for the tool call"
    )
    response_payload: Optional[Dict[str, Any]] = Field(
        default=None, description="Tool response payload, if available"
    )
    error: Optional[str] = Field(
        default=None, description="Error message if execution failed"
    )
    is_workflow: Optional[bool] = Field(
        default=None, description="Whether this execution is part of a workflow"
    )
    workflow_provider: Optional[str] = Field(
        default=None, description="Workflow provider name (e.g., n8n, make.com)"
    )


class ToolExecutionListItem(BaseModel):
    id: PydanticObjectId = Field(..., alias="_id", description="Tool execution id")
    tool_name: str = Field(..., description="The name of the tool executed")
    ignitic_identifier: str = Field(
        ..., description="Ignitic identifier for tracing tool execution"
    )
    chat_id: Optional[str] = Field(
        default=None, description="The unique identifier for the chat session"
    )
    status: Literal["running", "succeeded", "failed"] = Field(
        ..., description="Current execution status"
    )
    is_workflow: bool = Field(
        default=False, description="Whether this execution is part of a workflow"
    )
    workflow_provider: Optional[str] = Field(
        default=None, description="Workflow provider name (e.g., n8n, make.com)"
    )
    created_at: datetime = Field(
        ..., description="Timestamp when the tool execution was created"
    )
    updated_at: datetime = Field(
        ..., description="Timestamp when the tool execution was last updated"
    )

    model_config = {
        "populate_by_name": True,
        "arbitrary_types_allowed": True,
    }


class PaginatedToolExecutionsResponse(BaseModel):
    executions: List[ToolExecutionListItem] = Field(
        ..., description="List of tool executions"
    )
    total: int = Field(
        ..., description="Total number of tool executions matching the filters"
    )
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")


@router.post("/executions", response_model=ToolExecution)
async def log_tool_execution(
    request: ToolExecutionCreateRequest,
    auth: AuthProvider = Depends(get_auth),
):
    try:
        user = auth.get_user()
        logger.info(
            f"📝 Creating tool execution log for tool: {request.tool_name}, "
            f"ignitic_id: {request.ignitic_identifier}, status: {request.status or 'running'}"
        )

        execution = ToolExecution(
            tool_name=request.tool_name,
            ignitic_identifier=request.ignitic_identifier,
            chat_id=request.chat_id,
            u_id=user.id,
            org_id=user.org_id,
            status=request.status or "running",
            input_payload=request.input_payload,
            response_payload=request.response_payload,
            error=request.error,
            is_workflow=request.is_workflow,
            workflow_provider=request.workflow_provider,
        )
        await execution.insert()

        logger.info(
            f"✅ Tool execution logged successfully with id: {execution.id}, "
            f"tool: {request.tool_name}"
        )
        return execution

    except Exception as e:
        logger.exception(f"❌ Failed to log tool execution: {e}")
        raise HTTPException(status_code=500, detail="Failed to log tool execution")


@router.patch("/executions/{execution_id}", response_model=ToolExecution)
async def update_tool_execution(
    execution_id: str,
    request: ToolExecutionUpdateRequest,
    auth: AuthProvider = Depends(get_auth),
):
    try:
        user = auth.get_user()
        logger.info(f"🔄 Updating tool execution with id: {execution_id}")

        update_data = request.model_dump(exclude_unset=True)
        if not update_data:
            logger.warning(
                f"⚠️ No fields provided for update on execution: {execution_id}"
            )
            raise HTTPException(status_code=400, detail="No fields provided for update")

        execution = await ToolExecution.find_one(
            {
                "_id": PydanticObjectId(execution_id),
                "u_id": user.id,
                "org_id": user.org_id,
            }
        )
        if not execution:
            logger.warning(f"⚠️ Tool execution not found: {execution_id}")
            raise HTTPException(status_code=404, detail="Tool execution not found")

        logger.info(
            f"📝 Updating fields: {list(update_data.keys())} for execution: {execution_id}"
        )
        for key, value in update_data.items():
            setattr(execution, key, value)
        execution.updated_at = datetime.now()
        await execution.save()

        logger.info(
            f"✅ Tool execution updated successfully: {execution_id}, "
            f"tool: {execution.tool_name}, status: {execution.status}"
        )
        return execution

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ Failed to update tool execution: {e}")
        raise HTTPException(status_code=500, detail="Failed to update tool execution")


@router.get("/executions", response_model=PaginatedToolExecutionsResponse)
async def list_tool_executions(
    tool_name: Optional[str] = Query(default=None, description="Filter by tool name"),
    status: Optional[Literal["running", "succeeded", "failed"]] = Query(
        default=None, description="Filter by execution status"
    ),
    ignitic_identifier: Optional[str] = Query(
        default=None, description="Filter by ignitic identifier"
    ),
    chat_id: Optional[str] = Query(
        default=None, description="Filter by chat identifier"
    ),
    is_workflow: Optional[bool] = Query(
        default=None, description="Filter by workflow flag"
    ),
    workflow_provider: Optional[str] = Query(
        default=None, description="Filter by workflow provider"
    ),
    start_date: Optional[datetime] = Query(
        default=None, description="Filter executions from this date (inclusive)"
    ),
    end_date: Optional[datetime] = Query(
        default=None, description="Filter executions up to this date (inclusive)"
    ),
    org_only: Optional[bool] = Query(
        default=False,
        description="Whether to filter executions for the organization only",
    ),
    page: int = Query(default=1, ge=1, description="Page number (starts at 1)"),
    page_size: int = Query(
        default=50, ge=1, le=100, description="Number of items per page (max 100)"
    ),
    auth: AuthProvider = Depends(get_auth),
):
    try:
        user = auth.get_user()
        u_id = user.id
        org_id = user.org_id

        if org_only and not org_id:
            raise HTTPException(
                status_code=400,
                detail="Organization ID is required for org_only usage",
            )

        query: Dict[str, Any] = {}
        if u_id and not org_only:
            query["u_id"] = u_id
        if org_id:
            query["org_id"] = org_id
        if tool_name:
            query["tool_name"] = tool_name
        if status:
            query["status"] = status
        if ignitic_identifier:
            query["ignitic_identifier"] = ignitic_identifier
        if chat_id:
            query["chat_id"] = chat_id
        if is_workflow is not None:
            query["is_workflow"] = is_workflow
        if workflow_provider:
            query["workflow_provider"] = workflow_provider
        if start_date or end_date:
            query["created_at"] = {}
            if start_date:
                query["created_at"]["$gte"] = start_date
            if end_date:
                query["created_at"]["$lte"] = end_date

        total = await ToolExecution.find(query).count()
        skip = (page - 1) * page_size
        total_pages = (total + page_size - 1) // page_size

        executions = (
            await ToolExecution.find(query)
            .sort("-created_at")
            .skip(skip)
            .limit(page_size)
            .project(ToolExecutionListItem)
            .to_list()
        )

        return PaginatedToolExecutionsResponse(
            executions=executions,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    except Exception as e:
        logger.exception(f"❌ Failed to list tool executions: {e}")
        raise HTTPException(status_code=500, detail="Failed to list tool executions")


@router.get("/executions/{execution_id}", response_model=ToolExecution)
async def get_tool_execution(
    execution_id: str,
    auth: AuthProvider = Depends(get_auth),
):
    try:
        user = auth.get_user()
        execution = await ToolExecution.find_one(
            {
                "_id": PydanticObjectId(execution_id),
                "u_id": user.id,
                "org_id": user.org_id,
            }
        )
        if not execution:
            raise HTTPException(status_code=404, detail="Tool execution not found")
        return execution

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"❌ Failed to retrieve tool execution: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve tool execution")
