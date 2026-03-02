from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from core.auth import get_auth, AuthProvider
from models.agent import Agent, AgentType
from services.agents.agents_service import AgentService
from services.agents.mcp_client import MCPClientService
from loguru import logger

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
            agent_infos.append(
                AgentInfo(
                    identifier=agent.identifier,
                    name=agent.name,
                    type=agent.type,
                    parent=agent.parent,
                    tools=[
                        ToolInfo.from_base_tool(base_tool)
                        for base_tool in (
                            await mcp_client_service.get_agent_tools(agent)
                        )
                    ],
                )
            )
        logger.info(f"Successfully listed {len(agent_infos)} agents")
        return agent_infos
    except Exception as e:
        logger.error(f"Failed to list agents: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to list agents: {str(e)}")


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

        agent = agents[0]
        mcp_client_service = MCPClientService(auth=auth)

        logger.info(f"Successfully retrieved agent {agent_identifier}")
        return AgentInfo(
            identifier=agents[0].identifier,
            name=agents[0].name,
            type=agents[0].type,
            parent=agents[0].parent,
            tools=[
                ToolInfo.from_base_tool(base_tool)
                for base_tool in (
                    await MCPClientService(auth=auth).get_agent_tools(agents[0])
                )
            ],
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
        tools = [
            ToolInfo.from_base_tool(base_tool)
            for base_tool in (await MCPClientService(auth=auth).get_agent_tools(agent))
        ]
        logger.info(
            f"Successfully listed {len(tools)} tools for agent {agent_identifier}"
        )
        return tools
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
