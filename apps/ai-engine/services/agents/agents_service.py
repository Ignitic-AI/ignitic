import asyncio
from typing import List, Optional
from langgraph_supervisor import create_supervisor
from models.agent import Agent
from services.agents.llms import get_llm
from services.agents.prompts import super_agent_prompt
from services.agents.checkpointers import (
    get_mongo_checkpointer,
    isCheckpointerLastMessageEqualTo,
)
from services.agents.memory_stores import get_mongo_memory_store
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent
from models.chat import PrebuiltAgents
from services.agents.mcp_client import MCPClientService
from core.auth import AuthProvider
from fastapi import HTTPException
from langgraph.graph import StateGraph, MessagesState, START
from langchain_core.runnables import RunnableConfig
from langgraph.store.base import BaseStore


async def ainvoke_agents(
    agents: List[Agent],
    message: str,
    thread_id: str,
    auth: AuthProvider,
    model: str | None = None,
):
    effective_llm = get_llm(model)
    agent = await AgentResolver(model_llm=effective_llm, auth=auth).resolve(agents)

    RETRY_COUNT = 3
    INITIAL_DELAY = 1  # seconds
    MAX_DELAY = 10  # seconds

    delay = INITIAL_DELAY
    agent_response = None

    while agent_response is None and RETRY_COUNT > 0:
        try:
            if await isCheckpointerLastMessageEqualTo(thread_id, message):
                agent_response = await agent.ainvoke(
                    {},
                    config={
                        "configurable": {
                            "thread_id": thread_id,
                        }
                    },
                )
            else:
                agent_response = await agent.ainvoke(
                    {
                        "messages": [
                            {
                                "role": "user",
                                "content": message,
                            }
                        ]
                    },
                    config={
                        "configurable": {
                            "thread_id": thread_id,
                        }
                    },
                )
        except Exception as e:
            RETRY_COUNT -= 1
            if RETRY_COUNT == 0:
                raise Exception(f"Agent failed: {str(e)}")
            await asyncio.sleep(delay)
            delay = min(delay * 2, MAX_DELAY)  # Exponential backoff
    if agent_response is None:
        raise Exception("Agent failed after retries")
    return agent_response


class AgentService:
    def __init__(self, auth: AuthProvider):
        self._auth = auth

    async def get_user_agents(self, identifiers: List[str] = []) -> List[Agent]:
        agents = await Agent.find_many(
            Agent.u_id == str(self._auth.get_user().id)
        ).to_list()
        for prebuilt_agent in [Agent.prebuilt(pt) for pt in list(PrebuiltAgents)]:
            if all(agent.identifier != prebuilt_agent.identifier for agent in agents):
                prebuilt_agent.u_id = str(self._auth.get_user().id)
                agents.append(prebuilt_agent)
        if len(identifiers) == 0:
            return agents
        else:
            # Check if all requested identifiers exist
            available_identifiers = {agent.identifier for agent in agents}
            missing_identifiers = set(identifiers) - available_identifiers
            if missing_identifiers:
                raise HTTPException(
                    status_code=404,
                    detail=f"Agents not found: {', '.join(missing_identifiers)}"
                )
            return [agent for agent in agents if agent.identifier in identifiers]
        

    async def get_org_agents(self, identifiers: List[str] = []) -> List[Agent]:
        agents = await Agent.find_many(
            Agent.org_id == str(self._auth.get_user().org_id) 
        ).to_list()
        for prebuilt_agent in [Agent.prebuilt(pt) for pt in list(PrebuiltAgents)]:
            if all(agent.identifier != prebuilt_agent.identifier for agent in agents):
                prebuilt_agent.org_id = str(self._auth.get_user().org_id)
                agents.append(prebuilt_agent)
        if len(identifiers) == 0:
            return agents
        else:
            # Check if all requested identifiers exist
            available_identifiers = {agent.identifier for agent in agents}
            missing_identifiers = set(identifiers) - available_identifiers
            if missing_identifiers:
                raise HTTPException(
                    status_code=404,
                    detail=f"Agents not found: {', '.join(missing_identifiers)}"
                )
            return [agent for agent in agents if agent.identifier in identifiers]


class AgentResolver:
    def __init__(self, auth: AuthProvider, model_llm):
        self.model_llm = model_llm or get_llm()
        self._auth = auth


    async def resolve(self, agents: List[Agent]) -> CompiledStateGraph:
        mcp_client_service = MCPClientService(self._auth)

        if len(agents) == 1:
            tools = await mcp_client_service.get_agent_tools(agents[0])
            return create_react_agent(
                name=agents[0].name,
                model=self.model_llm,
                tools=tools,
                prompt=agents[0].system_prompt,
                checkpointer=get_mongo_checkpointer(),
                store=get_mongo_memory_store(),
                pre_model_hook=AgentHooks.pre_agent_hook
            )
        else:
            if len(agents) == 0:
                agents = [
                    Agent.prebuilt(prebuilt_type=prebuilt_type)
                    for prebuilt_type in list(PrebuiltAgents)
                ]
            return create_supervisor(
                supervisor_name="SuperAgent",
                agents=[
                    create_react_agent(
                        name=agent.name,
                        model=self.model_llm,
                        tools=await mcp_client_service.get_agent_tools(agent),
                        prompt=agent.system_prompt,
                    )
                    for agent in agents
                ],
                model=self.model_llm,
                prompt=super_agent_prompt,
                add_handoff_back_messages=True,
                output_mode="full_history",
            ).compile(checkpointer=get_mongo_checkpointer())
        

class AgentHooks:

    @staticmethod
    def memory_retreiver_hook(state: MessagesState, config: RunnableConfig, store: BaseStore, **kwargs) -> MessagesState:
        print("Memory retriever hook")
        print(f"Config: {config}")
        print(f"State: {state}")
    
        return state

    @staticmethod
    def pre_agent_hook(state: MessagesState, config: RunnableConfig, store: BaseStore, **kwargs) -> MessagesState:
        state = AgentHooks.memory_retreiver_hook(state, config, store, **kwargs)
        return state