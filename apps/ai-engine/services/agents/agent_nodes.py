from typing import Annotated, List
import uuid

from langgraph.graph import END
from models.agent import Agent, AgentState
from models.custom_messages import TaskMessage
from langgraph.prebuilt import InjectedState
from langgraph.types import Command
from langchain_core.tools import tool
from langchain_core.messages import AIMessage, BaseMessage, RemoveMessage, ToolMessage
from loguru import logger
from langchain_core.messages.utils import count_tokens_approximately




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

        # --- State Encapsulation ---
        # We need to explicitly bubble up the AIMessage containing the tool call
        # so the model's history shows successful tool usage, not just text generation.
        messages = state.get("messages", [])
        last_ai_msg = next((m for m in reversed(messages) if isinstance(m, AIMessage) and m.tool_calls), None)
        # We must clone the AIMessage and strip out any parallel tool calls
        # to prevent "INVALID_CHAT_HISTORY" crashes where tool_calls lack a corresponding ToolMessage.
        clean_ai_msg = None
        tool_call_id = "unknown"
        if last_ai_msg and last_ai_msg.tool_calls:
            for tc in last_ai_msg.tool_calls:
                if tc["name"] == fn_name:
                    tool_call_id = tc["id"]
                    clean_ai_msg = AIMessage(
                        content=last_ai_msg.content,
                        tool_calls=[tc],
                        name=last_ai_msg.name,
                    )
                    break

        handoff_msg = ToolMessage(
            content=f"[Transferring to {child_identifier}]\n{instruction}",
            name=fn_name,
            tool_call_id=tool_call_id,
        )

        act_command_msg = TaskMessage(
            content="Act",
            name=current_agent,
        )

        update_messages = []
        if clean_ai_msg:
            update_messages.append(clean_ai_msg)
        update_messages.extend([handoff_msg, act_command_msg])

        return Command(
            graph=Command.PARENT,
            update={
                "active_agent": child_identifier,
                "agent_stack": new_stack,
                "messages": update_messages,
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
    """Factory: emergency escape hatch tool for returning control to the parent.

    This tool is strictly for **out-of-bounds** situations where the
    user's request falls entirely outside the current agent's domain.
    Normal task completion should end with a direct reply to the user —
    the Intent Teleportation router will keep subsequent turns anchored
    to this agent automatically.

    State mutations:
      • ``active_agent``  → set to the popped parent identifier
      • ``agent_stack``   → top entry removed
      • ``messages``      → terse summary AIMessage appended
    """

    def _transfer_back_fn(
        final_summary: Annotated[
            str,
            (
                "Brief reason for the escalation — what was the out-of-domain "
                "request that triggered this escape."
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

        # --- State Encapsulation ---
        messages = state.get("messages", [])
        last_ai_msg = next((m for m in reversed(messages) if isinstance(m, AIMessage) and m.tool_calls), None)
        # We must clone the AIMessage and strip out any parallel tool calls
        clean_ai_msg = None
        tool_call_id = "unknown"
        if last_ai_msg and last_ai_msg.tool_calls:
            for tc in last_ai_msg.tool_calls:
                if tc["name"] == "transfer_back_to_parent":
                    tool_call_id = tc["id"]
                    clean_ai_msg = AIMessage(
                        content=last_ai_msg.content,
                        tool_calls=[tc],
                        name=last_ai_msg.name,
                    )
                    break

        summary_msg = ToolMessage(
            content=(f"[Sub-task completed by {current_identifier}]\n{final_summary}"),
            name="transfer_back_to_parent",
            tool_call_id=tool_call_id,
        )

        update_messages = []
        if clean_ai_msg:
            update_messages.append(clean_ai_msg)
        update_messages.append(summary_msg)

        return Command(
            graph=Command.PARENT,
            update={
                "active_agent": parent,
                "agent_stack": new_stack,
                "messages": update_messages,
            },
            goto=parent,
        )

    _transfer_back_fn.__name__ = "transfer_back_to_parent"
    _transfer_back_fn.__qualname__ = "transfer_back_to_parent"
    _transfer_back_fn.__doc__ = (
        "⚠️ EMERGENCY ESCAPE — call ONLY when the user's request is completely "
        "outside your domain and you lack the tools to handle it.\n\n"
        f"Returns control to the parent agent ({fallback_parent_identifier}) "
        "so it can re-route to the correct specialist.\n\n"
        "Do NOT call this after completing a task — reply directly to the user instead. "
        "The router will keep follow-up turns anchored to you automatically."
    )
    return tool(_transfer_back_fn)



def build_router_node(
    all_node_ids: List[str],
    ancestor_map: dict[str, list[str]] | None = None,
    agent_descriptions_map: dict[str, str] | None = None,
):
    """Factory for the router_node that supports Intent Teleportation.

    Args:
        all_node_ids: identifiers of every agent node in the graph.
        ancestor_map: ``{agent_id: [root, ..., parent]}`` computed by
            AgentResolver.  Used to rebuild the ``agent_stack`` when
            teleporting directly to a nested sub-agent.
        agent_descriptions_map: ``{agent_id: description}`` used to give the
            intent classifier domain context so it can detect when a user
            request has drifted outside the last agent's capabilities.
    """
    from pydantic import BaseModel, Field as PydanticField
    from services.agents.llms import get_intent_classifier_llm
    from langchain_core.messages import HumanMessage as _HM

    class _IntentClassification(BaseModel):
        continues_previous: bool = PydanticField(
            description="True if the user's message logically continues "
                        "the conversation with the previously active agent "
                        "AND the request is within that agent's domain."
        )
        domain_mismatch: bool = PydanticField(
            description="True if the user's request requires capabilities "
                        "clearly outside the last agent's domain, even if "
                        "the topic is contextually related."
        )

    _ancestor_map = ancestor_map or {}
    _agent_descriptions_map = agent_descriptions_map or {}

    def router_node(state: AgentState) -> dict:
        """Entry-point node with Intent Teleportation.

        1. Maps compressed ``summarized_messages`` onto ``messages``.
        2. Runs a fast intent classifier to decide whether to teleport
           the user back to the ``last_worker_agent`` or route via
           super_agent.
        3. Ensures ``active_agent`` is always populated.
        """
        updates: dict = {}

        # ----------------------------------------------------------------
        # Track last_worker_agent — the agent that owned the previous turn.
        # Since this router runs at the START of each new turn, and the
        # previous turn ended with END (meaning active_agent responded
        # directly to the user), we snapshot active_agent as the
        # last_worker_agent for the Intent Teleportation classifier.
        # ----------------------------------------------------------------
        current_active = state.get("active_agent")
        if current_active and current_active != "super_agent":
            updates["last_worker_agent"] = current_active

        # ----------------------------------------------------------------
        # Summarization state mapping
        # ----------------------------------------------------------------
        full_msgs = list(state.get("messages") or [])
        summarized_msgs = list(state.get("summarized_messages") or [])

        logger.debug(f"Token count of messsages: {count_tokens_approximately(full_msgs)} tokens | ")

        if summarized_msgs:
            msgs_to_remove = [
                RemoveMessage(id=msg.id) for msg in full_msgs if msg.id is not None
            ]
            fresh_summarized_msgs = [
                msg.copy(update={"id": str(uuid.uuid4())})
                for msg in summarized_msgs
            ]
            updates["messages"] = msgs_to_remove + fresh_summarized_msgs

            logger.debug(
                f"🗜️  router_node: removed all {len(msgs_to_remove)} existing messages, "
                f"re-inserted {len(fresh_summarized_msgs)} freshly-ID'd summarized messages."
            )

        # ----------------------------------------------------------------
        # Intent Teleportation
        # ----------------------------------------------------------------
        last_worker = state.get("last_worker_agent")
        active = state.get("active_agent")

        # Find the latest HumanMessage (skip ContextMessage/ImageMessage/etc.)
        latest_human_text = None
        for msg in reversed(full_msgs):
            if msg.type == "human" and isinstance(msg, _HM):
                if isinstance(msg.content, str):
                    latest_human_text = msg.content
                elif isinstance(msg.content, list):
                    latest_human_text = " ".join(
                        block.get("text", "")
                        for block in msg.content
                        if isinstance(block, dict) and block.get("type") == "text"
                    )
                break

        teleported = False
        if (
            last_worker
            and last_worker in all_node_ids
            and latest_human_text
            and latest_human_text.strip()
        ):
            try:
                agent_desc = _agent_descriptions_map.get(last_worker, "")
                domain_context = (
                    f" This agent's domain is: '{agent_desc}'." if agent_desc else ""
                )
                classifier_llm = get_intent_classifier_llm()
                structured = classifier_llm.with_structured_output(
                    _IntentClassification, strict=True
                )
                result: _IntentClassification = structured.invoke(
                    f"The last agent the user spoke to was '{last_worker}'.{domain_context} "
                    f"The user just said: \"{latest_human_text[:500]}\". "
                    "Set continues_previous=True AND domain_mismatch=False ONLY if: "
                    "(1) the message continues the prior conversation AND "
                    "(2) the request is within that agent's domain. "
                    "Set domain_mismatch=True if the user is asking for something the "
                    "last agent clearly cannot do (e.g., asking a Google Drive agent to "
                    "post to Facebook). A domain mismatch always forces re-routing."
                )
                if result.continues_previous and not result.domain_mismatch:
                    updates["active_agent"] = last_worker
                    updates["agent_stack"] = _ancestor_map.get(last_worker, [])
                    teleported = True
                    logger.info(
                        f"🚀 Intent Teleportation: routing directly to "
                        f"'{last_worker}' (stack: {updates['agent_stack']})"
                    )
                elif result.domain_mismatch:
                    logger.info(
                        f"🔀 Domain mismatch detected for '{last_worker}', "
                        "routing via super_agent."
                    )
            except Exception as e:
                logger.warning(
                    f"⚠️  Intent classifier failed, falling back to default routing: {e}"
                )

        # ----------------------------------------------------------------
        # Default routing (no teleportation)
        # ----------------------------------------------------------------
        if not teleported:
            if not active or active not in all_node_ids:
                if active and active not in all_node_ids:
                    logger.warning(
                        f"⚠️  router_node: unknown active_agent '{active}', "
                        "falling back to super_agent."
                    )
                updates["active_agent"] = "super_agent"

        return updates
    return router_node

def _route_from_router(state: AgentState) -> str:
    """Conditional edge: dispatch to whichever agent holds control."""
    return state.get("active_agent") or "super_agent"

def _route_after_agent(state: AgentState) -> str:
    """Conditional edge after an agent node completes normally.

    When an agent finishes WITHOUT calling a transfer tool (i.e. it
    replied directly to the user), we record it as ``last_worker_agent``
    so the Intent Teleportation router can re-anchor subsequent turns.

    NOTE: Conditional edges in LangGraph can only return a routing string
    and cannot mutate state.  ``last_worker_agent`` is instead set by
    returning it in the node's output dict.  However, react-agent nodes
    don't return custom state keys natively.  The workaround: the router_node
    sets ``last_worker_agent = active_agent`` whenever the previous turn
    ended with END (i.e., the current ``active_agent`` responded directly).
    """
    return END