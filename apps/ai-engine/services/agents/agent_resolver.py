import asyncio
from typing import Annotated, List, Optional
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
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent, InjectedState
from langgraph.types import Command
from langchain_core.tools import tool
from langchain_core.messages import AIMessage
from models.chat import PrebuiltAgents
from services.agents.mcp_client import MCPClientService
from core.auth import AuthProvider
from services.agents.tools.graphiti_memory_tools import save_memory, search_memory
from loguru import logger
from collections import defaultdict


# ---------------------------------------------------------------------------
# Cycle detection (unchanged)
# ---------------------------------------------------------------------------


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


# ---------------------------------------------------------------------------
# Handoff tool helpers
# ---------------------------------------------------------------------------


def _safe_tool_name(identifier: str) -> str:
    """Convert an agent identifier to a valid Python/tool name."""
    return identifier.replace("-", "_").replace(" ", "_")


def create_transfer_to_child_tool(
    child_identifier: str,
    child_name: str,
    child_description: str,
):
    """Factory that returns a LangChain tool for handing off to a child agent.

    The tool updates graph state via ``Command(graph=Command.PARENT)`` so the
    parent ``StateGraph`` immediately routes to the child node without waiting
    for the calling react-agent subgraph to finish its normal tool loop.

    State mutations:
      • ``active_agent``  → set to *child_identifier*
      • ``agent_stack``   → current active_agent pushed onto the stack
    """
    fn_name = f"transfer_to_{_safe_tool_name(child_identifier)}"

    def _transfer_fn(
        instruction: Annotated[
            str,
            "Clear task instruction or context to pass to the child agent.",
        ],
        state: Annotated[AgentState, InjectedState],
    ) -> Command:
        current_stack: list[str] = list(state.get("agent_stack") or [])
        current_agent: str = state.get("active_agent") or "super_agent"
        new_stack = current_stack + [current_agent]

        logger.info(
            f"🔀 Transfer: {current_agent} → {child_identifier} | stack: {new_stack}"
        )

        return Command(
            graph=Command.PARENT,
            update={
                "active_agent": child_identifier,
                "agent_stack": new_stack,
            },
            goto=child_identifier,
        )

    # Build the @tool with the correct name and docstring
    _transfer_fn.__name__ = fn_name
    _transfer_fn.__qualname__ = fn_name
    _transfer_fn.__doc__ = (
        f"Transfer control to the {child_name}.\n\n"
        f"{child_description}\n\n"
        "Provide a clear instruction or task context so the child agent "
        "knows exactly what is expected."
    )
    return tool(_transfer_fn)


def create_transfer_back_to_parent_tool(
    current_identifier: str,
    fallback_parent_identifier: str,
):
    """Factory that returns a LangChain tool for returning control to the parent.

    The tool:
      1. Pops the top of ``agent_stack`` to determine the correct parent.
      2. Appends a concise ``AIMessage`` summary so the parent sees only the
         key result (not every intermediate tool call the child made).
      3. Routes back to the parent node via ``Command(graph=Command.PARENT)``.

    State mutations:
      • ``active_agent``  → set to the popped parent identifier
      • ``agent_stack``   → top entry removed
      • ``messages``      → summary AIMessage appended
    """

    def _transfer_back_fn(
        final_summary: Annotated[
            str,
            (
                "Concise summary of what was accomplished, decisions made, "
                "or the result to hand back to the parent agent."
            ),
        ],
        state: Annotated[AgentState, InjectedState],
    ) -> Command:
        stack: list[str] = list(state.get("agent_stack") or [])

        if stack:
            parent = stack[-1]
            new_stack = stack[:-1]
        else:
            parent = fallback_parent_identifier or "super_agent"
            new_stack = []

        logger.info(
            f"🔙 Transfer back: {current_identifier} → {parent} | remaining stack: {new_stack}"
        )

        # Append a terse summary message so the parent LLM context stays lean.
        # The full internal dialogue is preserved in the checkpointer but the
        # parent's LLM only sees this high-level result.
        summary_msg = AIMessage(
            content=(f"[Sub-task completed by {current_identifier}]\n{final_summary}"),
            name=current_identifier,
        )

        return Command(
            graph=Command.PARENT,
            update={
                "active_agent": parent,
                "agent_stack": new_stack,
                "messages": [summary_msg],
            },
            goto=parent,
        )

    _transfer_back_fn.__name__ = "transfer_back_to_parent"
    _transfer_back_fn.__qualname__ = "transfer_back_to_parent"
    _transfer_back_fn.__doc__ = (
        f"Return control to the parent agent (currently: {fallback_parent_identifier}) "
        "once your sub-task is fully complete.\n\n"
        "Provide a concise final_summary that describes what was accomplished "
        "or any important result the parent should act on.\n\n"
        "⚠️  Only call this when your portion of the task is truly finished. "
        "If you still need user input or have more steps, continue working instead."
    )
    return tool(_transfer_back_fn)


