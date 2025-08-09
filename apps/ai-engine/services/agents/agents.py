from typing import List, Literal
from langgraph_supervisor import create_supervisor
from services.agents.llms import llm
from services.agents.prompts import super_agent_prompt
from services.agents.checkpointers import get_mongo_checkpointer
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent
from services.agents.prompts import AGENT_PROMPTS


async def ainvoke_agents(
    agents: List[Literal["product_researcher_agent", "marketer_agent"]],
    message: str,
    thread_id: str,
):
    agent = AgentResolver().resolve(agents)

    RETRY_COUNT = 3
    agent_response = None

    while agent_response is None and RETRY_COUNT > 0:
        try:
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
    return agent_response


class AgentResolver:

    AGENTS: List[Literal["product_researcher_agent", "marketer_agent"]] = [
        "product_researcher_agent",
        "marketer_agent",
    ]

    def resolve(
        self, agents: List[Literal["product_researcher_agent", "marketer_agent"]]
    ) -> CompiledStateGraph:
        if len(agents) == 1:
            return create_react_agent(
                name=agents[0],
                model=llm,
                tools=[],
                prompt=AGENT_PROMPTS[agents[0]],
                checkpointer=get_mongo_checkpointer(),
            )
        else:
            if len(agents) == 0:
                agents = self.AGENTS
            return create_supervisor(
                supervisor_name="SuperAgent",
                agents=[
                    create_react_agent(
                        name=agent,
                        model=llm,
                        tools=[],
                        prompt=AGENT_PROMPTS[agent],
                    )
                    for agent in agents
                ],
                model=llm,
                prompt=super_agent_prompt,
                add_handoff_back_messages=True,
                output_mode="full_history",
            ).compile(checkpointer=get_mongo_checkpointer())
