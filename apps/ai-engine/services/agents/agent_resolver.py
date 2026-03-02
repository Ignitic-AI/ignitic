import asyncio
from typing import List
from langgraph_supervisor import create_supervisor
from models.agent import Agent, AgentState
from services.agents.agent_hooks import AgentHooks
from services.agents.llms import get_llm
from services.agents.prompts import (
    super_agent_prompt,
    MEMORY_SINGLE_AGENT_GUIDANCE,
    MEMORY_SUB_AGENT_GUIDANCE,
)
from services.agents.checkpointers import (
    get_mongo_checkpointer,
)
from services.agents.memory_stores import get_mongo_memory_store
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent
from models.chat import PrebuiltAgents
from services.agents.mcp_client import MCPClientService
from core.auth import AuthProvider
from services.agents.tools.graphiti_memory_tools import save_memory, search_memory
from loguru import logger
from collections import defaultdict


def detect_hierarchy_cycles(agents: List[Agent]) -> None:
    """Detect cycles in the agent hierarchy.

    Each agent has a ``parent`` field pointing to another agent's identifier
    or ``"super_agent"`` (the implicit root).  A cycle exists when following
    parent pointers from any agent eventually leads back to itself.

    Uses iterative DFS with a *recursion-stack* marker so that shared
    ancestry (diamond shapes) is handled correctly.

    Raises:
        ValueError: If a cycle is detected, listing the involved agents.
    """
    parent_map: dict[str, str] = {
        agent.identifier: (agent.parent or "super_agent") for agent in agents
    }
    identifier_set = set(parent_map.keys())

    VISITED = "visited"
    IN_STACK = "in_stack"
    state: dict[str, str] = {}

    def _dfs(node: str) -> None:
        # Nodes outside the current agent set (e.g. "super_agent") are safe.
        if node not in identifier_set:
            return
        if state.get(node) == VISITED:
            return
        if state.get(node) == IN_STACK:
            # Walk back through the parent chain to build a readable cycle.
            cycle = [node]
            cur = parent_map[node]
            while cur != node:
                cycle.append(cur)
                cur = parent_map[cur]
            cycle.append(node)
            raise ValueError(
                "Cycle detected in agent hierarchy: " + " -> ".join(reversed(cycle))
            )

        state[node] = IN_STACK
        _dfs(parent_map.get(node, "super_agent"))
        state[node] = VISITED

    for identifier in identifier_set:
        _dfs(identifier)

    logger.debug("✅ Agent hierarchy cycle check passed")