# ---------------------------------------------------------------------------
# Agent resolver
# ---------------------------------------------------------------------------


class AgentResolver:
    def __init__(self, auth: AuthProvider, model_llm):
        self.model_llm = model_llm or get_llm()
        self._auth = auth

    async def resolve(self, agents: List[Agent]) -> CompiledStateGraph:
        mcp_client_service = MCPClientService(self._auth)

        # ------------------------------------------------------------------ #
        # Single-agent path: unchanged behaviour                              #
        # ------------------------------------------------------------------ #
        if len(agents) == 1:
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

        # ------------------------------------------------------------------ #
        # Multi-agent path: custom hierarchical StateGraph                    #
        # ------------------------------------------------------------------ #
        if len(agents) == 0:
            agents = [Agent.prebuilt(prebuilt_type=pt) for pt in list(PrebuiltAgents)]

        # Validate: no cycles
        detect_hierarchy_cycles(agents)

        # Build children map: parent_identifier → [child Agent, ...]
        agent_identifiers = {a.identifier for a in agents}
        children_map: dict[str, list[Agent]] = defaultdict(list)
        for agent in agents:
            parent = agent.parent or "super_agent"
            if parent != "super_agent" and parent not in agent_identifiers:
                logger.warning(
                    f"⚠️  Agent '{agent.identifier}' references unknown parent "
                    f"'{parent}' — attaching to super_agent instead."
                )
                parent = "super_agent"
            children_map[parent].append(agent)

        # ------------------------------------------------------------------ #
        # Pre-build handoff tool sets for every agent (including super_agent) #
        # ------------------------------------------------------------------ #
        # Maps agent-identifier → list[tool]
        transfer_tools: dict[str, list] = {}

        # super_agent: transfer-to-child for each of its direct children;
        # save_memory + search_memory (it is the sole memory writer)
        super_child_transfers = [
            create_transfer_to_child_tool(
                child.identifier, child.name, child.description
            )
            for child in children_map.get("super_agent", [])
        ]
        transfer_tools["super_agent"] = super_child_transfers

        # Every other agent: transfer-to-child for each of ITS children plus
        # a transfer-back-to-parent so it can complete sub-tasks cleanly.
        for agent in agents:
            agent_children = children_map.get(agent.identifier, [])
            to_child = [
                create_transfer_to_child_tool(
                    child.identifier, child.name, child.description
                )
                for child in agent_children
            ]
            parent = agent.parent or "super_agent"
            # Correct parent in case of fallback (already logged above)
            if parent != "super_agent" and parent not in agent_identifiers:
                parent = "super_agent"
            back_to_parent = create_transfer_back_to_parent_tool(
                agent.identifier, parent
            )
            transfer_tools[agent.identifier] = to_child + [back_to_parent]

        # ------------------------------------------------------------------ #
        # Build react-agent nodes                                             #
        # ------------------------------------------------------------------ #
        agent_nodes: dict[str, CompiledStateGraph] = {}

        # super_agent node
        logger.debug("🔧 Fetching MCP tools for 'super_agent' ...")
        # super_agent never has its own MCP tools (it delegates everything)
        super_agent_react = create_react_agent(
            name="super_agent",
            model=self.model_llm,
            tools=[save_memory, search_memory] + transfer_tools["super_agent"],
            prompt=super_agent_prompt + _SUPER_AGENT_ROUTING_GUIDANCE,
            store=get_mongo_memory_store(),
            state_schema=AgentState,
            pre_model_hook=AgentHooks.pre_agent_hook,
            post_model_hook=AgentHooks.post_agent_hook,
        )
        agent_nodes["super_agent"] = super_agent_react

        # One react-agent per non-root agent
        for agent in agents:
            logger.debug(f"🔧 Fetching MCP tools for '{agent.identifier}' ...")
            try:
                mcp_tools = await asyncio.wait_for(
                    mcp_client_service.get_agent_tools(agent),
                    timeout=10,
                )
            except asyncio.TimeoutError:
                logger.warning(
                    f"⏱️  MCP tool fetch timed out for '{agent.identifier}' "
                    "— continuing without MCP tools."
                )
                mcp_tools = []

            logger.debug(f"✅ Got {len(mcp_tools)} MCP tools for '{agent.identifier}'")

            node_prompt = (
                (agent.system_prompt or "")
                + MEMORY_SUB_AGENT_GUIDANCE
                + _CHILD_AGENT_ROUTING_GUIDANCE
            )

            agent_nodes[agent.identifier] = create_react_agent(
                name=agent.identifier,
                model=self.model_llm,
                tools=mcp_tools + [search_memory] + transfer_tools[agent.identifier],
                prompt=node_prompt,
                store=get_mongo_memory_store(),
                state_schema=AgentState,
                pre_model_hook=AgentHooks.pre_agent_hook,
                post_model_hook=AgentHooks.post_agent_hook,
            )

        # ------------------------------------------------------------------ #
        # Assemble the top-level StateGraph                                   #
        # ------------------------------------------------------------------ #
        all_node_ids = list(agent_nodes.keys())  # includes "super_agent"

        def router_node(state: AgentState) -> dict:
            """Entry-point node.

            Ensures ``active_agent`` is always populated so the conditional
            edge can route deterministically.  No messages are modified here.
            """
            active = state.get("active_agent")
            if not active or active not in all_node_ids:
                if active and active not in all_node_ids:
                    logger.warning(
                        f"⚠️  router_node: unknown active_agent '{active}', "
                        "falling back to super_agent."
                    )
                return {"active_agent": "super_agent"}
            return {}  # active_agent already valid — no mutation needed

        def _route_from_router(state: AgentState) -> str:
            """Conditional edge: dispatch to whichever agent holds control."""
            return state.get("active_agent") or "super_agent"

        def _route_after_agent(state: AgentState) -> str:
            """Conditional edge after an agent node completes normally.

            • If the agent changed ``active_agent`` via a transfer tool the
              ``Command.PARENT`` already handled routing — this edge is only
              reached when the agent finished WITHOUT calling a transfer tool
              (i.e. it replied to the user or paused for confirmation).
            • In that case we end the current invocation and preserve
              ``active_agent`` in state so the NEXT user message is routed
              back to THIS agent (deterministic re-entry).
            """
            # The agent responded directly — end the graph turn.
            # active_agent in state already reflects the correct next entry
            # point (it was either set by a prior transfer, or stays as-is
            # from router_node).
            return END

        graph = StateGraph(AgentState)

        # Nodes
        graph.add_node("router_node", router_node)
        for node_id, node in agent_nodes.items():
            graph.add_node(node_id, node)

        # Edges
        graph.add_edge(START, "router_node")
        graph.add_conditional_edges(
            "router_node",
            _route_from_router,
            {nid: nid for nid in all_node_ids},
        )

        # After each agent finishes (no Command.PARENT transfer), go to END
        # and preserve active_agent for the next user turn.
        for node_id in all_node_ids:
            graph.add_conditional_edges(
                node_id,
                _route_after_agent,
                {END: END},
            )

        logger.info(
            f"✅ Custom StateGraph built with {len(all_node_ids)} agent nodes: "
            + ", ".join(all_node_ids)
        )

        return graph.compile(checkpointer=get_mongo_checkpointer())


