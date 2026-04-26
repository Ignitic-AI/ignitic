from typing import List, Optional, Any, Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from beanie.operators import And, In, Or
from pydantic import BaseModel, Field
from core.auth import get_auth, AuthProvider
from core.backend_client import BackendClient
from models.agent import Agent, AgentType, PrebuiltAgents
from services.agents.agent_service import AgentService
from services.agents.mcp_client import MCPClientService
from loguru import logger
import re
import uuid

from models.analytics import ToolExecution
from api.analytics.tool_analytics import PaginatedToolExecutionsResponse, ToolExecutionListItem

router = APIRouter(prefix="/agents")


class ToolInfo(BaseModel):
    name: str
    description: Optional[str] = None

    @staticmethod
    def from_base_tool(tool) -> "ToolInfo":
        return ToolInfo(name=tool.name, description=tool.description)


class AgentInfo(BaseModel):
    identifier: str
    name: str
    type: AgentType
    parent: str
    tools: List[ToolInfo]


@router.get("/available-tools", response_model=List[ToolInfo])
async def list_available_tools_for_custom_agents(auth: AuthProvider = Depends(get_auth)):
    """
    List all tools exposed by the MCP /custom server.
    Frontend can use this to let users pick tools for a custom agent.
    """
    try:
        mcp_client_service = MCPClientService(auth=auth)
        tools = await mcp_client_service.get_client().get_tools(server_name="custom")
        return [ToolInfo.from_base_tool(t) for t in (tools or [])]
    except Exception as e:
        root = _get_root_cause(e)
        logger.error(f"Failed to list available tools: {root}")
        raise HTTPException(
            status_code=500, detail=f"Failed to list available tools: {str(root)}"
        )


class CreateAgentRequest(BaseModel):
    identifier: Optional[str] = Field(
        default=None,
        description=(
            "Optional unique identifier. If omitted, one is generated from name. "
            "Allowed: lowercase letters, numbers, and underscores."
        ),
    )
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(min_length=1, max_length=500)
    system_prompt: str = Field(min_length=1, max_length=8000)
    type: AgentType = Field(default=AgentType.WORKER)
    parent: str = Field(default="super_agent")
    tags: List[str] = Field(default_factory=list)
    tool_names: List[str] = Field(
        default_factory=list,
        description="Optional list of MCP tool names to enable for this custom agent",
    )
    is_org: bool = Field(default=False)


def _get_root_cause(exc: Exception) -> Exception:
    """Extract the underlying exception from ExceptionGroup/TaskGroup errors."""
    if hasattr(exc, "exceptions") and exc.exceptions:
        return _get_root_cause(exc.exceptions[0])
    return exc


async def _get_agent_tools_safe(mcp_client_service: MCPClientService, agent: Agent) -> List[Any]:
    """Fetch agent tools from MCP, returning empty list if MCP is unreachable."""
    try:
        return await mcp_client_service.get_agent_tools(agent)
    except Exception as e:
        root = _get_root_cause(e)
        logger.warning(
            f"MCP tools unavailable for agent {agent.identifier}: {root}. "
            "Is the MCP server running at MCP_SERVER_URL?"
        )
        return []


def _normalize_identifier(value: str) -> str:
    v = (value or "").strip().lower()
    v = re.sub(r"[^a-z0-9_]+", "_", v)
    v = re.sub(r"_+", "_", v).strip("_")
    return v


def _validate_custom_identifier(identifier: str) -> None:
    if identifier in [e.value for e in PrebuiltAgents] or identifier == "super_agent":
        raise HTTPException(status_code=409, detail="identifier is reserved")
    if not re.fullmatch(r"[a-z0-9_]{3,64}", identifier or ""):
        raise HTTPException(status_code=422, detail="identifier must match ^[a-z0-9_]{3,64}$")


async def _get_accessible_org_ids(auth: AuthProvider) -> set[str]:
    user = auth.get_user()
    org_ids: set[str] = set()

    if user.org_id:
        org_ids.add(str(user.org_id))

    try:
        payload = await BackendClient(auth).get("organizations")
        organizations = payload.get("organizations", []) if isinstance(payload, dict) else []
        for org in organizations:
            org_id = org.get("id") if isinstance(org, dict) else None
            if org_id:
                org_ids.add(str(org_id))
    except Exception as exc:
        logger.warning(f"Failed to resolve organization memberships for tool calls: {exc}")

    return org_ids


