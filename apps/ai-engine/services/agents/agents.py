import asyncio
from typing import List
from langgraph_supervisor import create_supervisor
from services.agents.llms import llm, get_llm
from services.agents.prompts import super_agent_prompt
from services.agents.checkpointers import (
    get_mongo_checkpointer,
    isCheckpointerLastMessageEqualTo,
)
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent
from services.agents.prompts import AGENT_PROMPTS
from models.chat import Agent
from services.agents.mcp_client import get_tools_for_agent


async def ainvoke_agents(
    agents: List[Agent],
    message: str,
    thread_id: str,
    model: str | None = None,
):
    effective_llm = get_llm(model) if model else llm
    agent = await AgentResolver(effective_llm).resolve(agents)

    RETRY_COUNT = 3
    INITIAL_DELAY = 1  # seconds
    MAX_DELAY = 10     # seconds

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
    return agent_response


class AgentResolver:
    def __init__(self, model_llm=llm):
        self.model_llm = model_llm

    async def resolve(self, agents: List[Agent]) -> CompiledStateGraph:
        if len(agents) == 1:
            tools = await get_tools_for_agent(agents[0])
            return create_react_agent(
                name=agents[0],
                model=self.model_llm,
                tools=tools,
                prompt=AGENT_PROMPTS[agents[0]],
                checkpointer=get_mongo_checkpointer(),
            )
        else:
            if len(agents) == 0:
                agents = list(Agent)
            return create_supervisor(
                supervisor_name="SuperAgent",
                agents=[
                    create_react_agent(
                        name=agent.value,
                        model=self.model_llm,
                        tools=await get_tools_for_agent(agent),
                        prompt=AGENT_PROMPTS[agent],
                    )
                    for agent in agents
                ],
                model=self.model_llm,
                prompt=super_agent_prompt,
                add_handoff_back_messages=True,
                output_mode="full_history",
            ).compile(checkpointer=get_mongo_checkpointer())
