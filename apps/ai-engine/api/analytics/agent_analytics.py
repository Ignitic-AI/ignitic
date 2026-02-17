from typing import Dict, Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from core.auth import get_auth, AuthProvider
from datetime import datetime
from dateutil.relativedelta import relativedelta
from loguru import logger

from models.analytics import AgentRun

router = APIRouter(prefix="/analytics/agent")


class PaginatedAgentRunsResponse(BaseModel):
    agent_runs: List[AgentRun] = Field(..., description="List of agent runs")
    total: int = Field(
        ..., description="Total number of agent runs matching the filters"
    )
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    total_pages: int = Field(..., description="Total number of pages")


@router.get("/runs", response_model=PaginatedAgentRunsResponse)
async def get_agent_runs(
    agent_identifier: Optional[str] = Query(
        default=None, description="Filter by agent identifier"
    ),
    start_date: Optional[datetime] = Query(
        default=None, description="Filter runs from this date (inclusive)"
    ),
    end_date: Optional[datetime] = Query(
        default=None, description="Filter runs up to this date (inclusive)"
    ),
    org_only: Optional[bool] = Query(
        default=False, description="Whether to filter runs for the organization only"
    ),
    page: int = Query(default=1, ge=1, description="Page number (starts at 1)"),
    page_size: int = Query(
        default=50, ge=1, le=100, description="Number of items per page (max 100)"
    ),
    auth: AuthProvider = Depends(get_auth),
):
    """
    Retrieve agent run analytics with optional filters and pagination.

    Args:
        agent_identifier (Optional[str]): Agent identifier to filter runs.
        start_date (Optional[datetime]): Start date to filter runs from.
        end_date (Optional[datetime]): End date to filter runs up to.
        org_only (Optional[bool]): Whether to filter runs for the organization only.
        page (int): Page number (starts at 1).
        page_size (int): Number of items per page (max 100).
        auth (AuthProvider): Authenticated user.

    Returns:
        PaginatedAgentRunsResponse: Paginated list of agent runs with metadata.
    """
    try:
        user = auth.get_user()
        u_id = user.id
        org_id = user.org_id

        if org_only and not org_id:
            raise HTTPException(
                status_code=400,
                detail="Organization ID is required for org_only usage",
            )

        query = {}

        if u_id and not org_only:
            query["u_id"] = u_id
        if org_id:
            query["org_id"] = org_id
        if agent_identifier:
            query["agent_identifier"] = agent_identifier
        if start_date or end_date:
            query["created_at"] = {}
            if start_date:
                query["created_at"]["$gte"] = start_date
            if end_date:
                query["created_at"]["$lte"] = end_date

        # Get total count
        total = await AgentRun.find(query).count()

        # Calculate pagination
        skip = (page - 1) * page_size
        total_pages = (total + page_size - 1) // page_size  # Ceiling division

        # Get paginated results
        agent_runs = await AgentRun.find(query).skip(skip).limit(page_size).to_list()

        return PaginatedAgentRunsResponse(
            agent_runs=agent_runs,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    except Exception as e:
        logger.exception(f"❌ Failed to retrieve agent runs: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve agent runs")


class AgentUsageData(BaseModel):
    agent_identifier: str = Field(
        ..., description="the unique identifier for the agent"
    )
    agent_name: str = Field(..., description="the name of the agent")
    run_count: int = Field(..., description="Count of runs for the agent")
    input_tokens: int = Field(
        default=0, description="Total number of input tokens used"
    )
    output_tokens: int = Field(
        default=0, description="Total number of output tokens generated"
    )
    total_tokens: int = Field(default=0, description="Total number of tokens used")
    total_cost: float = Field(default=0.0, description="Total cost incurred in USD")


@router.get("/usage", response_model=List[AgentUsageData])
async def get_agent_usage(
    agent_identifiers: Optional[List[str]] = Query(
        default=None,
        description="Filter by specific agent identifiers. If not provided, returns data for all agents",
    ),
    org_only: Optional[bool] = Query(
        default=False, description="Whether to filter usage for the organization only"
    ),
    start_date: Optional[datetime] = Query(
        default_factory=lambda: datetime.now() - relativedelta(months=1),
        description="Filter usage from this date (inclusive)",
    ),
    end_date: Optional[datetime] = Query(
        default_factory=datetime.now,
        description="Filter usage up to this date (inclusive)",
    ),
    auth: AuthProvider = Depends(get_auth),
):
    """
    Retrieve aggregated agent usage analytics.

    Args:
        agent_identifiers (Optional[List[str]]): List of agent identifiers to filter. Returns all agents if not provided.
        start_date (Optional[datetime]): Start date to filter usage from.
        end_date (Optional[datetime]): End date to filter usage up to.
        auth (AuthProvider): Authenticated user.

    Returns:
        List[AgentUsageData]: List of aggregated agent usage data.
    """
    print(f"start date: {start_date}, end date: {end_date}")
    try:
        user = auth.get_user()
        u_id = user.id
        org_id = user.org_id

        if org_only and not org_id:
            raise HTTPException(
                status_code=400,
                detail="Organization ID is required for org_only usage",
            )

        match_stage = {}
        if u_id and not org_only:
            match_stage["u_id"] = u_id
        if org_id:
            match_stage["org_id"] = org_id
        if agent_identifiers:
            match_stage["agent_identifier"] = {"$in": agent_identifiers}
        if start_date or end_date:
            match_stage["created_at"] = {}
            if start_date:
                match_stage["created_at"]["$gte"] = start_date
            if end_date:
                match_stage["created_at"]["$lte"] = end_date

        pipeline = [
            {
                "$group": {
                    "_id": {
                        "agent_identifier": "$agent_identifier",
                        "agent_name": "$agent_name",
                    },
                    "run_count": {"$sum": 1},
                    "input_tokens": {"$sum": "$input_tokens"},
                    "output_tokens": {"$sum": "$output_tokens"},
                    "total_tokens": {"$sum": "$total_tokens"},
                    "total_cost": {"$sum": "$cost"},
                }
            },
            {
                "$project": {
                    "agent_identifier": "$_id.agent_identifier",
                    "agent_name": "$_id.agent_name",
                    "run_count": 1,
                    "input_tokens": 1,
                    "output_tokens": 1,
                    "total_tokens": 1,
                    "total_cost": 1,
                    "_id": 0,
                }
            },
        ]

        agent_usage_list = await (
            AgentRun.find(match_stage)
            .aggregate(pipeline, projection_model=AgentUsageData)
            .to_list()
        )

        return agent_usage_list

    except Exception as e:
        logger.exception(f"❌ Failed to retrieve agent usage data: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve agent usage data"
        )


class ModelUsageData(BaseModel):
    model_used: str = Field(..., description="The LLM model identifier")
    run_count: int = Field(..., description="Count of runs for the model")
    input_tokens: int = Field(
        default=0, description="Total number of input tokens used"
    )
    output_tokens: int = Field(
        default=0, description="Total number of output tokens generated"
    )
    total_tokens: int = Field(default=0, description="Total number of tokens used")
    total_cost: float = Field(default=0.0, description="Total cost incurred in USD")


@router.get("/models/usage", response_model=List[ModelUsageData])
async def get_model_usage(
    start_date: Optional[datetime] = Query(
        default_factory=lambda: datetime.now() - relativedelta(months=1),
        description="Filter usage from this date (inclusive)",
    ),
    end_date: Optional[datetime] = Query(
        default_factory=datetime.now,
        description="Filter usage up to this date (inclusive)",
    ),
    org_only: Optional[bool] = Query(
        default=False, description="Whether to filter usage for the organization only"
    ),
    auth: AuthProvider = Depends(get_auth),
):
    """
    Retrieve aggregated usage analytics by LLM model.

    Args:
        start_date (Optional[datetime]): Start date to filter usage from.
        end_date (Optional[datetime]): End date to filter usage up to.
        org_only (Optional[bool]): Whether to filter usage for the organization only.
        auth (AuthProvider): Authenticated user.

    Returns:
        List[ModelUsageData]: List of aggregated model usage data.
    """
    try:
        user = auth.get_user()
        u_id = user.id
        org_id = user.org_id

        if org_only and not org_id:
            raise HTTPException(
                status_code=400,
                detail="Organization ID is required for org_only usage",
            )

        match_stage = {}
        if u_id and not org_only:
            match_stage["u_id"] = u_id
        if org_id:
            match_stage["org_id"] = org_id
        if start_date or end_date:
            match_stage["created_at"] = {}
            if start_date:
                match_stage["created_at"]["$gte"] = start_date
            if end_date:
                match_stage["created_at"]["$lte"] = end_date

        pipeline = [
            {
                "$group": {
                    "_id": "$model_used",
                    "run_count": {"$sum": 1},
                    "input_tokens": {"$sum": "$input_tokens"},
                    "output_tokens": {"$sum": "$output_tokens"},
                    "total_tokens": {"$sum": "$total_tokens"},
                    "total_cost": {"$sum": "$cost"},
                }
            },
            {
                "$project": {
                    "model_used": "$_id",
                    "run_count": 1,
                    "input_tokens": 1,
                    "output_tokens": 1,
                    "total_tokens": 1,
                    "total_cost": 1,
                    "_id": 0,
                }
            },
        ]

        model_usage_list = await (
            AgentRun.find(match_stage)
            .aggregate(pipeline, projection_model=ModelUsageData)
            .to_list()
        )

        return model_usage_list

    except Exception as e:
        logger.exception(f"❌ Failed to retrieve model usage data: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve model usage data"
        )


class AgentLatencyData(BaseModel):
    agent_identifier: str = Field(
        ..., description="the unique identifier for the agent"
    )
    agent_name: str = Field(..., description="the name of the agent")
    run_count: int = Field(..., description="Count of runs for the agent")
    avg_duration_ms: float = Field(
        ..., description="Average run duration in milliseconds"
    )


@router.get("/latency", response_model=List[AgentLatencyData])
async def get_agent_latency(
    agent_identifiers: Optional[List[str]] = Query(
        default=None,
        description="Filter by specific agent identifiers. If not provided, returns data for all agents",
    ),
    org_only: Optional[bool] = Query(
        default=False, description="Whether to filter usage for the organization only"
    ),
    start_date: Optional[datetime] = Query(
        default_factory=lambda: datetime.now() - relativedelta(months=1),
        description="Filter usage from this date (inclusive)",
    ),
    end_date: Optional[datetime] = Query(
        default_factory=datetime.now,
        description="Filter usage up to this date (inclusive)",
    ),
    auth: AuthProvider = Depends(get_auth),
):
    """
    Retrieve average agent latency analytics.

    Args:
        agent_identifiers (Optional[List[str]]): List of agent identifiers to filter. Returns all agents if not provided.
        org_only (Optional[bool]): Whether to filter usage for the organization only.
        start_date (Optional[datetime]): Start date to filter usage from.
        end_date (Optional[datetime]): End date to filter usage up to.
        auth (AuthProvider): Authenticated user.

    Returns:
        List[AgentLatencyData]: List of aggregated agent latency data.
    """
    try:
        user = auth.get_user()
        u_id = user.id
        org_id = user.org_id

        if org_only and not org_id:
            raise HTTPException(
                status_code=400,
                detail="Organization ID is required for org_only usage",
            )

        match_stage = {}
        if u_id and not org_only:
            match_stage["u_id"] = u_id
        if org_id:
            match_stage["org_id"] = org_id
        if agent_identifiers:
            match_stage["agent_identifier"] = {"$in": agent_identifiers}
        if start_date or end_date:
            match_stage["created_at"] = {}
            if start_date:
                match_stage["created_at"]["$gte"] = start_date
            if end_date:
                match_stage["created_at"]["$lte"] = end_date

        pipeline = [
            {
                "$group": {
                    "_id": {
                        "agent_identifier": "$agent_identifier",
                        "agent_name": "$agent_name",
                    },
                    "run_count": {"$sum": 1},
                    "avg_duration_ms": {"$avg": "$duration_ms"},
                }
            },
            {
                "$project": {
                    "agent_identifier": "$_id.agent_identifier",
                    "agent_name": "$_id.agent_name",
                    "run_count": 1,
                    "avg_duration_ms": 1,
                    "_id": 0,
                }
            },
        ]

        latency_list = await (
            AgentRun.find(match_stage)
            .aggregate(pipeline, projection_model=AgentLatencyData)
            .to_list()
        )

        return latency_list

    except Exception as e:
        logger.exception(f"❌ Failed to retrieve agent latency data: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to retrieve agent latency data"
        )