class AgentResolver:
    def __init__(self, auth: AuthProvider, model_llm):
        self.model_llm = model_llm or get_llm()
        self._auth = auth

    async def resolve(self, agents: List[Agent]) -> CompiledStateGraph:
        mcp_client_service = MCPClientService(self._auth)

        if len(agents) == 1:
            # Single-agent mode: the agent is responsible for both saving and
            # retrieving long-term knowledge-graph memories.
            mcp_tools = await mcp_client_service.get_agent_tools(agents[0])
            tools = mcp_tools + [save_memory, search_memory]
            single_agent_prompt = (
                agents[0].system_prompt or ""
            ) + MEMORY_SINGLE_AGENT_GUIDANCE
            return create_react_agent(
                name=agents[0].name,
                model=self.model_llm,
                tools=tools,
                prompt=single_agent_prompt,
                checkpointer=get_mongo_checkpointer(),
                store=get_mongo_memory_store(),
                state_schema=AgentState,
                pre_model_hook=AgentHooks.pre_agent_hook,
                post_model_hook=AgentHooks.post_agent_hook,
            )
        else:
            if len(agents) == 0:
                agents = [
                    Agent.prebuilt(prebuilt_type=prebuilt_type)
                    for prebuilt_type in list(PrebuiltAgents)
                ]

            # --- Validate hierarchy ------------------------------------------
            detect_hierarchy_cycles(agents)

            # --- Build children map ------------------------------------------
            # Maps parent identifier -> list of child Agent objects.
            # Agents whose parent is not present in the current set are
            # implicitly treated as children of "super_agent".
            agent_identifiers = {a.identifier for a in agents}
            children_map: dict[str, list[Agent]] = defaultdict(list)
            for agent in agents:
                parent = agent.parent or "super_agent"
                # If the referenced parent isn't in the loaded set, fall back
                # to super_agent so the agent is still reachable.
                if parent != "super_agent" and parent not in agent_identifiers:
                    logger.warning(
                        f"⚠️  Agent '{agent.identifier}' references unknown parent "
                        f"'{parent}' — attaching to super_agent instead."
                    )
                    parent = "super_agent"
                children_map[parent].append(agent)

            # --- Recursive builder -------------------------------------------
            # Multi-agent mode:
            #   • Top-level SuperAgent supervisor has save + search memory.
            #   • Mid-level supervisors (agents with children) get their own
            #     MCP tools plus search_memory, and manage their sub-agents.
            #   • Leaf agents are plain react agents with search_memory.
            async def _build_agent_node(agent: Agent):
                """Return a compiled graph for *agent*, recursing into children."""
                children = children_map.get(agent.identifier, [])
                logger.debug(f"🔧 Fetching MCP tools for '{agent.identifier}' ...")
                try:
                    mcp_tools = await asyncio.wait_for(
                        mcp_client_service.get_agent_tools(agent),
                        timeout=10,
                    )
                except asyncio.TimeoutError:
                    logger.warning(
                        f"⏱️  MCP tool fetch timed out for '{agent.identifier}' — continuing without MCP tools."
                    )
                    mcp_tools = []
                logger.debug(
                    f"✅ Got {len(mcp_tools)} MCP tools for '{agent.identifier}'"
                )

                if not children:
                    # Leaf agent — simple react agent
                    # Use identifier (unique) for node naming to avoid
                    # duplicate-subgraph errors when display names collide.
                    return create_react_agent(
                        name=agent.identifier,
                        model=self.model_llm,
                        tools=mcp_tools + [search_memory],
                        prompt=(agent.system_prompt or "") + MEMORY_SUB_AGENT_GUIDANCE,
                        store=get_mongo_memory_store(),
                        state_schema=AgentState,
                        pre_model_hook=AgentHooks.pre_agent_hook,
                        post_model_hook=AgentHooks.post_agent_hook,
                    )
                else:
                    # Mid-level supervisor — manages its children
                    child_nodes = []
                    for child in children:
                        child_nodes.append(await _build_agent_node(child))

                    return create_supervisor(
                        # Use identifier for both supervisor_name and compiled name
                        # to avoid identity confusion in the LLM (it sees itself as
                        # supervisor_name in its context).
                        supervisor_name=agent.identifier,
                        agents=child_nodes,
                        model=self.model_llm,
                        prompt=(agent.system_prompt or "") + MEMORY_SUB_AGENT_GUIDANCE,
                        tools=mcp_tools + [search_memory],
                        # Suppress internal handoff noise — the handback to the parent
                        # supervisor is handled at the subgraph boundary automatically.
                        # The inner supervisor LLM must NOT try to call
                        # transfer_back_to_superagent itself (it doesn't have that tool).
                        add_handoff_back_messages=False,
                        state_schema=AgentState,
                        pre_model_hook=AgentHooks.pre_agent_hook,
                        post_model_hook=AgentHooks.post_agent_hook,
                        # Use last_message so only the final answer is returned to the
                        # parent SuperAgent, not the full internal sub-graph conversation.
                        # full_history bloats SuperAgent's context and causes empty responses.
                        output_mode="last_message",
                    ).compile(
                        name=agent.identifier,
                        store=get_mongo_memory_store(),
                    )

            # --- Build root-level nodes (direct children of super_agent) -----
            root_agents = children_map.get("super_agent", [])
            root_nodes = []
            for agent in root_agents:
                root_nodes.append(await _build_agent_node(agent))

            return create_supervisor(
                supervisor_name="SuperAgent",
                agents=root_nodes,  # type: ignore[arg-type]
                model=self.model_llm,
                prompt=super_agent_prompt,
                tools=[save_memory, search_memory],
                # add_handoff_messages=False,
                # add_handoff_back_messages=False,
                state_schema=AgentState,
                pre_model_hook=AgentHooks.pre_agent_hook,
                post_model_hook=AgentHooks.post_agent_hook,
                output_mode="full_history",
            ).compile(checkpointer=get_mongo_checkpointer())