# ---------------------------------------------------------------------------
# Routing guidance snippets appended to agent prompts
# ---------------------------------------------------------------------------

_SUPER_AGENT_ROUTING_GUIDANCE = (
    "\n\n"
    "ROUTING & HANDOFF RULES (Custom StateGraph):\n"
    "You are the top-level entry point. When a task requires a specialist:\n"
    "  1. Call the appropriate transfer_to_<agent> tool — this IMMEDIATELY routes "
    "     the conversation to that agent. Do NOT describe the transfer; just call it.\n"
    "  2. Pass a clear, self-contained instruction string so the child knows exactly "
    "     what to do without needing to ask you follow-up questions.\n"
    "  3. You will be re-activated automatically once the child calls "
    "     transfer_back_to_parent with its result.\n"
    "  4. Only respond directly (without a transfer tool) for simple greetings, "
    "     clarifications, or questions that don't require a specialist.\n"
    "  5. NEVER call transfer_back_to_parent — you are the root; you have no parent.\n"
)

_CHILD_AGENT_ROUTING_GUIDANCE = (
    "\n\n"
    "ROUTING & HANDOFF RULES (Custom StateGraph):\n"
    "  1. When your sub-task is fully complete, call transfer_back_to_parent with a "
    "     concise final_summary of what was accomplished.\n"
    "  2. If you need to delegate to one of your own sub-agents, call the appropriate "
    "     transfer_to_<agent> tool. You will be re-activated once that agent returns.\n"
    "  3. If you need additional information or confirmation from the user BEFORE you "
    "     can proceed, respond naturally to the user WITHOUT calling any transfer tool. "
    "     The graph will pause here and route the user's next reply directly back to "
    "     you, maintaining the conversation context.\n"
    "  4. Do NOT call transfer_back_to_parent until you have a complete result — "
    "     the parent should only see your final, consolidated answer.\n"
)