async def _assert_identifier_available(identifier: str, *, u_id: Optional[str], org_id: Optional[str]) -> None:
    q = {"identifier": identifier}
    if org_id:
        q["org_id"] = org_id
    else:
        q["u_id"] = u_id
    existing = await Agent.find_one(q)
    if existing is not None:
        raise HTTPException(status_code=409, detail="agent identifier already exists")


@router.post("/", response_model=AgentInfo, status_code=201)
async def create_agent(request: CreateAgentRequest, auth: AuthProvider = Depends(get_auth)):
    """
    Create a custom agent for the authenticated user (or org when is_org=true).
    """
    try:
        user = auth.get_user()
        is_org = bool(request.is_org)

        raw_identifier = request.identifier or _normalize_identifier(request.name)
        identifier = raw_identifier if raw_identifier else f"custom_{uuid.uuid4().hex[:10]}"
        identifier = _normalize_identifier(identifier)
        _validate_custom_identifier(identifier)

        u_id = None if is_org else str(user.id)
        org_id = str(user.org_id) if is_org else None
        await _assert_identifier_available(identifier, u_id=u_id, org_id=org_id)

        agent = Agent(
            identifier=identifier,
            u_id=u_id,
            org_id=org_id,
            name=request.name.strip(),
            description=request.description.strip(),
            type=request.type,
            parent=(request.parent or "super_agent").strip(),
            system_prompt=request.system_prompt,
            tags=list(request.tags or []),
            tool_names=list(request.tool_names or []),
        )
        await agent.insert()

        mcp_client_service = MCPClientService(auth=auth)
        tools = await _get_agent_tools_safe(mcp_client_service, agent)
        return AgentInfo(
            identifier=agent.identifier,
            name=agent.name,
            type=agent.type,
            parent=agent.parent,
            tools=[ToolInfo.from_base_tool(t) for t in tools],
        )
    except HTTPException:
        raise
    except Exception as e:
        root = _get_root_cause(e)
        logger.error(f"Failed to create agent: {root}")
        raise HTTPException(status_code=500, detail=f"Failed to create agent: {str(root)}")

@router.get("/", response_model=List[AgentInfo])
async def list_agents(is_org: bool = False, auth: AuthProvider = Depends(get_auth)):
    try:
        logger.info(f"Listing agents for {'organization' if is_org else 'user'}")
        mcp_client_service = MCPClientService(auth=auth)
        agent_infos = []
        agent_service = AgentService(auth=auth)
        if is_org:
            agents = await agent_service.get_org_agents()
        else:
            agents = await agent_service.get_user_agents()
        for agent in agents:
            tools = await _get_agent_tools_safe(mcp_client_service, agent)
            agent_infos.append(
                AgentInfo(
                    identifier=agent.identifier,
                    name=agent.name,
                    type=agent.type,
                    parent=agent.parent,
                    tools=[ToolInfo.from_base_tool(t) for t in tools],
                )
            )
        logger.info(f"Successfully listed {len(agent_infos)} agents")
        return agent_infos
    except Exception as e:
        root = _get_root_cause(e)
        logger.error(f"Failed to list agents: {root}")
        raise HTTPException(status_code=500, detail=f"Failed to list agents: {str(root)}")


@router.get("/{agent_identifier}", response_model=AgentInfo)
@router.get("/{agent_identifier}", response_model=AgentInfo)
async def get_agent(
    agent_identifier: str,
    is_org: bool = False,
    auth: AuthProvider = Depends(get_auth),
):
    try:
        logger.info(
            f"Getting agent {agent_identifier} for {'organization' if is_org else 'user'}"
        )
        agent_service = AgentService(auth=auth)
        if is_org:
            agents = await agent_service.get_org_agents(identifiers=[agent_identifier])
        else:
            agents = await agent_service.get_user_agents(identifiers=[agent_identifier])
        if not agents or agents == []:
            logger.warning(f"Agent {agent_identifier} not found")
            raise HTTPException(status_code=404, detail="Agent not found")

        logger.info(f"Successfully retrieved agent {agent_identifier}")
        mcp_client_service = MCPClientService(auth=auth)
        tools = await _get_agent_tools_safe(mcp_client_service, agents[0])
        return AgentInfo(
            identifier=agents[0].identifier,
            name=agents[0].name,
            type=agents[0].type,
            parent=agents[0].parent,
            tools=[ToolInfo.from_base_tool(t) for t in tools],
        )
    except Exception as e:
        logger.error(f"Failed to get agent {agent_identifier}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to list agent tools: {str(e)}"
        )


