from typing import List
from models.agent import Agent, AgentState
from services.agents.agent_hooks import AgentHooks
from services.agents.agent_nodes import create_transfer_back_to_parent_tool, create_transfer_to_child_tool, detect_hierarchy_cycles
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
from langgraph.prebuilt import create_react_agent
from langchain_core.messages import RemoveMessage
from langchain_core.messages.utils import count_tokens_approximately
from langmem.short_term import SummarizationNode
from models.agent import PrebuiltAgents
from services.agents.mcp_client import MCPClientService
from core.auth import AuthProvider
from services.agents.tools.graphiti_memory_tools import save_memory, search_memory
from loguru import logger
from collections import defaultdict





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
            mcp_tools = await mcp_client_service.get_agent_tools(agent)

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
        # Summarization node — runs once per turn before routing to prevent  #
        # context bloat.  Writes compressed history to `summarized_messages`. #
        # ------------------------------------------------------------------ #
        summarization_node = SummarizationNode(
            token_counter=count_tokens_approximately,
            model=self.model_llm,
            max_tokens=6000,
            max_tokens_before_summary=3500,
            max_summary_tokens=800,
        )

        # ------------------------------------------------------------------ #
        # Assemble the top-level StateGraph                                   #
        # ------------------------------------------------------------------ #
        all_node_ids = list(agent_nodes.keys())  # includes "super_agent"

        def router_node(state: AgentState) -> dict:
            """Entry-point node.

            1. Maps the compressed ``summarized_messages`` produced by the
               preceding SummarizationNode back onto the canonical ``messages``
               channel so every downstream worker agent sees only the trimmed
               history.

               Because ``messages`` uses the ``add_messages`` reducer we cannot
               simply overwrite it.  Instead we:
                 a) identify messages that were compressed away (present in
                    ``messages`` but absent from ``summarized_messages``) and
                    emit a ``RemoveMessage`` for each one, and
                 b) include any brand-new summary messages (present in
                    ``summarized_messages`` but not yet in ``messages``).

            2. Ensures ``active_agent`` is always populated so the conditional
               edge can route deterministically.
            """
            updates: dict = {}

            # ----------------------------------------------------------------
            # Summarization state mapping
            # ----------------------------------------------------------------
            full_msgs = list(state.get("messages") or [])
            summarized_msgs = list(state.get("summarized_messages") or [])

            if summarized_msgs:
                full_ids = {msg.id for msg in full_msgs}
                summarized_ids = {msg.id for msg in summarized_msgs}

                # Messages compressed away — must be explicitly removed because
                # add_messages deduplicates by ID and won't drop them otherwise.
                # Only remove messages that have a non-None ID (LangGraph
                # requires RemoveMessage.id to be a plain str).
                msgs_to_remove = [
                    RemoveMessage(id=msg.id)
                    for msg in full_msgs
                    if msg.id is not None and msg.id not in summarized_ids
                ]
                # Brand-new summary messages not yet present in the channel.
                msgs_to_add = [msg for msg in summarized_msgs if msg.id not in full_ids]

                if msgs_to_remove or msgs_to_add:
                    updates["messages"] = msgs_to_remove + msgs_to_add
                    logger.debug(
                        f"🗜️  router_node: removed {len(msgs_to_remove)} compressed "
                        f"messages, added {len(msgs_to_add)} summary messages."
                    )

            # ----------------------------------------------------------------
            # Routing
            # ----------------------------------------------------------------
            active = state.get("active_agent")
            if not active or active not in all_node_ids:
                if active and active not in all_node_ids:
                    logger.warning(
                        f"⚠️  router_node: unknown active_agent '{active}', "
                        "falling back to super_agent."
                    )
                updates["active_agent"] = "super_agent"

            return updates

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
        graph.add_node("summarize", summarization_node)
        graph.add_node("router_node", router_node)
        for node_id, node in agent_nodes.items():
            graph.add_node(node_id, node)

        # Edges
        # summarize runs first every turn → router maps compressed history
        # → conditional edge dispatches to the active agent.
        graph.add_edge(START, "summarize")
        graph.add_edge("summarize", "router_node")
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
    "\n\nROUTING RULES:\n"
    "- Call the right transfer_to_<agent> tool immediately — do not describe the transfer.\n"
    "- Pass a self-contained instruction so the child needs no follow-up.\n"
    "- You are re-activated automatically when the child calls transfer_back_to_parent.\n"
    "- Respond directly (no transfer) only for greetings or questions needing no specialist.\n"
    "- NEVER call transfer_back_to_parent — you are the root.\n"
)

_CHILD_AGENT_ROUTING_GUIDANCE = (
    "\n\nROUTING RULES (apply in order):\n"
    "  0. OUT-OF-DOMAIN (highest priority): If the user's message falls entirely outside your domain, "
    "call transfer_back_to_parent IMMEDIATELY with a final_summary naming the request and the correct agent. "
    "Do NOT offer substitute tools, ask clarifying questions, or attempt partial handling.\n"
    "  1. TASK COMPLETE: Call transfer_back_to_parent with a concise final_summary.\n"
    "  2. DELEGATE: Use transfer_to_<agent> for tasks belonging to your own sub-agents.\n"
    "  3. MISSING INFO (your own active task only): Respond directly to the user — the graph pauses and routes the reply back to you.\n"
    "  4. PARTIAL COMPLETION: Finish what you can, then call transfer_back_to_parent with results and a note on the remaining gap.\n"
    "Never narrate a handoff — only the tool call counts.\n"
)
