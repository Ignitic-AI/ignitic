from typing import List
from models.agent import Agent, AgentState
from services.agents.agent_hooks import AgentHooks
from services.agents.agent_nodes import (
    _route_after_agent,
    _route_from_router,
    build_router_node,
    create_transfer_back_to_parent_tool,
    create_transfer_to_child_tool,
    detect_hierarchy_cycles,
)
from services.agents.llms import get_llm, get_summarization_llm
from services.agents.prompts import (
    super_agent_prompt,
    MEMORY_SINGLE_AGENT_GUIDANCE,
    MEMORY_SUB_AGENT_GUIDANCE,
    SUMMARIZATION_INITIAL_PROMPT,
    SUMMARIZATION_UPDATE_PROMPT,
    SUMMARIZATION_FINAL_PROMPT,
)
from services.agents.checkpointers import (
    get_mongo_checkpointer,
)
from services.agents.memory_stores import get_mongo_memory_store
from langgraph.graph import StateGraph, START, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.prebuilt import create_react_agent
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
    def __init__(
        self,
        auth: AuthProvider,
        model_llm,
        chat_id: str | None = None,
        image_urls: list[str] | None = None,
    ):
        self.model_llm = model_llm or get_llm()
        self._auth = auth
        self._chat_id = chat_id
        self._image_urls = image_urls

    async def resolve(self, agents: List[Agent]) -> CompiledStateGraph:
        mcp_client_service = MCPClientService(
            self._auth, chat_id=self._chat_id, image_urls=self._image_urls
        )

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
        # Ancestor map for Intent Teleportation stack rebuilding              #
        # ------------------------------------------------------------------ #
        # Maps agent_identifier → [root, ..., immediate_parent] so the router
        # can reconstruct the full agent_stack when teleporting directly to a
        # nested sub-agent (e.g. facebook_page_agent → ["super_agent", "marketer"]).
        ancestor_map: dict[str, list[str]] = {}
        for agent in agents:
            chain: list[str] = []
            current = agent.identifier
            visited: set[str] = set()
            while current != "super_agent" and current not in visited:
                visited.add(current)
                parent_id = next(
                    (
                        (a.parent or "super_agent")
                        for a in agents
                        if a.identifier == current
                    ),
                    "super_agent",
                )
                chain.insert(0, parent_id)
                current = parent_id
            ancestor_map[agent.identifier] = chain

        logger.debug(f"📍 Ancestor map computed: {ancestor_map}")

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

        MAX_TOKENS_BEFORE_SUMMARY = 20000  # LLM context window minus max_summary_tokens
        MAX_CONTEXT_TOKENS = 22000
        MAX_SUMMARY_TOKENS = 2000

        summarization_node = SummarizationNode(
            token_counter=count_tokens_approximately,
            model=get_summarization_llm().bind(max_tokens=MAX_SUMMARY_TOKENS),
            max_tokens=MAX_CONTEXT_TOKENS,
            max_tokens_before_summary=MAX_TOKENS_BEFORE_SUMMARY,
            max_summary_tokens=MAX_SUMMARY_TOKENS,
            initial_summary_prompt=SUMMARIZATION_INITIAL_PROMPT,
            existing_summary_prompt=SUMMARIZATION_UPDATE_PROMPT,
            final_prompt=SUMMARIZATION_FINAL_PROMPT,
        )

        # ------------------------------------------------------------------ #
        # Assemble the top-level StateGraph                                   #
        # ------------------------------------------------------------------ #
        all_node_ids = list(agent_nodes.keys())  # includes "super_agent"

        router_node = build_router_node(all_node_ids, ancestor_map)

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
    "- Call the right transfer_to_<agent> tool IMMEDIATELY \u2014 do NOT describe the transfer in text.\n"
    "- Writing '[Transferring to ...]' or 'I will transfer...' without calling the tool is a hard failure.\n"
    "- Pass a self-contained instruction so the child needs no follow-up.\n"
    "- You may be re-activated when a child encounters an out-of-domain request. "
    "When that happens, read the child's summary and route to the correct specialist immediately.\n"
    "- Sub-agents respond directly to the user. You will only see a terse summary, not their full dialogue. "
    "Do NOT repeat or summarise what they did — the user already saw it.\n"
    "- For multi-step work, call the next transfer tool immediately after reading the summary \u2014 no commentary.\n"
    "- Respond directly (no transfer) ONLY for greetings or questions needing no specialist.\n"
    "- NEVER call transfer_back_to_parent — you are the root.\n"
)

_CHILD_AGENT_ROUTING_GUIDANCE = (
    "\n\nROUTING RULES:\n"
    "  1. YOU OWN THE CONVERSATION: After completing a task, reply directly to the user. "
    "Do NOT call transfer_back_to_parent after delivering results. "
    "Expect follow-up questions and handle them yourself as long as they are within your domain.\n"
    "  2. EMERGENCY ESCAPE ONLY: Call transfer_back_to_parent ONLY if the user's request is "
    "completely outside your domain and you lack the necessary tools. "
    "When this happens: do NOT explain your limitations, do NOT apologize, do NOT suggest alternatives. "
    "Call the tool immediately as your first and only action.\n"
    "  3. DELEGATE DOWN: If you have sub-agents, use transfer_to_<agent> for tasks in their domain. "
    "Call the tool — do NOT write about it.\n"
    "  4. MISSING INFO: If you need clarification from the user, respond directly. "
    "The router will anchor the user's reply back to you automatically.\n"
    "HARD RULE: A transfer = a tool call. Text describing a transfer with no tool call is always wrong.\n"
)