@router.get("/{agent_identifier}/tools", response_model=List[ToolInfo])
async def list_agent_tools(
    agent_identifier: str,
    is_org: bool = False,
    auth: AuthProvider = Depends(get_auth),
):
    try:
        logger.info(
            f"Listing tools for agent {agent_identifier} for {'organization' if is_org else 'user'}"
        )
        agent_service = AgentService(auth=auth)
        if is_org:
            agents = await agent_service.get_org_agents(identifiers=[agent_identifier])
        else:
            agents = await agent_service.get_user_agents(identifiers=[agent_identifier])
        if not agents or agents == []:
            logger.warning(f"Agent {agent_identifier} not found")
            raise HTTPException(status_code=404, detail="Agent not found")
        agent = agents[0]
        mcp_client_service = MCPClientService(auth=auth)
        tools = await _get_agent_tools_safe(mcp_client_service, agent)
        logger.info(
            f"Successfully listed {len(tools)} tools for agent {agent_identifier}"
        )
        return [ToolInfo.from_base_tool(t) for t in tools]
    except Exception as e:
        logger.error(f"Failed to list agent tools for {agent_identifier}: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Failed to list agent tools: {str(e)}"
        )


class AgentUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, description="The new name of the agent")
    description: Optional[str] = Field(
        default=None, description="The new description of the agent"
    )
    system_prompt: Optional[str] = Field(
        default=None, description="The new system prompt of the agent"
    )
    type: Optional[AgentType] = Field(
        default=None, description="The type of agent, either 'orchestrator' or 'worker'"
    )
    parent: Optional[str] = Field(
        default=None,
        description="The parent agent's identifier, default is 'super_agent'",
    )
    tags: Optional[List[str]] = Field(
        default=None,
        description="A list of tag ids associated with the agent for categorization and searchability",
    )


class DeleteAgentResponse(BaseModel):
    success: bool
    identifier: str
    message: str


@router.delete("/{agent_identifier}", response_model=DeleteAgentResponse)
async def delete_agent(
    agent_identifier: str,
    is_org: bool = False,
    auth: AuthProvider = Depends(get_auth),
):
    """
    Delete a custom agent only.
    Prebuilt agents are protected and cannot be deleted.
    """
    try:
        user = auth.get_user()

        if agent_identifier in [e.value for e in PrebuiltAgents]:
            raise HTTPException(
                status_code=400,
                detail="Prebuilt agents cannot be deleted",
            )

        query = {"identifier": agent_identifier}
        if is_org:
            if not user.org_id:
                raise HTTPException(status_code=400, detail="User is not in an organization")
            query["org_id"] = str(user.org_id)
        else:
            query["u_id"] = str(user.id)

        agent = await Agent.find_one(query)
        if not agent:
            raise HTTPException(status_code=404, detail="Custom agent not found")

        # Defensive check in case data is inconsistent.
        if agent.is_prebuilt():
            raise HTTPException(
                status_code=400,
                detail="Prebuilt agents cannot be deleted",
            )

        await agent.delete()
        return DeleteAgentResponse(
            success=True,
            identifier=agent_identifier,
            message="Custom agent deleted successfully",
        )
    except HTTPException:
        raise
    except Exception as e:
        root = _get_root_cause(e)
        logger.error(f"Failed to delete custom agent {agent_identifier}: {root}")
        raise HTTPException(
            status_code=500, detail=f"Failed to delete custom agent: {str(root)}"
        )


@router.put("/{agent_identifier}")
async def update_agent(
    agent_identifier: str,
    update_request: AgentUpdateRequest,
    is_org: bool = False,
    auth: AuthProvider = Depends(get_auth),
):
    try:
        logger.info(
            f"Updating agent {agent_identifier} for {'organization' if is_org else 'user'}"
        )
        agent_service = AgentService(auth=auth)
        if is_org:
            agents = await agent_service.get_org_agents(identifiers=[agent_identifier])
        else:
            agents = await agent_service.get_user_agents(identifiers=[agent_identifier])
        if not agents or agents == []:
            logger.warning(f"Agent {agent_identifier} not found")
            raise HTTPException(status_code=404, detail="Agent not found")
        agent: Agent = agents[0]

        if update_request.name:
            logger.info(f"Updating name to {update_request.name}")
            agent.set_agent_name(update_request.name)
        if update_request.description:
            logger.info(f"Updating description to {update_request.description}")
            agent.set_agent_description(update_request.description)
        if update_request.system_prompt:
            logger.info("Updating system prompt")
            agent.set_system_prompt(update_request.system_prompt)
        if update_request.type is not None:
            logger.info(f"Updating type to {update_request.type}")
            agent.type = update_request.type
        if update_request.parent is not None:
            logger.info(f"Updating parent to {update_request.parent}")
            agent.parent = update_request.parent
        if update_request.tags is not None:
            logger.info(f"Updating tags to {update_request.tags}")
            agent.update_tags(update_request.tags)

        if agent.id is None:
            await agent.insert()
            logger.info(f"Inserted new agent {agent_identifier}")
        else:
            await agent.save()
            logger.info(f"Saved updated agent {agent_identifier}")

        return agent

    except Exception as e:
        logger.error(f"Failed to update agent {agent_identifier}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update agent: {str(e)}")


@router.post("/{agent_identifier}/reset")
async def reset_agent(
    agent_identifier: str,
    is_org: bool = False,
    auth: AuthProvider = Depends(get_auth),
):
    try:
        logger.info(
            f"Resetting agent {agent_identifier} for {'organization' if is_org else 'user'}"
        )
        agent_service = AgentService(auth=auth)
        if is_org:
            agents = await agent_service.get_org_agents(identifiers=[agent_identifier])
        else:
            agents = await agent_service.get_user_agents(identifiers=[agent_identifier])
        if not agents or agents == []:
            logger.warning(f"Agent {agent_identifier} not found")
            raise HTTPException(status_code=404, detail="Agent not found")
        agent: Agent = agents[0]

        agent.reset_attributes()
        logger.info(f"Reset attributes for agent {agent_identifier}")

        if agent.id is None:
            await agent.insert()
            logger.info(f"Inserted reset agent {agent_identifier}")
        else:
            await agent.save()
            logger.info(f"Saved reset agent {agent_identifier}")

        return agent

    except Exception as e:
        logger.error(f"Failed to reset agent {agent_identifier}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to update agent: {str(e)}")

@router.get("/{agent_identifier}/tool-calls", response_model=PaginatedToolExecutionsResponse)
async def list_agent_tool_calls(
    agent_identifier: str,
    scope: Optional[Literal["personal", "org", "all"]] = Query(default=None),
    is_org: bool = False,
    organization_id: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    auth: AuthProvider = Depends(get_auth),
):
    try:
        user = auth.get_user()
        user_id = str(user.id)
        accessible_org_ids = await _get_accessible_org_ids(auth)
        effective_scope = scope or ("org" if is_org else "personal")

        regex_pattern = f"^(?:tools\\.|workflows?\\.[^.]+\\.){re.escape(agent_identifier)}\\."
        base_filter = {"ignitic_identifier": {"$regex": regex_pattern}}

        personal_filter = And(ToolExecution.u_id == user_id, ToolExecution.org_id == None)
        scope_filter: Any = personal_filter

        if effective_scope == "org":
            target_org_id = organization_id or (str(user.org_id) if user.org_id else None)
            if not target_org_id:
                raise HTTPException(status_code=400, detail="Organization context is required")
            if target_org_id not in accessible_org_ids:
                raise HTTPException(status_code=403, detail="Organization access denied")
            scope_filter = ToolExecution.org_id == target_org_id
        elif effective_scope == "all":
            if accessible_org_ids:
                scope_filter = Or(personal_filter, In(ToolExecution.org_id, list(accessible_org_ids)))
            else:
                scope_filter = personal_filter

        total = await ToolExecution.find(base_filter, scope_filter).count()
        skip = (page - 1) * page_size
        total_pages = (total + page_size - 1) // page_size if page_size > 0 else 0

        executions = (
            await ToolExecution.find(base_filter, scope_filter)
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
            total_pages=total_pages
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to list agent tool calls: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to list agent tool calls")
